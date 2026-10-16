import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createShortLink,
  listShortLinksWithStats,
  resolveShortLink,
} from "../src/application/short-links";
import { recordClick } from "../src/application/record-click";
import { OriginalUrl } from "../src/domain/original-url";
import { ShortCode } from "../src/domain/short-code";
import { ShortLink } from "../src/domain/short-link";
import { ShortCodeCollisionError } from "../src/errors/short-link-errors";
import { Prisma } from "../src/generated/prisma/client";
import {
  createSqliteClient,
  PrismaShortLinkRepository,
} from "../src/infrastructure/sqlite";
import { generateCryptoShortCode } from "../src/infrastructure/crypto-short-code";

const executeFile = promisify(execFile);
const engineDirectory = fileURLToPath(new URL("../", import.meta.url));
const prismaCli = join(engineDirectory, "node_modules/prisma/build/index.js");
let temporaryDatabaseDirectory: string;
let databaseUrl: string;
let client: ReturnType<typeof createSqliteClient>;
let secondaryClient: ReturnType<typeof createSqliteClient>;
let repository: PrismaShortLinkRepository;
let secondaryRepository: PrismaShortLinkRepository;

function migrate() {
  return executeFile(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: engineDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "info" },
    timeout: 15_000,
  });
}

function createTestLink(
  code = "Ab12Cd34",
  destination = "https://example.com/path?q=one#section",
  date = "2026-10-15T08:00:00Z",
) {
  return new ShortLink(
    new ShortCode(code),
    new OriginalUrl(destination),
    new Date(date),
  );
}

beforeAll(async () => {
  temporaryDatabaseDirectory = await mkdtemp(join(tmpdir(), "url-shortener-"));
  databaseUrl = `file:${join(temporaryDatabaseDirectory, "test.db")}`;
  await migrate();
  client = createSqliteClient(databaseUrl);
  secondaryClient = createSqliteClient(databaseUrl);
  repository = new PrismaShortLinkRepository(client);
  secondaryRepository = new PrismaShortLinkRepository(secondaryClient);
}, 20_000);

beforeEach(async () => {
  await client.shortLink.deleteMany();
});

afterAll(async () => {
  await client?.$disconnect();
  await secondaryClient?.$disconnect();
  if (temporaryDatabaseDirectory)
    await rm(temporaryDatabaseDirectory, { recursive: true, force: true });
});

describe("Prisma/SQLite repository", () => {
  it("persists a new link with zero clicks and resolves its original destination", async () => {
    const original = await createShortLink(
      "https://example.com/path?q=one#section",
      {
        repository,
        generateCode: generateCryptoShortCode,
        now: () => new Date("2026-10-15T08:00:00Z"),
      },
    );
    expect(original.code.value).toMatch(/^[A-Za-z0-9]{8}$/);
    const stored = await secondaryRepository.findByCode(original.code);
    expect(stored?.originalUrl.value).toBe(original.originalUrl.value);
    expect(stored?.createdAt).toEqual(original.createdAt);
    expect(await secondaryRepository.listWithStats()).toEqual([
      {
        code: original.code.value,
        originalUrl: original.originalUrl.value,
        createdAt: original.createdAt,
        clickCount: 0,
      },
    ]);
  });

  it("allows case-distinct codes and duplicate destinations, but never overwrites an existing code", async () => {
    await repository.insert(createTestLink("Ab12Cd34"));
    await secondaryRepository.insert(createTestLink("ab12cd34"));
    await expect(
      secondaryRepository.insert(
        createTestLink("Ab12Cd34", "https://other.example"),
      ),
    ).rejects.toThrow(ShortCodeCollisionError);
    expect(
      (await repository.findByCode(new ShortCode("Ab12Cd34")))?.originalUrl
        .value,
    ).toBe(createTestLink().originalUrl.value);
    expect(await client.shortLink.count()).toBe(2);
  });

  it("reserves a code for at most one concurrent insertion across connections", async () => {
    const results = await Promise.allSettled([
      repository.insert(createTestLink("Ab12Cd34", "https://first.example")),
      secondaryRepository.insert(
        createTestLink("Ab12Cd34", "https://second.example"),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failed = results.find((result) => result.status === "rejected");
    expect(failed?.status === "rejected" && failed.reason).toBeInstanceOf(
      ShortCodeCollisionError,
    );
    expect(await client.shortLink.count()).toBe(1);
  });

  it("lets concurrent creation recover from a database collision", async () => {
    const firstCandidates = ["Ab12Cd34", "First123"];
    const secondCandidates = ["Ab12Cd34", "Second12"];
    const created = await Promise.all([
      createShortLink("https://first.example", {
        repository,
        generateCode: () => new ShortCode(firstCandidates.shift()),
        now: () => new Date(),
      }),
      createShortLink("https://second.example", {
        repository: secondaryRepository,
        generateCode: () => new ShortCode(secondCandidates.shift()),
        now: () => new Date(),
      }),
    ]);
    expect(new Set(created.map((result) => result.code.value)).size).toBe(2);
    expect(await client.shortLink.count()).toBe(2);
  });

  it("does not classify another uniqueness failure as a code collision", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError(
      "Other unique constraint",
      {
        code: "P2002",
        clientVersion: "7.10.0",
        meta: {
          modelName: "ShortLink",
          driverAdapterError: new Error("UniqueConstraintViolation", {
            cause: { constraint: { fields: ["otherField"] } },
          }),
        },
      },
    );
    const insert = vi
      .spyOn(client.shortLink, "create")
      .mockRejectedValueOnce(failure);
    await expect(repository.insert(createTestLink())).rejects.toBe(failure);
    insert.mockRestore();
  });

  it("increments atomically across connections without losing clicks", async () => {
    const original = createTestLink();
    await repository.insert(original);
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 ? repository : secondaryRepository).incrementClick(
          original.code,
        ),
      ),
    );
    expect(await secondaryRepository.listWithStats()).toMatchObject([
      { code: original.code.value, clickCount: 40 },
    ]);
  });

  it("does not create counters for unknown codes or permit negative counts", async () => {
    await expect(
      repository.incrementClick(new ShortCode("Missing1")),
    ).rejects.toThrow();
    expect(await client.shortLink.count()).toBe(0);
    await repository.insert(createTestLink());
    await expect(
      client.shortLink.update({
        where: { code: "Ab12Cd34" },
        data: { clickCount: -1 },
      }),
    ).rejects.toThrow();
    expect(await repository.listWithStats()).toMatchObject([{ clickCount: 0 }]);
  });

  it("lists persisted statistics in the application order with a stable case-sensitive tie-breaker", async () => {
    await repository.insert(
      createTestLink(
        "Old12345",
        "https://older.example",
        "2026-10-14T08:00:00Z",
      ),
    );
    await repository.insert(createTestLink("ab12cd34"));
    await repository.insert(createTestLink("Ab12Cd34"));
    await secondaryRepository.incrementClick(new ShortCode("ab12cd34"));
    const rows = await listShortLinksWithStats(repository);
    expect(rows.map((row) => [row.code, row.clickCount])).toEqual([
      ["Ab12Cd34", 0],
      ["ab12cd34", 1],
      ["Old12345", 0],
    ]);
  });

  it("preserves links and confirmed counters after closing and reopening the database", async () => {
    await repository.insert(createTestLink());
    await repository.incrementClick(new ShortCode("Ab12Cd34"));
    await client.$disconnect();
    await secondaryClient.$disconnect();
    const reopened = createSqliteClient(databaseUrl);
    try {
      const reopenedRepository = new PrismaShortLinkRepository(reopened);
      expect(
        (await reopenedRepository.findByCode(new ShortCode("Ab12Cd34")))
          ?.originalUrl.value,
      ).toBe(createTestLink().originalUrl.value);
      expect(await reopenedRepository.listWithStats()).toMatchObject([
        { clickCount: 1 },
      ]);
    } finally {
      await reopened.$disconnect();
    }
  });

  it("can deploy the migration again without deleting links or counters", async () => {
    await repository.insert(createTestLink());
    await repository.incrementClick(new ShortCode("Ab12Cd34"));
    const result = await migrate();
    expect(result.stdout).toContain("No pending migrations");
    expect(await repository.listWithStats()).toMatchObject([
      { code: "Ab12Cd34", clickCount: 1 },
    ]);
  }, 20_000);

  it("keeps an already resolved destination available when a real write lock prevents counting", async () => {
    await repository.insert(createTestLink());
    const resolved = await resolveShortLink("Ab12Cd34", secondaryRepository);
    expect(resolved).not.toBeNull();
    let release!: () => void;
    let acquired!: () => void;
    const locked = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const transaction = client.$transaction(async (transactionClient) => {
      await transactionClient.shortLink.update({
        where: { code: "Ab12Cd34" },
        data: { clickCount: 1 },
      });
      acquired();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    await locked;
    const onFailure = vi.fn();
    try {
      await recordClick(resolved!.code, {
        statistics: secondaryRepository,
        onFailure,
      });
      expect(onFailure).toHaveBeenCalledExactlyOnceWith("write-failed");
      expect(resolved!.originalUrl.value).toBe(
        createTestLink().originalUrl.value,
      );
    } finally {
      release();
      await transaction;
    }
    expect(await repository.listWithStats()).toMatchObject([{ clickCount: 1 }]);
  });
});

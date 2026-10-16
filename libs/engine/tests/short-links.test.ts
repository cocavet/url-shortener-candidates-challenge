import { describe, expect, it, vi } from "vitest";
import {
  createShortLink,
  resolveShortLink,
  listShortLinksWithStats,
} from "../src/application/short-links";
import {
  InvalidOriginalUrlError,
  ShortCodeCollisionError,
  ShortCodeExhaustedError,
} from "../src/errors/short-link-errors";
import type {
  ShortLinkRepository,
  ShortLinkWithStats,
} from "../src/contracts/short-link-repository";
import { ShortCode } from "../src/domain/short-code";
import type { ShortLink } from "../src/domain/short-link";

// This test adapter models insert-only storage, not database concurrency or durability.
class MemoryShortLinkRepository implements ShortLinkRepository {
  private readonly links = new Map<string, ShortLink>();

  async insert(link: ShortLink): Promise<void> {
    if (this.links.has(link.code.value)) throw new ShortCodeCollisionError();
    this.links.set(link.code.value, link);
  }

  async findByCode(code: ShortCode): Promise<ShortLink | null> {
    return this.links.get(code.value) ?? null;
  }

  async listWithStats(): Promise<readonly ShortLinkWithStats[]> {
    return [...this.links.values()].map((link) => ({
      code: link.code.value,
      originalUrl: link.originalUrl.value,
      createdAt: link.createdAt,
      clickCount: 0,
    }));
  }
}

function createShortLinkDependencies(...candidates: string[]) {
  const repository = new MemoryShortLinkRepository();
  const generateCode = vi.fn(() => new ShortCode(candidates.shift()));
  const now = vi.fn(() => new Date("2026-10-15T08:00:00Z"));
  return { repository, generateCode, now };
}

describe("createShortLink", () => {
  it("returns a persisted destination with a controlled creation date", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34");
    const link = await createShortLink(
      "  https://example.com/path?q=one#section  ",
      dependencies,
    );
    expect(link.originalUrl.value).toBe(
      "https://example.com/path?q=one#section",
    );
    expect(link.createdAt.toISOString()).toBe("2026-10-15T08:00:00.000Z");
    expect(await dependencies.repository.findByCode(link.code)).toBe(link);
    expect(dependencies.now).toHaveBeenCalledTimes(1);
  });

  it("allows the same destination under distinct, case-sensitive identities", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34", "ab12cd34");
    const first = await createShortLink("https://example.com", dependencies);
    const second = await createShortLink("https://example.com", dependencies);
    expect(first.code.value).not.toBe(second.code.value);
    expect(await dependencies.repository.findByCode(first.code)).toBe(first);
    expect(await dependencies.repository.findByCode(second.code)).toBe(second);
    expect(await listShortLinksWithStats(dependencies.repository)).toHaveLength(
      2,
    );
  });

  it("recovers from a code collision without replacing the first link", async () => {
    const dependencies = createShortLinkDependencies(
      "Ab12Cd34",
      "Ab12Cd34",
      "Cd34Ef56",
    );
    const first = await createShortLink("https://first.example", dependencies);
    const second = await createShortLink(
      "https://second.example",
      dependencies,
    );
    expect(second.code.value).toBe("Cd34Ef56");
    expect(await dependencies.repository.findByCode(first.code)).toBe(first);
    expect(first.originalUrl.value).toBe("https://first.example");
    expect(dependencies.generateCode).toHaveBeenCalledTimes(3);
  });

  it("stops after five collisions and preserves existing data", async () => {
    const dependencies = createShortLinkDependencies(
      ...Array(6).fill("Ab12Cd34"),
    );
    const original = await createShortLink(
      "https://first.example",
      dependencies,
    );
    dependencies.generateCode.mockClear();
    await expect(
      createShortLink("https://second.example", dependencies),
    ).rejects.toThrow(ShortCodeExhaustedError);
    expect(dependencies.generateCode).toHaveBeenCalledTimes(5);
    expect(await dependencies.repository.findByCode(original.code)).toBe(
      original,
    );
    expect(await listShortLinksWithStats(dependencies.repository)).toHaveLength(
      1,
    );
  });

  it("can succeed on the fifth attempt", async () => {
    const dependencies = createShortLinkDependencies(
      "Ab12Cd34",
      ...Array(4).fill("Ab12Cd34"),
      "Cd34Ef56",
    );
    await createShortLink("https://first.example", dependencies);
    dependencies.generateCode.mockClear();
    const result = await createShortLink(
      "https://second.example",
      dependencies,
    );
    expect(result.code.value).toBe("Cd34Ef56");
    expect(dependencies.generateCode).toHaveBeenCalledTimes(5);
  });

  it("does not retry storage failures, even when they mention uniqueness", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34");
    const failure = new Error("Unique constraint failure on a different field");
    const insert = vi
      .spyOn(dependencies.repository, "insert")
      .mockRejectedValue(failure);
    await expect(
      createShortLink("https://example.com", dependencies),
    ).rejects.toBe(failure);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(dependencies.generateCode).toHaveBeenCalledTimes(1);
    expect(await listShortLinksWithStats(dependencies.repository)).toEqual([]);
  });

  it("waits for the write to complete before confirming creation", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34");
    let completeWrite!: () => void;
    const actualInsert = dependencies.repository.insert.bind(
      dependencies.repository,
    );
    vi.spyOn(dependencies.repository, "insert").mockImplementation(
      async (link) => {
        await new Promise<void>((resolve) => {
          completeWrite = resolve;
        });
        await actualInsert(link);
      },
    );
    const confirmed = vi.fn();
    const pending = createShortLink("https://example.com", dependencies).then(
      (link) => {
        confirmed();
        return link;
      },
    );
    await Promise.resolve();
    expect(confirmed).not.toHaveBeenCalled();
    expect(await dependencies.repository.listWithStats()).toEqual([]);
    completeWrite();
    const link = await pending;
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(await dependencies.repository.findByCode(link.code)).toBe(link);
  });

  it("validates before generating a candidate or accessing storage", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34");
    const insert = vi.spyOn(dependencies.repository, "insert");
    await expect(
      createShortLink("javascript:alert(1)", dependencies),
    ).rejects.toThrow(InvalidOriginalUrlError);
    expect(dependencies.generateCode).not.toHaveBeenCalled();
    expect(dependencies.now).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("resolveShortLink", () => {
  it("returns the stored link and respects case", async () => {
    const dependencies = createShortLinkDependencies("Ab12Cd34");
    const link = await createShortLink(
      "https://example.com/path?q=one#section",
      dependencies,
    );
    expect(await resolveShortLink("Ab12Cd34", dependencies.repository)).toBe(
      link,
    );
    expect(
      await resolveShortLink("ab12cd34", dependencies.repository),
    ).toBeNull();
  });

  it("returns null for an unknown valid code", async () => {
    expect(
      await resolveShortLink("Ab12Cd34", new MemoryShortLinkRepository()),
    ).toBeNull();
  });

  it.each([null, undefined, "short", "Ab12Cd34\n", "Ab12-C34", 12345678])(
    "does not query storage for invalid code %j",
    async (input) => {
      const repository = new MemoryShortLinkRepository();
      const read = vi.spyOn(repository, "findByCode");
      expect(await resolveShortLink(input, repository)).toBeNull();
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("propagates read failures instead of reporting not found", async () => {
    const repository = new MemoryShortLinkRepository();
    const failure = new Error("Storage unavailable");
    vi.spyOn(repository, "findByCode").mockRejectedValue(failure);
    await expect(resolveShortLink("Ab12Cd34", repository)).rejects.toBe(
      failure,
    );
  });
});

describe("listShortLinksWithStats", () => {
  it("returns an empty list when no links exist", async () => {
    expect(
      await listShortLinksWithStats(new MemoryShortLinkRepository()),
    ).toEqual([]);
  });

  it("orders newest first with code ascending on ties, without mutating storage results", async () => {
    const repository = new MemoryShortLinkRepository();
    const older = new Date("2026-10-14T08:00:00Z");
    const newer = new Date("2026-10-15T08:00:00Z");
    const rows = Object.freeze([
      {
        code: "Old12345",
        originalUrl: "https://older.example",
        createdAt: older,
        clickCount: 7,
      },
      {
        code: "ab12cd34",
        originalUrl: "https://example.com",
        createdAt: newer,
        clickCount: 2,
      },
      {
        code: "Ab12Cd34",
        originalUrl: "https://example.com",
        createdAt: newer,
        clickCount: 0,
      },
    ]);
    vi.spyOn(repository, "listWithStats").mockResolvedValue(rows);
    expect(await listShortLinksWithStats(repository)).toEqual([
      rows[2],
      rows[1],
      rows[0],
    ]);
    expect(await listShortLinksWithStats(repository)).toEqual([
      rows[2],
      rows[1],
      rows[0],
    ]);
    expect(rows.map((row) => row.code)).toEqual([
      "Old12345",
      "ab12cd34",
      "Ab12Cd34",
    ]);
  });

  it("propagates read failures instead of hiding them as an empty list", async () => {
    const repository = new MemoryShortLinkRepository();
    const failure = new Error("Storage unavailable");
    vi.spyOn(repository, "listWithStats").mockRejectedValue(failure);
    await expect(listShortLinksWithStats(repository)).rejects.toBe(failure);
  });
});

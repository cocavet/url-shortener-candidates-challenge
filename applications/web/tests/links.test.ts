import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppLoadContext } from "react-router";
import { OriginalUrl, ShortCode, ShortLink } from "@url-shortener/engine";
import type { ShortLinkWithStats } from "@url-shortener/engine";
import {
  createLink,
  listLinks,
  redirectLink,
} from "../app/server/links.server";
import { readServerConfig } from "../app/server/config.server";
import { CreationRateLimiter } from "../app/server/rate-limit.server";

const existingLink = new ShortLink(
  new ShortCode("Ab12Cd34"),
  new OriginalUrl("https://example.com/path?q=one#section"),
  new Date("2026-10-15T08:00:00Z"),
);

function createTestContext() {
  const repository = {
    insert: vi
      .fn<(link: ShortLink) => Promise<void>>()
      .mockResolvedValue(undefined),
    findByCode: vi
      .fn<(code: ShortCode) => Promise<ShortLink | null>>()
      .mockResolvedValue(existingLink),
    listWithStats: vi
      .fn<() => Promise<readonly ShortLinkWithStats[]>>()
      .mockResolvedValue([]),
    incrementClick: vi
      .fn<(code: ShortCode) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const context: AppLoadContext = {
    clientAddress: "127.0.0.1",
    services: {
      config: readServerConfig({ PUBLIC_URL: "https://short.example" }),
      repository,
      creationLimiter: new CreationRateLimiter(10, 60_000),
      close: async () => {},
    },
  };
  return { context, repository };
}

function createCreationRequest(
  value = "https://example.com/path?q=one#section",
  headers?: HeadersInit,
) {
  return new Request("https://untrusted-host.example/?index", {
    method: "POST",
    body: new URLSearchParams({ url: value }),
    headers,
  });
}

afterEach(() => vi.useRealTimers());

describe("creation HTTP adapter", () => {
  it("creates a persisted link and returns 201 with the configured origin", async () => {
    const { context, repository } = createTestContext();
    const result = await createLink(createCreationRequest(), context);
    expect(result.init?.status).toBe(201);
    expect(result.data.shortenedUrl).toMatch(
      /^https:\/\/short\.example\/s\/[A-Za-z0-9]{8}$/,
    );
    expect(result.data.submittedUrl).toBe(existingLink.originalUrl.value);
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(repository.insert.mock.calls[0][0].originalUrl.value).toBe(
      existingLink.originalUrl.value,
    );
    expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
      "no-store",
    );
  });

  it.each([
    "",
    "/relative",
    "javascript:alert(1)",
    "https://user:secret@example.com",
  ])("returns 400 without writing for invalid URL %s", async (value) => {
    const { context, repository } = createTestContext();
    const result = await createLink(createCreationRequest(value), context);
    expect(result.init?.status).toBe(400);
    expect(result.data.error).toBeTruthy();
    expect(result.data.submittedUrl).toBe(value);
    expect(result.data.invalidUrl).toBe(true);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("returns 400 for missing or non-textual form values", async () => {
    const { context, repository } = createTestContext();
    const uploaded = new FormData();
    uploaded.append("url", new Blob(["https://example.com"]), "url.txt");
    for (const body of [new FormData(), uploaded]) {
      const result = await createLink(
        new Request("https://short.example/?index", { method: "POST", body }),
        context,
      );
      expect(result.init?.status).toBe(400);
    }
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed form encoding", async () => {
    const { context, repository } = createTestContext();
    const result = await createLink(
      new Request("https://short.example/?index", {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      context,
    );
    expect(result.init?.status).toBe(400);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("returns 503 without leaking storage details", async () => {
    const { context, repository } = createTestContext();
    repository.insert.mockRejectedValue(
      new Error("Private database path and stack"),
    );
    const result = await createLink(createCreationRequest(), context);
    expect(result.init?.status).toBe(503);
    expect(JSON.stringify(result.data)).not.toContain("Private");
    expect(result.data.submittedUrl).toBe(existingLink.originalUrl.value);
    expect(result.data.invalidUrl).toBe(false);
  });

  it("returns 413 without writing and closes the oversized body connection", async () => {
    const { context, repository } = createTestContext();
    const result = await createLink(
      createCreationRequest(`https://example.com/${"x".repeat(33_000)}`),
      context,
    );
    expect(result.init?.status).toBe(413);
    expect(result.data.error).toContain("32 KiB");
    expect(new Headers(result.init?.headers).get("Connection")).toBe("close");
    expect(new Headers(result.init?.headers).get("Cache-Control")).toBe(
      "no-store",
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("accepts a valid 2048-character Unicode URL after form encoding", async () => {
    const { context, repository } = createTestContext();
    const value = "https://example.com/".padEnd(2048, "€");
    const result = await createLink(createCreationRequest(value), context);
    expect(result.init?.status).toBe(201);
    expect(repository.insert.mock.calls[0][0].originalUrl.value).toBe(value);
  });

  it("returns 429 and Retry-After without reading or writing, regardless of forwarded headers", async () => {
    const { context, repository } = createTestContext();
    context.services.creationLimiter = new CreationRateLimiter(1, 60_000);
    await createLink(
      createCreationRequest(undefined, { "X-Forwarded-For": "192.0.2.1" }),
      context,
    );
    const second = createCreationRequest(undefined, {
      "X-Forwarded-For": "192.0.2.2",
    });
    const readForm = vi.spyOn(second, "formData");
    const readBody = vi.spyOn(second.body!, "getReader");
    const result = await createLink(second, context);
    expect(result.init?.status).toBe(429);
    expect(
      Number(new Headers(result.init?.headers).get("Retry-After")),
    ).toBeGreaterThan(0);
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(readForm).not.toHaveBeenCalled();
    expect(readBody).not.toHaveBeenCalled();
  });

  it("counts rejected validation attempts toward the same quota", async () => {
    const { context, repository } = createTestContext();
    context.services.creationLimiter = new CreationRateLimiter(1, 60_000);
    expect(
      (await createLink(createCreationRequest("bad"), context)).init?.status,
    ).toBe(400);
    expect(
      (await createLink(createCreationRequest(), context)).init?.status,
    ).toBe(429);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("fails closed without a trusted socket identity", async () => {
    const { context, repository } = createTestContext();
    context.clientAddress = "";
    expect(
      (await createLink(createCreationRequest(), context)).init?.status,
    ).toBe(503);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods", async () => {
    const { context, repository } = createTestContext();
    const result = await createLink(
      new Request("https://short.example", { method: "PUT" }),
      context,
    );
    expect(result.init?.status).toBe(405);
    expect(new Headers(result.init?.headers).get("Allow")).toBe("POST");
    expect(repository.insert).not.toHaveBeenCalled();
  });
});

describe("listing HTTP adapter", () => {
  it("serializes persisted statistics and builds absolute URLs from configuration", async () => {
    const { context, repository } = createTestContext();
    repository.listWithStats.mockResolvedValue([
      {
        code: existingLink.code.value,
        originalUrl: existingLink.originalUrl.value,
        createdAt: existingLink.createdAt,
        clickCount: 3,
      },
    ]);
    const result = await listLinks(context);
    expect(result.data.links).toEqual([
      {
        code: "Ab12Cd34",
        originalUrl: existingLink.originalUrl.value,
        createdAt: "2026-10-15T08:00:00.000Z",
        clickCount: 3,
        shortenedUrl: "https://short.example/s/Ab12Cd34",
      },
    ]);
  });

  it("throws a sanitized 503 for read failures", async () => {
    const { context, repository } = createTestContext();
    repository.listWithStats.mockRejectedValue(
      new Error("Private database information"),
    );
    const error = await listLinks(context).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Response);
    if (error instanceof Response) {
      expect(error.status).toBe(503);
      expect(await error.text()).not.toContain("Private");
    }
  });
});

describe("redirect HTTP adapter", () => {
  describe.each(["GET", "HEAD"])("%s destination serialization", (method) => {
    it.each([
      ["https://例え.jp/path", "https://xn--r8jz45g.jp/path"],
      [
        "https://example.com/€?q=niño#sección",
        "https://example.com/%E2%82%AC?q=ni%C3%B1o#secci%C3%B3n",
      ],
      ["https://example.com/café", "https://example.com/caf%C3%A9"],
      [
        "https://example.com/a%2Fb?q=%E2%82%AC#section",
        "https://example.com/a%2Fb?q=%E2%82%AC#section",
      ],
    ])(
      "serializes %s for Location without changing the stored URL",
      async (originalUrl, expectedLocation) => {
        const { context, repository } = createTestContext();
        const link = new ShortLink(
          existingLink.code,
          new OriginalUrl(originalUrl),
          existingLink.createdAt,
        );
        repository.findByCode.mockResolvedValue(link);

        const response = await redirectLink(
          new Request("https://short.example/s/Ab12Cd34", { method }),
          "Ab12Cd34",
          context,
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe(expectedLocation);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(await response.text()).toBe("");
        expect(link.originalUrl.value).toBe(originalUrl);
        expect(repository.incrementClick).toHaveBeenCalledTimes(
          method === "GET" ? 1 : 0,
        );
      },
    );
  });

  it("returns a non-cacheable 302 after a confirmed increment on GET", async () => {
    const { context, repository } = createTestContext();
    const response = await redirectLink(
      new Request("https://short.example/s/Ab12Cd34"),
      "Ab12Cd34",
      context,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      existingLink.originalUrl.value,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(repository.incrementClick).toHaveBeenCalledExactlyOnceWith(
      existingLink.code,
    );
  });

  it("returns the same redirect without a body or increment for HEAD", async () => {
    const { context, repository } = createTestContext();
    const response = await redirectLink(
      new Request("https://short.example/s/Ab12Cd34", { method: "HEAD" }),
      "Ab12Cd34",
      context,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      existingLink.originalUrl.value,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(repository.incrementClick).not.toHaveBeenCalled();
  });

  it("returns 404 without counting an unknown or malformed code", async () => {
    const { context, repository } = createTestContext();
    repository.findByCode.mockResolvedValue(null);
    for (const code of ["Missing1", "invalid"]) {
      const response = await redirectLink(
        new Request(`https://short.example/s/${code}`),
        code,
        context,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(repository.findByCode).toHaveBeenCalledTimes(1);
    expect(repository.incrementClick).not.toHaveBeenCalled();
  });

  it("returns 503 on a destination read failure", async () => {
    const { context, repository } = createTestContext();
    repository.findByCode.mockRejectedValue(new Error("Private read failure"));
    const response = await redirectLink(
      new Request("https://short.example/s/Ab12Cd34"),
      "Ab12Cd34",
      context,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private");
    expect(repository.incrementClick).not.toHaveBeenCalled();
  });

  it("preserves the redirect on a failed counter write and emits only a safe diagnostic", async () => {
    const { context, repository } = createTestContext();
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => {});
    repository.incrementClick.mockRejectedValue(
      new Error("Private write failure"),
    );
    const response = await redirectLink(
      new Request("https://short.example/s/Ab12Cd34"),
      "Ab12Cd34",
      context,
    );
    expect(response.status).toBe(302);
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
      "click-recording-failed",
      "write-failed",
    );
    expect(repository.incrementClick).toHaveBeenCalledTimes(1);
  });

  it("preserves the redirect when counter recording exceeds its deadline", async () => {
    vi.useFakeTimers();
    const { context, repository } = createTestContext();
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => {});
    repository.incrementClick.mockImplementation(
      () => new Promise<void>(() => {}),
    );
    const pending = redirectLink(
      new Request("https://short.example/s/Ab12Cd34"),
      "Ab12Cd34",
      context,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).status).toBe(302);
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
      "click-recording-failed",
      "timeout",
    );
    expect(repository.incrementClick).toHaveBeenCalledTimes(1);
  });

  it("returns 405 for unsupported methods without accessing storage", async () => {
    const { context, repository } = createTestContext();
    const response = await redirectLink(
      new Request("https://short.example/s/Ab12Cd34", { method: "POST" }),
      "Ab12Cd34",
      context,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(repository.findByCode).not.toHaveBeenCalled();
  });
});

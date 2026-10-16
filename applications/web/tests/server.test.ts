import { describe, expect, it } from "vitest";
import { ServerConfigurationError } from "../app/server/errors/http-errors";
import { readServerConfig } from "../app/server/config.server";
import { CreationRateLimiter } from "../app/server/rate-limit.server";

describe("server configuration", () => {
  it("normalizes the public origin and provides explicit development defaults", () => {
    expect(
      readServerConfig({ PUBLIC_URL: " HTTPS://EXAMPLE.COM:443/ " }),
    ).toEqual({
      publicUrl: "https://example.com",
      databaseUrl: "file:./dev.db",
      host: "127.0.0.1",
      port: 5173,
      creationLimit: 10,
      creationWindowMs: 60_000,
      clickTimeoutMs: 1000,
    });
  });

  it("supports production and configurable limits", () => {
    expect(
      readServerConfig({
        NODE_ENV: "production",
        PUBLIC_URL: "http://localhost:3000",
        DATABASE_URL: "file:/data/links.db",
        CREATION_RATE_LIMIT: "20",
        CREATION_RATE_WINDOW_MS: "30000",
        CLICK_RECORDING_TIMEOUT_MS: "500",
      }),
    ).toMatchObject({
      port: 3000,
      host: "0.0.0.0",
      creationLimit: 20,
      creationWindowMs: 30_000,
      clickTimeoutMs: 500,
    });
  });

  it.each([
    undefined,
    "",
    "/relative",
    "https:///example.com",
    "ftp://example.com",
    "https://user:secret@example.com",
    "https://@example.com",
    "https://example.com/path",
    "https://example.com?query=1",
    "https://example.com#fragment",
    "https://exam\nple.com",
    "https://example.com\\path",
  ])(
    "rejects invalid PUBLIC_URL without including its value in the error: %s",
    (value) => {
      expect(() => readServerConfig({ PUBLIC_URL: value })).toThrow(
        ServerConfigurationError,
      );
      expect(() => readServerConfig({ PUBLIC_URL: value })).toThrow(
        "PUBLIC_URL",
      );
    },
  );

  it.each(["", "postgres://localhost/db", "file:", "file: \t"])(
    "rejects invalid DATABASE_URL: %s",
    (value) => {
      expect(() =>
        readServerConfig({
          PUBLIC_URL: "https://example.com",
          DATABASE_URL: value,
        }),
      ).toThrow("DATABASE_URL");
    },
  );

  it.each([
    ["PORT", "0"],
    ["PORT", "65536"],
    ["CREATION_RATE_LIMIT", "-1"],
    ["CREATION_RATE_LIMIT", "1abc"],
    ["CREATION_RATE_WINDOW_MS", "1.5"],
    ["PORT", " 3000"],
    ["PORT", "3e3"],
    ["PORT", "3000.0"],
    ["CLICK_RECORDING_TIMEOUT_MS", "0"],
    ["CLICK_RECORDING_TIMEOUT_MS", "2147483648"],
  ])("rejects an invalid numeric option %s=%s", (name, value) => {
    expect(() =>
      readServerConfig({ PUBLIC_URL: "https://example.com", [name]: value }),
    ).toThrow(name);
  });
});

describe("creation rate limiter", () => {
  it("tracks independent clients and returns remaining seconds when the window is exhausted", () => {
    let time = 0;
    const limiter = new CreationRateLimiter(2, 60_000, 10, () => time);
    expect(limiter.consume("first")).toBe(0);
    expect(limiter.consume("second")).toBe(0);
    expect(limiter.consume("first")).toBe(0);
    time = 1500;
    expect(limiter.consume("first")).toBe(59);
    expect(limiter.consume("second")).toBe(0);
    time = 60_000;
    expect(limiter.consume("first")).toBe(0);
  });

  it("bounds memory without evicting active clients and resetting their quotas", () => {
    let time = 0;
    const limiter = new CreationRateLimiter(1, 60_000, 2, () => time);
    expect(limiter.consume("first")).toBe(0);
    time = 1000;
    expect(limiter.consume("second")).toBe(0);
    expect(limiter.consume("third")).toBe(59);
    expect(limiter.consume("first")).toBe(59);
    time = 60_000;
    expect(limiter.consume("third")).toBe(0);
    expect(limiter.consume("second")).toBe(1);
  });
});

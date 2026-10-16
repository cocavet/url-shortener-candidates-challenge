import { describe, expect, it } from "vitest";
import { OriginalUrl } from "../src/domain/original-url";
import { ShortCode } from "../src/domain/short-code";
import {
  InvalidOriginalUrlError,
  InvalidShortCodeError,
} from "../src/errors/short-link-errors";
import { ShortLink } from "../src/domain/short-link";

describe("OriginalUrl", () => {
  it.each([
    "https://example.com/path?q=one#section",
    "http://localhost:3000/path",
    "HTTPS://EXAMPLE.COM/Case?b=2&a=1#Fragment",
    "https://例え.jp/path",
  ])("trims outer whitespace and preserves the accepted URL: %s", (value) => {
    expect(new OriginalUrl(` \t${value}\n `).value).toBe(value);
  });

  it.each([
    "",
    " \t ",
    null,
    undefined,
    42,
    {},
    ["https://example.com"],
    "/relative",
    "example.com",
    "//example.com",
    "https:",
    "https:///path",
    "https://?query",
    "https://#fragment",
    "https://",
    "ftp://example.com",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "https://user@example.com",
    "https://user:pass@example.com",
    "https://@example.com",
    "https://exam\nple.com",
    "https://example.com/path\r\nInjected: value",
    "https://example.com/\u0000",
  ])("rejects invalid input: %j", (input) => {
    expect(() => new OriginalUrl(input)).toThrow(InvalidOriginalUrlError);
  });

  it("checks the exact length limit after trimming without truncating", () => {
    const value = "https://example.com/".padEnd(2048, "a");
    expect(new OriginalUrl(` ${value} `).value).toBe(value);
    expect(() => new OriginalUrl(`${value}a`)).toThrow(InvalidOriginalUrlError);
  });

  it("cannot be changed after validation", () => {
    const url = new OriginalUrl("https://example.com");
    expect(() => Object.assign(url, { value: "javascript:alert(1)" })).toThrow(
      TypeError,
    );
    expect(url.value).toBe("https://example.com");
  });
});

describe("ShortCode", () => {
  it.each(["Ab12Cd34", "ab12cd34", "01234567", "ABCDEFGH"])(
    "preserves the exact identity: %s",
    (value) => {
      expect(new ShortCode(value).value).toBe(value);
    },
  );

  it.each([
    null,
    undefined,
    12345678,
    {},
    "",
    "Ab12Cd3",
    "Ab12Cd345",
    " Ab12Cd34 ",
    "Ab12-C34",
    "Ab12/C34",
    "áB12Cd34",
    "Ab12Cd34\n",
    "Ab12Cd3\n",
  ])("rejects invalid code: %j", (input) => {
    expect(() => new ShortCode(input)).toThrow(InvalidShortCodeError);
  });

  it("cannot change identity after validation", () => {
    const code = new ShortCode("Ab12Cd34");
    expect(() => Object.assign(code, { value: "Cd34Ef56" })).toThrow(TypeError);
    expect(code.value).toBe("Ab12Cd34");
  });
});

describe("ShortLink", () => {
  it("associates immutable identity, destination and creation date", () => {
    const code = new ShortCode("Ab12Cd34");
    const url = new OriginalUrl("https://example.com");
    const date = new Date("2026-10-15T08:00:00Z");
    const link = new ShortLink(code, url, date);

    expect(link.code).toBe(code);
    expect(link.originalUrl).toBe(url);
    expect(link.createdAt).toEqual(date);
    expect(() =>
      Object.assign(link, { code: new ShortCode("Cd34Ef56") }),
    ).toThrow(TypeError);
    expect(() =>
      Object.assign(link, {
        originalUrl: new OriginalUrl("https://other.example"),
      }),
    ).toThrow(TypeError);
  });

  it("protects its date against mutations of the supplied and returned Date", () => {
    const date = new Date("2026-10-15T08:00:00Z");
    const link = new ShortLink(
      new ShortCode("Ab12Cd34"),
      new OriginalUrl("https://example.com"),
      date,
    );
    date.setUTCFullYear(2000);
    link.createdAt.setUTCFullYear(2001);
    expect(link.createdAt.toISOString()).toBe("2026-10-15T08:00:00.000Z");
  });

  it("rejects an invalid creation date", () => {
    expect(
      () =>
        new ShortLink(
          new ShortCode("Ab12Cd34"),
          new OriginalUrl("https://example.com"),
          new Date(NaN),
        ),
    ).toThrow("Invalid creation date");
  });
});

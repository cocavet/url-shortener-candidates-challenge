import { describe, expect, it } from "vitest";
import {
  isPositiveIntegerWithin,
  MAX_SIGNED_32_BIT_INTEGER,
} from "../src/validators/positive-integer";
import { isSqliteFileUrl } from "../src/validators/sqlite-url";

describe("positive integer validation", () => {
  it.each([1, MAX_SIGNED_32_BIT_INTEGER])(
    "accepts the inclusive boundary %s",
    (value) => {
      expect(isPositiveIntegerWithin(value, MAX_SIGNED_32_BIT_INTEGER)).toBe(
        true,
      );
    },
  );

  it.each([
    0,
    -1,
    0.5,
    NaN,
    Infinity,
    MAX_SIGNED_32_BIT_INTEGER + 1,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects an invalid or out-of-range integer: %s", (value) => {
    expect(isPositiveIntegerWithin(value, MAX_SIGNED_32_BIT_INTEGER)).toBe(
      false,
    );
  });

  it("uses the caller's upper limit instead of imposing a timeout-specific range", () => {
    expect(isPositiveIntegerWithin(65_535, 65_535)).toBe(true);
    expect(isPositiveIntegerWithin(65_536, 65_535)).toBe(false);
    expect(
      isPositiveIntegerWithin(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    ).toBe(true);
    expect(
      isPositiveIntegerWithin(
        Number.MAX_SAFE_INTEGER + 1,
        Number.MAX_SAFE_INTEGER + 1,
      ),
    ).toBe(false);
  });
});

describe("SQLite file URL validation", () => {
  it.each(["file:./dev.db", "file:/data/links.db"])(
    "accepts relative and absolute file paths: %s",
    (value) => {
      expect(isSqliteFileUrl(value)).toBe(true);
    },
  );

  it.each([
    "",
    "file:",
    "file: \t",
    "FILE:/data/links.db",
    "postgres://localhost/db",
  ])("rejects missing paths and unsupported schemes: %s", (value) => {
    expect(isSqliteFileUrl(value)).toBe(false);
  });
});

export const SHORT_CODE_LENGTH = 8;

export function isValidShortCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === SHORT_CODE_LENGTH &&
    !/[^A-Za-z0-9]/.test(value)
  );
}

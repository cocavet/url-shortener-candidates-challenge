export function isSqliteFileUrl(value: string): boolean {
  return value.startsWith("file:") && value.slice(5).trim().length > 0;
}

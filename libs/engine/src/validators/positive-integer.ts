export const MAX_SIGNED_32_BIT_INTEGER = 2_147_483_647;

export function isPositiveIntegerWithin(
  value: number,
  maximum: number,
): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

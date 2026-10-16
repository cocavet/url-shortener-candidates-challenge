export { OriginalUrl } from "./domain/original-url";
export { ShortCode } from "./domain/short-code";
export { ShortLink } from "./domain/short-link";
export {
  isPositiveIntegerWithin,
  MAX_SIGNED_32_BIT_INTEGER,
} from "./validators/positive-integer";
export { isValidHttpOrigin } from "./validators/http-url";
export { isSqliteFileUrl } from "./validators/sqlite-url";
export {
  InvalidOriginalUrlError,
  InvalidShortCodeError,
  ShortCodeCollisionError,
  ShortCodeExhaustedError,
} from "./errors/short-link-errors";
export type {
  ShortLinkRepository,
  ShortLinkWithStats,
  ClickStatisticsRepository,
} from "./contracts/short-link-repository";
export { recordClick } from "./application/record-click";
export {
  createShortLink,
  resolveShortLink,
  listShortLinksWithStats,
} from "./application/short-links";

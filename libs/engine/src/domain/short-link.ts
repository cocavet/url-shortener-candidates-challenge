import { ENGINE_ERROR_MESSAGES } from "../errors/messages/engine-error-messages";
import type { OriginalUrl } from "./original-url";
import type { ShortCode } from "./short-code";

export class ShortLink {
  readonly #createdAtTimestamp: number;

  constructor(
    readonly code: ShortCode,
    readonly originalUrl: OriginalUrl,
    createdAt: Date,
  ) {
    const createdAtTimestamp = createdAt.getTime();
    if (!Number.isFinite(createdAtTimestamp)) {
      throw new Error(ENGINE_ERROR_MESSAGES.invalidCreationDate);
    }
    this.#createdAtTimestamp = createdAtTimestamp;
    Object.freeze(this);
  }

  get createdAt(): Date {
    return new Date(this.#createdAtTimestamp);
  }
}

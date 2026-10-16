import { ENGINE_ERROR_MESSAGES } from "./messages/engine-error-messages";

export class InvalidOriginalUrlError extends Error {
  constructor() {
    super(ENGINE_ERROR_MESSAGES.invalidOriginalUrl);
    this.name = "InvalidOriginalUrlError";
  }
}

export class InvalidShortCodeError extends Error {
  constructor() {
    super(ENGINE_ERROR_MESSAGES.invalidShortCode);
    this.name = "InvalidShortCodeError";
  }
}

export class ShortCodeCollisionError extends Error {
  constructor() {
    super(ENGINE_ERROR_MESSAGES.shortCodeCollision);
    this.name = "ShortCodeCollisionError";
  }
}

export class ShortCodeExhaustedError extends Error {
  constructor() {
    super(ENGINE_ERROR_MESSAGES.shortCodeExhausted);
    this.name = "ShortCodeExhaustedError";
  }
}

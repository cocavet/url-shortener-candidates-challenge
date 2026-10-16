import { InvalidOriginalUrlError } from "../errors/short-link-errors";
import { isValidOriginalUrl } from "../validators/http-url";

export class OriginalUrl {
  readonly #value: string;

  constructor(input: unknown) {
    if (typeof input !== "string") throw new InvalidOriginalUrlError();
    const value = input.trim();
    if (!isValidOriginalUrl(value)) throw new InvalidOriginalUrlError();

    this.#value = value;
    Object.freeze(this);
  }

  get value(): string {
    return this.#value;
  }
}

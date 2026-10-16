import { InvalidShortCodeError } from "../errors/short-link-errors";
import { isValidShortCode } from "../validators/short-code";

export class ShortCode {
  readonly #value: string;

  constructor(input: unknown) {
    if (!isValidShortCode(input)) {
      throw new InvalidShortCodeError();
    }
    this.#value = input;
    Object.freeze(this);
  }

  get value(): string {
    return this.#value;
  }
}

import { randomInt } from "node:crypto";
import { ShortCode } from "../domain/short-code";
import { SHORT_CODE_LENGTH } from "../validators/short-code";

const SHORT_CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateCryptoShortCode(): ShortCode {
  const characters = Array.from({ length: SHORT_CODE_LENGTH }, () => {
    const characterIndex = randomInt(SHORT_CODE_ALPHABET.length);
    return SHORT_CODE_ALPHABET[characterIndex];
  });
  return new ShortCode(characters.join(""));
}

import { expect, it, vi } from "vitest";
import { generateCryptoShortCode } from "../src/infrastructure/crypto-short-code";

const { randomIndex } = vi.hoisted(() => ({
  randomIndex: vi.fn<(max: number) => number>(),
}));
vi.mock("node:crypto", () => ({ randomInt: randomIndex }));

it("uses cryptographic random indices over all 62 symbols for eight characters", () => {
  [0, 25, 26, 51, 52, 61, 1, 27].forEach((index) =>
    randomIndex.mockReturnValueOnce(index),
  );
  expect(generateCryptoShortCode().value).toBe("AZaz09Bb");
  expect(randomIndex).toHaveBeenCalledTimes(8);
  expect(
    randomIndex.mock.calls.every((args) => args.length === 1 && args[0] === 62),
  ).toBe(true);
});

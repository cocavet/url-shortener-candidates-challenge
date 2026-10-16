import type { RecordClickDependencies } from "../contracts/record-click";
import type { ShortCode } from "../domain/short-code";
import { ENGINE_ERROR_MESSAGES } from "../errors/messages/engine-error-messages";
import {
  isPositiveIntegerWithin,
  MAX_SIGNED_32_BIT_INTEGER,
} from "../validators/positive-integer";

export async function recordClick(
  code: ShortCode,
  { statistics, onFailure, timeoutMs = 1000 }: RecordClickDependencies,
): Promise<void> {
  if (!isPositiveIntegerWithin(timeoutMs, MAX_SIGNED_32_BIT_INTEGER)) {
    throw new Error(ENGINE_ERROR_MESSAGES.invalidClickTimeout);
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const incrementResult = Promise.resolve()
      .then(() => statistics.incrementClick(code))
      .then(
        () => "recorded" as const,
        () => "write-failed" as const,
      );
    const timeoutResult = new Promise<"timeout">((resolve) => {
      timeoutHandle = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const recordingResult = await Promise.race([
      incrementResult,
      timeoutResult,
    ]);
    if (recordingResult !== "recorded") {
      try {
        onFailure(recordingResult);
      } catch {
        // A diagnostic failure must not prevent the redirect either.
      }
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}

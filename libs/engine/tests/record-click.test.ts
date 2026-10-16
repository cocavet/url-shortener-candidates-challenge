import { afterEach, describe, expect, it, vi } from "vitest";
import { recordClick } from "../src/application/record-click";
import { ShortCode } from "../src/domain/short-code";

afterEach(() => vi.useRealTimers());

describe("recordClick", () => {
  it("waits for a confirmed increment before returning", async () => {
    let finish!: () => void;
    const incrementClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onFailure = vi.fn();
    const confirmed = vi.fn();
    const pending = recordClick(new ShortCode("Ab12Cd34"), {
      statistics: { incrementClick },
      onFailure,
    }).then(confirmed);
    await Promise.resolve();
    expect(confirmed).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(incrementClick).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports a failure without propagating sensitive errors or retrying", async () => {
    const incrementClick = vi
      .fn()
      .mockRejectedValue(
        new Error("Database error containing https://private.example"),
      );
    const onFailure = vi.fn();
    await expect(
      recordClick(new ShortCode("Ab12Cd34"), {
        statistics: { incrementClick },
        onFailure,
      }),
    ).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("write-failed");
    expect(incrementClick).toHaveBeenCalledTimes(1);
  });

  it("also contains a synchronous adapter exception", async () => {
    const onFailure = vi.fn();
    await expect(
      recordClick(new ShortCode("Ab12Cd34"), {
        statistics: {
          incrementClick: () => {
            throw new Error("Adapter failed");
          },
        },
        onFailure,
      }),
    ).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("write-failed");
  });

  it("stops waiting after the default second and observes a late rejection without retrying", async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const incrementClick = vi.fn(
      () =>
        new Promise<void>((_, failure) => {
          reject = failure;
        }),
    );
    const onFailure = vi.fn();
    const pending = recordClick(new ShortCode("Ab12Cd34"), {
      statistics: { incrementClick },
      onFailure,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(onFailure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("timeout");
    reject(new Error("Late storage failure"));
    await vi.runAllTimersAsync();
    expect(incrementClick).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows an uncertain timed-out write to complete once, without counting twice", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    let count = 0;
    const incrementClick = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      count++;
    });
    const pending = recordClick(new ShortCode("Ab12Cd34"), {
      statistics: { incrementClick },
      onFailure: vi.fn(),
      timeoutMs: 20,
    });
    await vi.advanceTimersByTimeAsync(20);
    await pending;
    expect(count).toBe(0);
    finish();
    await vi.runAllTimersAsync();
    expect(count).toBe(1);
    expect(incrementClick).toHaveBeenCalledTimes(1);
  });

  it("does not propagate a diagnostic callback failure", async () => {
    await expect(
      recordClick(new ShortCode("Ab12Cd34"), {
        statistics: {
          incrementClick: vi.fn().mockRejectedValue(new Error("Write failed")),
        },
        onFailure: () => {
          throw new Error("Logging failed");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it.each([0, -1, NaN, Infinity, 0.5, 2_147_483_648])(
    "rejects invalid timeout %s before writing",
    async (timeoutMs) => {
      const incrementClick = vi.fn().mockResolvedValue(undefined);
      await expect(
        recordClick(new ShortCode("Ab12Cd34"), {
          statistics: { incrementClick },
          onFailure: vi.fn(),
          timeoutMs,
        }),
      ).rejects.toThrow("timeout");
      expect(incrementClick).not.toHaveBeenCalled();
    },
  );
});

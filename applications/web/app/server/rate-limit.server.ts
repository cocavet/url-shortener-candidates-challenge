import type { CreationLimiter, CreationWindow } from "./contracts/server";

export class CreationRateLimiter implements CreationLimiter {
  private readonly clientWindows = new Map<string, CreationWindow>();

  constructor(
    private readonly maxAttemptsPerWindow: number,
    private readonly windowDurationMs: number,
    private readonly maxTrackedClients = 10_000,
    private readonly now = Date.now,
  ) {}

  consume(address: string): number {
    const currentTime = this.now();
    const clientWindow = this.clientWindows.get(address);
    if (clientWindow && clientWindow.expiresAt > currentTime) {
      if (clientWindow.count >= this.maxAttemptsPerWindow) {
        return retryAfterSeconds(clientWindow.expiresAt, currentTime);
      }
      clientWindow.count++;
      return 0;
    }
    this.clientWindows.delete(address);

    if (this.clientWindows.size >= this.maxTrackedClients) {
      let earliestExpiry = Infinity;
      for (const [clientAddress, trackedWindow] of this.clientWindows) {
        if (trackedWindow.expiresAt <= currentTime) {
          this.clientWindows.delete(clientAddress);
        } else {
          earliestExpiry = Math.min(earliestExpiry, trackedWindow.expiresAt);
        }
      }
      if (this.clientWindows.size >= this.maxTrackedClients) {
        return retryAfterSeconds(earliestExpiry, currentTime);
      }
    }
    this.clientWindows.set(address, {
      count: 1,
      expiresAt: currentTime + this.windowDurationMs,
    });
    return 0;
  }
}

function retryAfterSeconds(expiresAt: number, currentTime: number): number {
  return Math.max(1, Math.ceil((expiresAt - currentTime) / 1000));
}

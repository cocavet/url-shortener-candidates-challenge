import type {
  ClickStatisticsRepository,
  ShortLinkRepository,
} from "@url-shortener/engine";
import type { CreationResult } from "../../contracts/short-links";

export interface HttpErrorDefinition {
  readonly status: number;
  readonly message: string;
}

export interface CreationErrorOptions
  extends Pick<CreationResult, "submittedUrl" | "invalidUrl"> {
  headers?: HeadersInit;
}

export interface CreationWindow {
  count: number;
  readonly expiresAt: number;
}

export interface ServerConfig {
  publicUrl: string;
  databaseUrl: string;
  host: string;
  port: number;
  creationLimit: number;
  creationWindowMs: number;
  clickTimeoutMs: number;
}

export interface CreationLimiter {
  // Zero accepts the attempt; a positive result is the Retry-After delay in seconds.
  consume(address: string): number;
}

export interface ApplicationServices {
  config: ServerConfig;
  repository: ShortLinkRepository & ClickStatisticsRepository;
  creationLimiter: CreationLimiter;
  close(): Promise<void>;
}

declare module "react-router" {
  interface AppLoadContext {
    services: ApplicationServices;
    clientAddress: string;
  }
}

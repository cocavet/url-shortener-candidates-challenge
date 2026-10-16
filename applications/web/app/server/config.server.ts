import {
  isPositiveIntegerWithin,
  isSqliteFileUrl,
  isValidHttpOrigin,
  MAX_SIGNED_32_BIT_INTEGER,
} from "@url-shortener/engine";
import type { ServerConfig } from "./contracts/server";
import { ServerConfigurationError } from "./errors/http-errors";
import { SERVER_ERROR_MESSAGES } from "./errors/messages/server-error-messages";

function readPublicOrigin(rawValue: string | undefined): string {
  let publicUrl: URL;
  const value = rawValue?.trim() ?? "";
  try {
    publicUrl = new URL(value);
  } catch {
    throw new ServerConfigurationError(SERVER_ERROR_MESSAGES.invalidPublicUrl);
  }
  if (!isValidHttpOrigin(value)) {
    throw new ServerConfigurationError(
      SERVER_ERROR_MESSAGES.invalidPublicOrigin,
    );
  }

  return publicUrl.origin;
}

function readPositiveIntegerOption(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  maximum = MAX_SIGNED_32_BIT_INTEGER,
): number {
  const rawValue = environment[name];
  if (rawValue === undefined) return defaultValue;

  const parsedValue = Number(rawValue);
  if (
    !/^\d+$/.test(rawValue) ||
    !isPositiveIntegerWithin(parsedValue, maximum)
  ) {
    throw new ServerConfigurationError(
      SERVER_ERROR_MESSAGES.invalidIntegerOption(name, maximum),
    );
  }
  return parsedValue;
}

export function readServerConfig(environment: NodeJS.ProcessEnv): ServerConfig {
  const publicUrl = readPublicOrigin(environment.PUBLIC_URL);
  const databaseUrl = environment.DATABASE_URL ?? "file:./dev.db";
  if (!isSqliteFileUrl(databaseUrl)) {
    throw new ServerConfigurationError(
      SERVER_ERROR_MESSAGES.invalidDatabaseUrl,
    );
  }

  const isProduction = environment.NODE_ENV === "production";
  return {
    publicUrl,
    databaseUrl,
    host: environment.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1"),
    port: readPositiveIntegerOption(
      environment,
      "PORT",
      isProduction ? 3000 : 5173,
      65_535,
    ),
    creationLimit: readPositiveIntegerOption(
      environment,
      "CREATION_RATE_LIMIT",
      10,
    ),
    creationWindowMs: readPositiveIntegerOption(
      environment,
      "CREATION_RATE_WINDOW_MS",
      60_000,
    ),
    clickTimeoutMs: readPositiveIntegerOption(
      environment,
      "CLICK_RECORDING_TIMEOUT_MS",
      1000,
    ),
  };
}

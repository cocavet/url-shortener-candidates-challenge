import {
  createSqliteClient,
  PrismaShortLinkRepository,
} from "@url-shortener/engine/sqlite";
import type { ApplicationServices, ServerConfig } from "./contracts/server";
import { CreationRateLimiter } from "./rate-limit.server";

export async function createApplicationServices(
  config: ServerConfig,
): Promise<ApplicationServices> {
  const client = createSqliteClient(config.databaseUrl);
  try {
    await client.shortLink.count();
  } catch (error) {
    await client.$disconnect();
    throw error;
  }
  return {
    config,
    repository: new PrismaShortLinkRepository(client),
    creationLimiter: new CreationRateLimiter(
      config.creationLimit,
      config.creationWindowMs,
    ),
    close: () => client.$disconnect(),
  };
}

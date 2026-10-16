import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import type {
  ClickStatisticsRepository,
  ShortLinkRepository,
  ShortLinkWithStats,
} from "../contracts/short-link-repository";
import { OriginalUrl } from "../domain/original-url";
import { ShortCode } from "../domain/short-code";
import { ShortLink } from "../domain/short-link";
import { ENGINE_ERROR_MESSAGES } from "../errors/messages/engine-error-messages";
import { ShortCodeCollisionError } from "../errors/short-link-errors";
import { isSqliteFileUrl } from "../validators/sqlite-url";

const SQLITE_BUSY_TIMEOUT_MS = 250;

function isShortCodeUniqueConstraintViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002" || error.meta?.modelName !== "ShortLink")
    return false;

  const adapterError = error.meta.driverAdapterError;
  const cause = adapterError instanceof Error ? adapterError.cause : null;
  if (!cause || typeof cause !== "object" || !("constraint" in cause))
    return false;

  const constraint = cause.constraint;
  if (
    !constraint ||
    typeof constraint !== "object" ||
    !("fields" in constraint)
  )
    return false;

  const fields = constraint.fields;
  return Array.isArray(fields) && fields.length === 1 && fields[0] === "code";
}

export function createSqliteClient(databaseUrl: string): PrismaClient {
  if (!isSqliteFileUrl(databaseUrl)) {
    throw new Error(ENGINE_ERROR_MESSAGES.invalidDatabaseUrl);
  }
  const databaseFilePath = resolve(
    fileURLToPath(new URL("../../prisma/", import.meta.url)),
    databaseUrl.slice(5),
  );
  const adapter = new PrismaBetterSqlite3({
    url: `file:${databaseFilePath}`,
    timeout: SQLITE_BUSY_TIMEOUT_MS,
  });
  return new PrismaClient({ adapter });
}

export class PrismaShortLinkRepository
  implements ShortLinkRepository, ClickStatisticsRepository
{
  constructor(private readonly client: PrismaClient) {}

  async insert(link: ShortLink): Promise<void> {
    try {
      await this.client.shortLink.create({
        data: {
          code: link.code.value,
          originalUrl: link.originalUrl.value,
          createdAt: link.createdAt,
        },
      });
    } catch (error) {
      if (isShortCodeUniqueConstraintViolation(error)) {
        throw new ShortCodeCollisionError();
      }
      throw error;
    }
  }

  async findByCode(code: ShortCode): Promise<ShortLink | null> {
    const storedLink = await this.client.shortLink.findUnique({
      where: { code: code.value },
    });
    if (!storedLink) return null;
    return new ShortLink(
      new ShortCode(storedLink.code),
      new OriginalUrl(storedLink.originalUrl),
      storedLink.createdAt,
    );
  }

  listWithStats(): Promise<readonly ShortLinkWithStats[]> {
    return this.client.shortLink.findMany();
  }

  async incrementClick(code: ShortCode): Promise<void> {
    await this.client.shortLink.update({
      where: { code: code.value },
      data: { clickCount: { increment: 1 } },
    });
  }
}

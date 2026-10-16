import { OriginalUrl } from "../domain/original-url";
import { ShortCode } from "../domain/short-code";
import { ShortLink } from "../domain/short-link";
import {
  InvalidShortCodeError,
  ShortCodeCollisionError,
  ShortCodeExhaustedError,
} from "../errors/short-link-errors";
import type {
  ShortLinkRepository,
  ShortLinkWithStats,
} from "../contracts/short-link-repository";
import type { CreateShortLinkDependencies } from "../contracts/create-short-link";

const MAX_CODE_GENERATION_ATTEMPTS = 5;

export async function createShortLink(
  input: unknown,
  { repository, generateCode, now }: CreateShortLinkDependencies,
): Promise<ShortLink> {
  const originalUrl = new OriginalUrl(input);
  const createdAt = now();

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const link = new ShortLink(generateCode(), originalUrl, createdAt);
    try {
      await repository.insert(link);
      return link;
    } catch (error) {
      if (!(error instanceof ShortCodeCollisionError)) throw error;
    }
  }
  throw new ShortCodeExhaustedError();
}

export async function resolveShortLink(
  input: unknown,
  repository: ShortLinkRepository,
): Promise<ShortLink | null> {
  let code: ShortCode;
  try {
    code = new ShortCode(input);
  } catch (error) {
    if (error instanceof InvalidShortCodeError) return null;
    throw error;
  }
  return repository.findByCode(code);
}

export async function listShortLinksWithStats(
  repository: ShortLinkRepository,
): Promise<readonly ShortLinkWithStats[]> {
  const links = await repository.listWithStats();
  return [...links].sort(compareNewestLinksFirst);
}

function compareNewestLinksFirst(
  first: ShortLinkWithStats,
  second: ShortLinkWithStats,
): number {
  const dateDifference = second.createdAt.getTime() - first.createdAt.getTime();
  if (dateDifference !== 0) return dateDifference;
  if (first.code < second.code) return -1;
  if (first.code > second.code) return 1;
  return 0;
}

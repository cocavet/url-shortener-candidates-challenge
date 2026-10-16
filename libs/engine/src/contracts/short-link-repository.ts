import type { ShortCode } from "../domain/short-code";
import type { ShortLink } from "../domain/short-link";

export interface ShortLinkWithStats {
  readonly code: string;
  readonly originalUrl: string;
  readonly createdAt: Date;
  readonly clickCount: number;
}

export interface ShortLinkRepository {
  // Insert without overwriting; only code conflicts become ShortCodeCollisionError.
  insert(link: ShortLink): Promise<void>;
  findByCode(code: ShortCode): Promise<ShortLink | null>;
  listWithStats(): Promise<readonly ShortLinkWithStats[]>;
}

export interface ClickStatisticsRepository {
  incrementClick(code: ShortCode): Promise<void>;
}

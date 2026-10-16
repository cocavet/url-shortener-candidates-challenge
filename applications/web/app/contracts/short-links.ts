import type { ShortLinkWithStats } from "@url-shortener/engine";

export interface ListedLink extends Omit<ShortLinkWithStats, "createdAt"> {
  createdAt: string;
  shortenedUrl: string;
}

export interface CreationResult {
  shortenedUrl?: string;
  error?: string;
  submittedUrl?: string;
  invalidUrl?: boolean;
}

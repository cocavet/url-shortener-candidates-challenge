import type { ShortCode } from "../domain/short-code";
import type { ShortLinkRepository } from "./short-link-repository";

export interface CreateShortLinkDependencies {
  readonly repository: ShortLinkRepository;
  readonly generateCode: () => ShortCode;
  readonly now: () => Date;
}

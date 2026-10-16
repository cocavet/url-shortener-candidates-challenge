import type { ClickStatisticsRepository } from "./short-link-repository";

export interface RecordClickDependencies {
  readonly statistics: ClickStatisticsRepository;
  readonly onFailure: (reason: "write-failed" | "timeout") => void;
  readonly timeoutMs?: number;
}

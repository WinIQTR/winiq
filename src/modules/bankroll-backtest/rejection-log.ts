/**
 * Strategy rejection + commitment ledger (R1ch1k).
 */

export type RejectionReason =
  | "below_min_ev"
  | "risk_limit"
  | "insufficient_bankroll"
  | "invalid_odds"
  | "invalid_probability"
  | "simultaneous_cap"
  | "custom";

export type StrategyRejection = {
  betId: string;
  reason: RejectionReason;
  detail: string | null;
  at: string;
};

export type StrategyCommitment = {
  betId: string;
  stake: number;
  odds: number;
  expectedProfit: number;
  at: string;
};

export class StrategyLedger {
  readonly rejections: StrategyRejection[] = [];
  readonly commitments: StrategyCommitment[] = [];

  reject(
    betId: string,
    reason: RejectionReason,
    detail: string | null = null,
  ): void {
    this.rejections.push({
      betId,
      reason,
      detail,
      at: new Date().toISOString(),
    });
  }

  commit(entry: Omit<StrategyCommitment, "at">): void {
    this.commitments.push({
      ...entry,
      at: new Date().toISOString(),
    });
  }

  summary() {
    const byReason: Record<string, number> = {};
    for (const row of this.rejections) {
      byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
    }
    return {
      rejected: this.rejections.length,
      committed: this.commitments.length,
      byReason,
    };
  }
}

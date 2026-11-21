/**
 * Reject 1X2 rows whose probabilities do not sum to ~1 (open-data ingest check).
 */

import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";

export type ProbabilitySumCheck = {
  ok: boolean;
  sum: number;
  delta: number;
};

export function checkProbabilitySum(
  pHome: number,
  pDraw: number,
  pAway: number,
  tolerance = 0.01,
): ProbabilitySumCheck {
  const sum = pHome + pDraw + pAway;
  const delta = Math.abs(sum - 1);
  return { ok: Number.isFinite(sum) && delta <= tolerance, sum, delta };
}

export function assertProbabilitySum(
  row: Pick<SettledOneXTwoRow, "fixtureId" | "pHome" | "pDraw" | "pAway">,
  tolerance = 0.01,
): void {
  const check = checkProbabilitySum(row.pHome, row.pDraw, row.pAway, tolerance);
  if (!check.ok) {
    throw new Error(
      `probabilities of fixture ${row.fixtureId} sum to ${check.sum.toFixed(4)} (tol ±${tolerance})`,
    );
  }
}

export function filterValidProbabilityRows<T extends SettledOneXTwoRow>(
  rows: readonly T[],
  tolerance = 0.01,
): { valid: T[]; rejected: Array<{ fixtureId: string; sum: number }> } {
  const valid: T[] = [];
  const rejected: Array<{ fixtureId: string; sum: number }> = [];
  for (const row of rows) {
    const check = checkProbabilitySum(row.pHome, row.pDraw, row.pAway, tolerance);
    if (check.ok) valid.push(row);
    else rejected.push({ fixtureId: row.fixtureId, sum: check.sum });
  }
  return { valid, rejected };
}

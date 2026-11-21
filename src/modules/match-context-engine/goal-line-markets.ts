/**
 * Explicit O/U 1.5 and 3.5 (plus 2.5) derivation helpers from a score matrix
 * or expected totals — surface prominence for member/value catalogs.
 */

export const HIGHLIGHTED_TOTAL_LINES = [1.5, 2.5, 3.5] as const;

export type ScoreCell = {
  homeGoals: number;
  awayGoals: number;
  probability: number; // 0–1
};

export type GoalLineMarketSet = {
  line: number;
  overProb: number;
  underProb: number;
  highlighted: boolean;
};

export function deriveGoalLineMarkets(
  scoreMatrix: readonly ScoreCell[],
  lines: readonly number[] = [...HIGHLIGHTED_TOTAL_LINES],
): GoalLineMarketSet[] {
  return lines.map((line) => {
    let over = 0;
    let under = 0;
    for (const cell of scoreMatrix) {
      const total = cell.homeGoals + cell.awayGoals;
      if (total > line) over += cell.probability;
      else under += cell.probability;
    }
    const sum = over + under;
    return {
      line,
      overProb: sum > 0 ? over / sum : 0,
      underProb: sum > 0 ? under / sum : 0,
      highlighted: (HIGHLIGHTED_TOTAL_LINES as readonly number[]).includes(line),
    };
  });
}

export function labelGoalLineMarket(line: number, side: "over" | "under"): string {
  const prefix = side === "over" ? "Over" : "Under";
  return `${prefix} ${line.toFixed(1)}`;
}

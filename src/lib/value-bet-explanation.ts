import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

export type ValueBetVerdict =
  | "ELITE_VALUE"
  | "VERY_STRONG_VALUE"
  | "STRONG_VALUE"
  | "QUALIFIED_VALUE";

export type ValueBetExplanation = {
  verdict: ValueBetVerdict;
  probabilityGap: number;
  oddsPremium: number | null;
  expectedProfitPerUnit: number;
  bookmakerCoverage: number;
  confidenceSignals: string[];
};

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function buildValueBetExplanation(
  row: ValueBetDashboardRow,
): ValueBetExplanation {
  const probabilityGap = round(
    row.modelProbability - row.marketProbability,
  );
  const oddsPremium =
    row.fairOdds !== null && row.bestOdds !== null && row.fairOdds > 0
      ? round(((row.bestOdds / row.fairOdds) - 1) * 100)
      : null;

  let verdict: ValueBetVerdict = "QUALIFIED_VALUE";
  if (row.expectedValue >= 20 && row.marketEdge >= 7) {
    verdict = "ELITE_VALUE";
  } else if (row.expectedValue >= 12 && row.marketEdge >= 6) {
    verdict = "VERY_STRONG_VALUE";
  } else if (row.expectedValue >= 8 && row.marketEdge >= 4) {
    verdict = "STRONG_VALUE";
  }

  const confidenceSignals: string[] = [];
  if (probabilityGap >= 10) confidenceSignals.push("DOUBLE_DIGIT_PROBABILITY_GAP");
  if (row.expectedValue >= 15) confidenceSignals.push("HIGH_EXPECTED_VALUE");
  if (row.bookmakerCount >= 8) confidenceSignals.push("BROAD_MARKET_COVERAGE");
  if (oddsPremium !== null && oddsPremium >= 10) confidenceSignals.push("STRONG_ODDS_PREMIUM");

  return {
    verdict,
    probabilityGap,
    oddsPremium,
    expectedProfitPerUnit: round(row.expectedValue / 100, 3),
    bookmakerCoverage: row.bookmakerCount,
    confidenceSignals,
  };
}

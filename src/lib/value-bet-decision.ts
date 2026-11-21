import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import {
  applyExposureCaps,
  binaryRowsToBootstrapObservations,
  buildReliabilityDiagram,
  DEFAULT_DECISION_ENGINE_CONFIG,
  evaluateBetMode,
  evaluateDecision,
  isMarketEnabled,
  runPairedBlockBootstrap,
  type BetModeEvaluation,
  type BetModeId,
  type DecisionResult,
  type PairedBootstrapReport,
  type ReliabilityDiagram,
} from "@/modules/decision-engine";

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).format(value);
}

function to01(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100));
}

function hoursBetween(earlier: Date, later: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / (1000 * 60 * 60));
}

export type DecisionAnnotatedRow = {
  row: ValueBetDashboardRow;
  decision: DecisionResult;
  smart: BetModeEvaluation;
  highReturn: BetModeEvaluation;
};

function annotateRow(
  row: ValueBetDashboardRow,
  now: Date,
  historicalSamplesByMarket: Map<string, number>,
): DecisionAnnotatedRow {
  const modelProbability = to01(row.modelProbability);
  const alternateProbability = to01(row.marketProbability);
  const dataQuality = Math.min(
    1,
    Math.max(0.4, 0.55 + row.bookmakerCount * 0.05 + (row.valueScore / 500)),
  );
  const historicalSamples = historicalSamplesByMarket.get(row.marketKey) ?? 0;
  const fixtureAgeHours = hoursBetween(row.publishedAt, now);
  const oddsAgeHours = hoursBetween(row.sourceUpdatedAt, now);
  const oddsTimestampPresent =
    Number.isFinite(row.sourceUpdatedAt.getTime()) &&
    row.sourceUpdatedAt.getTime() > 0;

  const candidate = {
    marketKey: row.marketKey,
    decimalOdds: row.bestOdds,
    modelProbability,
    alternateProbability,
    dataQuality,
    historicalSamples,
    fixtureAgeHours,
    oddsAgeHours,
    oddsTimestampPresent,
  };

  return {
    row,
    decision: evaluateDecision(candidate),
    smart: evaluateBetMode({ ...candidate, modelSupportCount: 1 }, "smart"),
    highReturn: evaluateBetMode(
      { ...candidate, modelSupportCount: 2 },
      "high_return",
    ),
  };
}

function buildHistoricalSampleMap(
  settled: readonly ValueBetDashboardRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of settled) {
    if (row.result !== "WON" && row.result !== "LOST") continue;
    map.set(row.marketKey, (map.get(row.marketKey) ?? 0) + 1);
  }
  return map;
}

export function annotateValueBetDecisions(
  upcoming: readonly ValueBetDashboardRow[],
  settled: readonly ValueBetDashboardRow[],
  now = new Date(),
): DecisionAnnotatedRow[] {
  const samples = buildHistoricalSampleMap(settled);
  return upcoming
    .filter((row) => isMarketEnabled(row.marketKey))
    .map((row) => annotateRow(row, now, samples));
}

export function filterValueBetsByMode(
  annotated: readonly DecisionAnnotatedRow[],
  mode: BetModeId,
): DecisionAnnotatedRow[] {
  return annotated
    .filter((item) =>
      mode === "smart" ? item.smart.qualified : item.highReturn.qualified,
    )
    .sort((a, b) => {
      const scoreA =
        mode === "smart"
          ? (a.smart.smartBetScore ?? 0)
          : (a.highReturn.smartBetScore ?? 0);
      const scoreB =
        mode === "smart"
          ? (b.smart.smartBetScore ?? 0)
          : (b.highReturn.smartBetScore ?? 0);
      return scoreB - scoreA;
    });
}

export function applyValueBetExposure(
  annotated: readonly DecisionAnnotatedRow[],
): DecisionAnnotatedRow[] {
  const acceptedIds = new Set(
    applyExposureCaps(
      annotated
        .filter((item) => item.decision.status === "QUALIFIED")
        .map((item) => ({
          id: `${item.row.matchId}:${item.row.marketKey}:${item.row.selection}`,
          matchId: item.row.matchId,
          leagueKey: String(item.row.leagueApiId),
          kickoffAt: item.row.kickoffAt,
          stakeFraction: Math.min(
            DEFAULT_DECISION_ENGINE_CONFIG.exposure
              .maximumHypotheticalFractionPerSelection,
            Math.max(0, item.row.recommendedStakePercentage) / 100,
          ),
          score: item.row.valueScore,
          correlationGroup: String(item.row.leagueApiId),
        })),
    )
      .filter((item) => item.accepted)
      .map((item) => item.id),
  );

  return annotated.filter((item) =>
    acceptedIds.has(
      `${item.row.matchId}:${item.row.marketKey}:${item.row.selection}`,
    ),
  );
}

export function buildMarketComparisonReport(
  settled: readonly ValueBetDashboardRow[],
): PairedBootstrapReport {
  const decided = settled.filter(
    (row) => row.result === "WON" || row.result === "LOST",
  );
  const observations = binaryRowsToBootstrapObservations(
    decided.map((row) => ({
      blockKey: istanbulDateKey(row.kickoffAt),
      modelProbability: to01(row.modelProbability),
      marketProbability: to01(row.marketProbability),
      won: row.result === "WON",
    })),
  );
  return runPairedBlockBootstrap(observations, {
    iterations: Math.min(800, Math.max(200, observations.length * 2)),
    seed: 42,
  });
}

export function buildValueBetReliabilityDiagram(
  settled: readonly ValueBetDashboardRow[],
): ReliabilityDiagram {
  const decided = settled.filter(
    (row) => row.result === "WON" || row.result === "LOST",
  );
  return buildReliabilityDiagram(
    decided.map((row) => ({
      predicted01: to01(row.modelProbability),
      outcome01: row.result === "WON" ? 1 : 0,
    })),
  );
}

export function decisionGateSummary(annotated: readonly DecisionAnnotatedRow[]): {
  qualified: number;
  noBet: number;
  smart: number;
  highReturn: number;
  topRejections: Array<{ code: string; count: number }>;
} {
  const rejectionCounts = new Map<string, number>();
  let qualified = 0;
  let noBet = 0;
  let smart = 0;
  let highReturn = 0;
  for (const item of annotated) {
    if (item.decision.status === "QUALIFIED") qualified += 1;
    else noBet += 1;
    if (item.smart.qualified) smart += 1;
    if (item.highReturn.qualified) highReturn += 1;
    for (const code of item.decision.rejectionCodes) {
      rejectionCounts.set(code, (rejectionCounts.get(code) ?? 0) + 1);
    }
  }
  const topRejections = [...rejectionCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  return { qualified, noBet, smart, highReturn, topRejections };
}

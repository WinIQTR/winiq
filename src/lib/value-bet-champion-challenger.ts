import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import { selectIndependentValueBetRows } from "@/lib/value-bet-learning";

export const MINIMUM_AUDIT_SAMPLE = 300;
const PROFILE_RATIO = 0.6;
const SELECTION_RATIO = 0.2;
const PRIOR_STRENGTH = 20;
const MINIMUM_MARKET_PROFILE_SAMPLE = 30;
const CANDIDATE_WEIGHTS = [0.1, 0.2, 0.3, 0.4] as const;

export type AuditStatus = "COLLECTING" | "NO_DISTINCT_CHALLENGER" | "CHALLENGER_REJECTED" | "CHALLENGER_PASSED";

export type AuditMetrics = {
  selections: number;
  accuracy: number | null;
  brierScore: number | null;
  logLoss: number | null;
  ece: number | null;
};

export type ChampionChallengerAudit = {
  status: AuditStatus;
  minimumSample: number;
  independentSelections: number;
  progressPercentage: number;
  profileSelections: number;
  selectionSelections: number;
  finalUnseenSelections: number;
  selectedChallengerWeight: number | null;
  champion: AuditMetrics;
  challenger: AuditMetrics | null;
  gates: {
    distinctWeight: boolean;
    brierImproved: boolean;
    logLossImproved: boolean;
    eceImproved: boolean;
    accuracyProtected: boolean;
  } | null;
  productionChangeAllowed: false;
};

type Calibrator = {
  overallRate: number;
  marketRates: Map<string, number>;
};

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const clampProbability = (value: number): number => Math.min(0.999999, Math.max(0.000001, value));
const outcome = (row: ValueBetDashboardRow): number => row.result === "WON" ? 1 : 0;
const championProbability = (row: ValueBetDashboardRow): number => clampProbability(row.modelProbability / 100);

function buildCalibrator(rows: readonly ValueBetDashboardRow[]): Calibrator {
  const overallWins = rows.reduce((total, row) => total + outcome(row), 0);
  const overallRate = rows.length > 0 ? overallWins / rows.length : 0.5;
  const groups = new Map<string, ValueBetDashboardRow[]>();
  for (const row of rows) groups.set(row.marketKey, [...(groups.get(row.marketKey) ?? []), row]);
  const marketRates = new Map<string, number>();

  for (const [marketKey, marketRows] of groups) {
    if (marketRows.length < MINIMUM_MARKET_PROFILE_SAMPLE) continue;
    const wins = marketRows.reduce((total, row) => total + outcome(row), 0);
    marketRates.set(marketKey, (wins + overallRate * PRIOR_STRENGTH) / (marketRows.length + PRIOR_STRENGTH));
  }
  return { overallRate, marketRates };
}

function challengerProbability(row: ValueBetDashboardRow, calibrator: Calibrator, weight: number): number {
  const calibrated = calibrator.marketRates.get(row.marketKey) ?? calibrator.overallRate;
  return clampProbability(championProbability(row) * (1 - weight) + calibrated * weight);
}

function metrics(
  rows: readonly ValueBetDashboardRow[],
  probability: (row: ValueBetDashboardRow) => number,
): AuditMetrics {
  if (rows.length === 0) return { selections: 0, accuracy: null, brierScore: null, logLoss: null, ece: null };
  let correct = 0;
  let brier = 0;
  let logLoss = 0;
  const bins = Array.from({ length: 10 }, () => ({ count: 0, probability: 0, outcome: 0 }));

  for (const row of rows) {
    const p = probability(row);
    const y = outcome(row);
    if ((p >= 0.5 ? 1 : 0) === y) correct += 1;
    brier += (p - y) ** 2;
    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    const bin = bins[Math.min(9, Math.floor(p * 10))]!;
    bin.count += 1;
    bin.probability += p;
    bin.outcome += y;
  }

  const ece = bins.reduce((total, bin) => {
    if (bin.count === 0) return total;
    return total + (bin.count / rows.length) * Math.abs(bin.probability / bin.count - bin.outcome / bin.count);
  }, 0);

  return {
    selections: rows.length,
    accuracy: round((correct / rows.length) * 100, 2),
    brierScore: round(brier / rows.length),
    logLoss: round(logLoss / rows.length),
    ece: round(ece),
  };
}

function isBetter(left: AuditMetrics, right: AuditMetrics): boolean {
  if (left.brierScore === null || right.brierScore === null) return false;
  if (left.brierScore !== right.brierScore) return left.brierScore < right.brierScore;
  return (left.logLoss ?? Infinity) < (right.logLoss ?? Infinity);
}

export function buildChampionChallengerAudit(
  rows: readonly ValueBetDashboardRow[],
): ChampionChallengerAudit {
  const independent = selectIndependentValueBetRows(rows);
  const progressPercentage = Math.min(100, round((independent.length / MINIMUM_AUDIT_SAMPLE) * 100, 1));
  const empty = metrics([], championProbability);

  if (independent.length < MINIMUM_AUDIT_SAMPLE) {
    return {
      status: "COLLECTING", minimumSample: MINIMUM_AUDIT_SAMPLE,
      independentSelections: independent.length, progressPercentage,
      profileSelections: 0, selectionSelections: 0, finalUnseenSelections: 0,
      selectedChallengerWeight: null, champion: empty, challenger: null, gates: null,
      productionChangeAllowed: false,
    };
  }

  const profileEnd = Math.floor(independent.length * PROFILE_RATIO);
  const selectionEnd = Math.floor(independent.length * (PROFILE_RATIO + SELECTION_RATIO));
  const profileRows = independent.slice(0, profileEnd);
  const selectionRows = independent.slice(profileEnd, selectionEnd);
  const finalRows = independent.slice(selectionEnd);
  const calibrator = buildCalibrator(profileRows);
  let selectedWeight: number | null = null;
  let selectedMetrics: AuditMetrics | null = null;

  for (const weight of CANDIDATE_WEIGHTS) {
    const candidate = metrics(selectionRows, (row) => challengerProbability(row, calibrator, weight));
    if (selectedMetrics === null || isBetter(candidate, selectedMetrics)) {
      selectedWeight = weight;
      selectedMetrics = candidate;
    }
  }

  if (selectedWeight === null) {
    return {
      status: "NO_DISTINCT_CHALLENGER", minimumSample: MINIMUM_AUDIT_SAMPLE,
      independentSelections: independent.length, progressPercentage,
      profileSelections: profileRows.length, selectionSelections: selectionRows.length,
      finalUnseenSelections: finalRows.length, selectedChallengerWeight: null,
      champion: metrics(finalRows, championProbability), challenger: null, gates: null,
      productionChangeAllowed: false,
    };
  }

  const champion = metrics(finalRows, championProbability);
  const challenger = metrics(finalRows, (row) => challengerProbability(row, calibrator, selectedWeight));
  const gates = {
    distinctWeight: selectedWeight > 0,
    brierImproved: (challenger.brierScore ?? Infinity) < (champion.brierScore ?? -Infinity),
    logLossImproved: (challenger.logLoss ?? Infinity) < (champion.logLoss ?? -Infinity),
    eceImproved: (challenger.ece ?? Infinity) < (champion.ece ?? -Infinity),
    accuracyProtected: (challenger.accuracy ?? -Infinity) >= (champion.accuracy ?? Infinity) - 0.5,
  };

  return {
    status: Object.values(gates).every(Boolean) ? "CHALLENGER_PASSED" : "CHALLENGER_REJECTED",
    minimumSample: MINIMUM_AUDIT_SAMPLE,
    independentSelections: independent.length, progressPercentage,
    profileSelections: profileRows.length, selectionSelections: selectionRows.length,
    finalUnseenSelections: finalRows.length, selectedChallengerWeight: selectedWeight,
    champion, challenger, gates, productionChangeAllowed: false,
  };
}

import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

export const MINIMUM_LEARNING_SAMPLE = 300;
const TRAIN_RATIO = 0.7;
const MINIMUM_MARKET_TRAIN_SAMPLE = 30;

export type LearningStatus = "COLLECTING" | "BASELINE_ONLY" | "CANDIDATE_READY" | "CANDIDATE_REJECTED";

export type LearningMetrics = {
  selections: number;
  roi: number | null;
  brierScore: number | null;
  logLoss: number | null;
  maximumDrawdownUnits: number;
};

export type MarketWeightRecommendation = {
  marketKey: string;
  market: string;
  trainSelections: number;
  trainRoi: number;
  calibrationGap: number;
  proposedMultiplier: number;
  reason: "REDUCE" | "NEUTRAL" | "INCREASE";
};

export type ValueBetLearningReport = {
  status: LearningStatus;
  minimumSample: number;
  independentSelections: number;
  progressPercentage: number;
  trainSelections: number;
  validationSelections: number;
  baseline: LearningMetrics;
  candidate: LearningMetrics | null;
  recommendations: MarketWeightRecommendation[];
  gates: {
    roiImproved: boolean;
    brierNotWorse: boolean;
    drawdownNotWorse: boolean;
  } | null;
  productionChangeAllowed: false;
};

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function selectIndependentValueBetRows(rows: readonly ValueBetDashboardRow[]): ValueBetDashboardRow[] {
  const byMatch = new Map<number, ValueBetDashboardRow>();
  for (const row of rows) {
    if (row.result !== "WON" && row.result !== "LOST") continue;
    const current = byMatch.get(row.matchId);
    if (
      !current ||
      row.valueScore > current.valueScore ||
      (row.valueScore === current.valueScore && row.expectedValue > current.expectedValue) ||
      (row.valueScore === current.valueScore && row.expectedValue === current.expectedValue && row.marketEdge > current.marketEdge)
    ) byMatch.set(row.matchId, row);
  }
  return [...byMatch.values()].sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime() || a.matchId - b.matchId,
  );
}

function metrics(
  rows: readonly ValueBetDashboardRow[],
  weight: (row: ValueBetDashboardRow) => number = () => 1,
): LearningMetrics {
  if (rows.length === 0) {
    return { selections: 0, roi: null, brierScore: null, logLoss: null, maximumDrawdownUnits: 0 };
  }

  let totalStake = 0;
  let profit = 0;
  let brier = 0;
  let logLoss = 0;
  let balance = 0;
  let peak = 0;
  let maximumDrawdown = 0;

  for (const row of rows) {
    const rowWeight = Math.max(0, weight(row));
    const outcome = row.result === "WON" ? 1 : 0;
    const probability = Math.min(0.999999, Math.max(0.000001, row.modelProbability / 100));
    const rowProfit = (row.profitUnits ?? (outcome ? row.bestOdds - 1 : -1)) * rowWeight;
    totalStake += rowWeight;
    profit += rowProfit;
    brier += rowWeight * ((probability - outcome) ** 2);
    logLoss += rowWeight * (-(outcome * Math.log(probability) + (1 - outcome) * Math.log(1 - probability)));
    balance += rowProfit;
    peak = Math.max(peak, balance);
    maximumDrawdown = Math.max(maximumDrawdown, peak - balance);
  }

  return {
    selections: rows.length,
    roi: totalStake > 0 ? round((profit / totalStake) * 100) : null,
    brierScore: totalStake > 0 ? round(brier / totalStake, 4) : null,
    logLoss: totalStake > 0 ? round(logLoss / totalStake, 4) : null,
    maximumDrawdownUnits: round(maximumDrawdown),
  };
}

function recommendations(rows: readonly ValueBetDashboardRow[]): MarketWeightRecommendation[] {
  const groups = new Map<string, ValueBetDashboardRow[]>();
  for (const row of rows) groups.set(row.marketKey, [...(groups.get(row.marketKey) ?? []), row]);

  return [...groups.entries()].flatMap(([marketKey, marketRows]) => {
    if (marketRows.length < MINIMUM_MARKET_TRAIN_SAMPLE) return [];
    const won = marketRows.filter((row) => row.result === "WON").length;
    const winRate = (won / marketRows.length) * 100;
    const averageProbability = marketRows.reduce((total, row) => total + row.modelProbability, 0) / marketRows.length;
    const calibrationGap = winRate - averageProbability;
    const marketMetrics = metrics(marketRows);
    const marketRoi = marketMetrics.roi ?? 0;
    let proposedMultiplier = 1;
    let reason: MarketWeightRecommendation["reason"] = "NEUTRAL";

    if (marketRoi < -10 || calibrationGap < -15) {
      proposedMultiplier = 0.5;
      reason = "REDUCE";
    } else if (marketRoi < 0 || calibrationGap < -8) {
      proposedMultiplier = 0.75;
      reason = "REDUCE";
    } else if (marketRoi > 8 && Math.abs(calibrationGap) <= 10) {
      proposedMultiplier = 1.1;
      reason = "INCREASE";
    }

    return [{
      marketKey,
      market: marketRows[0]?.market ?? marketKey,
      trainSelections: marketRows.length,
      trainRoi: round(marketRoi),
      calibrationGap: round(calibrationGap),
      proposedMultiplier,
      reason,
    }];
  }).sort((a, b) => b.trainSelections - a.trainSelections || a.market.localeCompare(b.market));
}

export function buildValueBetLearningReport(
  rows: readonly ValueBetDashboardRow[],
): ValueBetLearningReport {
  const independent = selectIndependentValueBetRows(rows);
  const progressPercentage = Math.min(100, round((independent.length / MINIMUM_LEARNING_SAMPLE) * 100, 1));
  const emptyBaseline = metrics([]);

  if (independent.length < MINIMUM_LEARNING_SAMPLE) {
    return {
      status: "COLLECTING", minimumSample: MINIMUM_LEARNING_SAMPLE,
      independentSelections: independent.length, progressPercentage,
      trainSelections: 0, validationSelections: 0,
      baseline: emptyBaseline, candidate: null, recommendations: [], gates: null,
      productionChangeAllowed: false,
    };
  }

  const trainCount = Math.floor(independent.length * TRAIN_RATIO);
  const train = independent.slice(0, trainCount);
  const validation = independent.slice(trainCount);
  const proposed = recommendations(train);
  const changed = proposed.filter((item) => item.proposedMultiplier !== 1);
  const baseline = metrics(validation);

  if (changed.length === 0) {
    return {
      status: "BASELINE_ONLY", minimumSample: MINIMUM_LEARNING_SAMPLE,
      independentSelections: independent.length, progressPercentage,
      trainSelections: train.length, validationSelections: validation.length,
      baseline, candidate: null, recommendations: proposed, gates: null,
      productionChangeAllowed: false,
    };
  }

  const multipliers = new Map(proposed.map((item) => [item.marketKey, item.proposedMultiplier]));
  const candidate = metrics(validation, (row) => multipliers.get(row.marketKey) ?? 1);
  const gates = {
    roiImproved: (candidate.roi ?? -Infinity) >= (baseline.roi ?? Infinity) + 1,
    brierNotWorse: (candidate.brierScore ?? Infinity) <= (baseline.brierScore ?? -Infinity),
    drawdownNotWorse: candidate.maximumDrawdownUnits <= baseline.maximumDrawdownUnits,
  };

  return {
    status: Object.values(gates).every(Boolean) ? "CANDIDATE_READY" : "CANDIDATE_REJECTED",
    minimumSample: MINIMUM_LEARNING_SAMPLE,
    independentSelections: independent.length,
    progressPercentage,
    trainSelections: train.length,
    validationSelections: validation.length,
    baseline,
    candidate,
    recommendations: proposed,
    gates,
    productionChangeAllowed: false,
  };
}

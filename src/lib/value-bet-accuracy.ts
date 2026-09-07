import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";

export type ValueBetSampleStatus = "BUILDING" | "EARLY" | "MATURE";

export type ValueBetAccuracyGroup = {
  key: string;
  label: string;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  winRate: number | null;
  averageModelProbability: number | null;
  calibrationGap: number | null;
  profitUnits: number;
  roi: number | null;
};

export type ValueBetAccuracyReport = ValueBetAccuracyGroup & {
  sampleStatus: ValueBetSampleStatus;
  probabilityBuckets: ValueBetAccuracyGroup[];
  markets: ValueBetAccuracyGroup[];
  leagues: ValueBetAccuracyGroup[];
};

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function summarize(
  key: string,
  label: string,
  rows: readonly ValueBetDashboardRow[],
): ValueBetAccuracyGroup {
  const decided = rows.filter((row) => row.result === "WON" || row.result === "LOST");
  const won = decided.filter((row) => row.result === "WON").length;
  const lost = decided.length - won;
  const voided = rows.filter((row) => row.result === "VOID").length;
  const profitUnits = decided.reduce((total, row) => total + (row.profitUnits ?? 0), 0);
  const averageModelProbability = decided.length > 0
    ? decided.reduce((total, row) => total + row.modelProbability, 0) / decided.length
    : null;
  const winRate = decided.length > 0 ? (won / decided.length) * 100 : null;

  return {
    key,
    label,
    settled: decided.length,
    won,
    lost,
    voided,
    winRate: winRate === null ? null : round(winRate),
    averageModelProbability: averageModelProbability === null
      ? null
      : round(averageModelProbability),
    calibrationGap: winRate === null || averageModelProbability === null
      ? null
      : round(winRate - averageModelProbability),
    profitUnits: round(profitUnits, 2),
    roi: decided.length > 0 ? round((profitUnits / decided.length) * 100) : null,
  };
}

function groupBy(
  rows: readonly ValueBetDashboardRow[],
  getKey: (row: ValueBetDashboardRow) => string,
  getLabel: (row: ValueBetDashboardRow) => string,
): ValueBetAccuracyGroup[] {
  const groups = new Map<string, { label: string; rows: ValueBetDashboardRow[] }>();

  for (const row of rows) {
    const key = getKey(row);
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { label: getLabel(row), rows: [row] });
  }

  return [...groups.entries()]
    .map(([key, group]) => summarize(key, group.label, group.rows))
    .sort((a, b) => b.settled - a.settled || a.label.localeCompare(b.label));
}

function probabilityBucket(row: ValueBetDashboardRow): { key: string; label: string } {
  if (row.modelProbability < 50) return { key: "UNDER_50", label: "Under 50%" };
  if (row.modelProbability < 60) return { key: "50_59", label: "50–59.9%" };
  if (row.modelProbability < 70) return { key: "60_69", label: "60–69.9%" };
  if (row.modelProbability < 80) return { key: "70_79", label: "70–79.9%" };
  return { key: "80_PLUS", label: "80%+" };
}

export function buildValueBetAccuracyReport(
  rows: readonly ValueBetDashboardRow[],
): ValueBetAccuracyReport {
  const settledRows = rows.filter((row) => row.result !== "PENDING");
  const overall = summarize("ALL", "All settled Value Bets", settledRows);

  return {
    ...overall,
    sampleStatus: overall.settled < 30 ? "BUILDING" : overall.settled < 100 ? "EARLY" : "MATURE",
    probabilityBuckets: groupBy(
      settledRows,
      (row) => probabilityBucket(row).key,
      (row) => probabilityBucket(row).label,
    ),
    markets: groupBy(settledRows, (row) => row.marketKey, (row) => row.market),
    leagues: groupBy(
      settledRows,
      (row) => String(row.leagueApiId),
      (row) => row.leagueName,
    ),
  };
}

import type { MarketPerformanceArchiveRow } from "@/lib/market-performance-archive";

type AnalyticsRow = Pick<
  MarketPerformanceArchiveRow,
  | "leagueName"
  | "optionKey"
  | "selection"
  | "selectionSide"
  | "probability"
  | "dataQualityScore"
  | "minimumFairOddsPassed"
  | "result"
>;

export type SampleLevel = "EMPTY" | "INSUFFICIENT" | "DEVELOPING" | "SUFFICIENT";

export type PerformanceSummary = {
  total: number;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  missing: number;
  expectedAccuracy: number | null;
  actualAccuracy: number | null;
  calibrationGap: number | null;
  sampleLevel: SampleLevel;
};

export type GroupPerformance = PerformanceSummary & {
  key: string;
  label: string;
};

export const MINIMUM_SUFFICIENT_SAMPLE = 30;
export const MINIMUM_DEVELOPING_SAMPLE = 10;

export function sampleLevel(settled: number): SampleLevel {
  if (settled === 0) return "EMPTY";
  if (settled < MINIMUM_DEVELOPING_SAMPLE) return "INSUFFICIENT";
  if (settled < MINIMUM_SUFFICIENT_SAMPLE) return "DEVELOPING";
  return "SUFFICIENT";
}

export function summarizePerformance(
  rows: readonly AnalyticsRow[],
): PerformanceSummary {
  const settledRows = rows.filter((row) => row.result === "WON" || row.result === "LOST");
  const won = settledRows.filter((row) => row.result === "WON").length;
  const lost = settledRows.length - won;
  const expectedAccuracy = settledRows.length > 0
    ? settledRows.reduce((total, row) => total + row.probability, 0) / settledRows.length
    : null;
  const actualAccuracy = settledRows.length > 0 ? won / settledRows.length * 100 : null;

  return {
    total: rows.length,
    settled: settledRows.length,
    won,
    lost,
    voided: rows.filter((row) => row.result === "VOID").length,
    missing: rows.filter((row) => row.result === "DATA_MISSING").length,
    expectedAccuracy,
    actualAccuracy,
    calibrationGap:
      actualAccuracy === null || expectedAccuracy === null
        ? null
        : actualAccuracy - expectedAccuracy,
    sampleLevel: sampleLevel(settledRows.length),
  };
}

export function groupPerformance(
  rows: readonly AnalyticsRow[],
  classifier: (row: AnalyticsRow) => { key: string; label: string },
): GroupPerformance[] {
  const groups = new Map<string, { label: string; rows: AnalyticsRow[] }>();

  for (const row of rows) {
    const group = classifier(row);
    const current = groups.get(group.key) ?? { label: group.label, rows: [] };
    current.rows.push(row);
    groups.set(group.key, current);
  }

  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    ...summarizePerformance(group.rows),
  }));
}

export function probabilityBand(value: number): { key: string; label: string } {
  const minimum = Math.min(Math.floor(value / 10) * 10, 90);
  return {
    key: String(minimum),
    label: minimum === 90 ? "%90–100" : `%${minimum}–${minimum + 9},9`,
  };
}

export function dataQualityBand(value: number): { key: string; label: string } {
  if (value < 45) return { key: "0", label: "0–44 · Yetersiz" };
  if (value < 60) return { key: "45", label: "45–59 · Orta" };
  if (value < 75) return { key: "60", label: "60–74 · Yüksek" };
  return { key: "75", label: "75–100 · Çok yüksek" };
}

export function sideLabel(value: AnalyticsRow["selectionSide"]): string {
  if (value === "HOME") return "Ev sahibi seçimi";
  if (value === "DRAW") return "Beraberlik seçimi";
  if (value === "AWAY") return "Deplasman seçimi";
  return "Tarafsız / Toplam pazar";
}

export function buildPerformanceInsights(rows: readonly AnalyticsRow[]) {
  const leagues = groupPerformance(rows, (row) => ({
    key: row.leagueName,
    label: row.leagueName,
  })).sort((first, second) => second.settled - first.settled);

  const selections = groupPerformance(rows, (row) => ({
    key: row.optionKey,
    label: row.selection,
  })).sort((first, second) => second.settled - first.settled);

  const sides = groupPerformance(rows, (row) => ({
    key: row.selectionSide,
    label: sideLabel(row.selectionSide),
  })).sort((first, second) => second.settled - first.settled);

  const quality = groupPerformance(rows, (row) => dataQualityBand(row.dataQualityScore))
    .sort((first, second) => Number(first.key) - Number(second.key));

  const probability = groupPerformance(rows, (row) => probabilityBand(row.probability))
    .sort((first, second) => Number(first.key) - Number(second.key));

  const reliable = (group: GroupPerformance) => group.sampleLevel !== "EMPTY";
  const worstLeagues = leagues.filter(reliable).sort((first, second) =>
    second.lost - first.lost ||
    (first.actualAccuracy ?? 101) - (second.actualAccuracy ?? 101),
  ).slice(0, 5);
  const worstSelections = selections.filter(reliable).sort((first, second) =>
    second.lost - first.lost ||
    (first.actualAccuracy ?? 101) - (second.actualAccuracy ?? 101),
  ).slice(0, 5);
  const bestProbabilityBands = probability
    .filter((group) => group.settled >= MINIMUM_DEVELOPING_SAMPLE)
    .sort((first, second) =>
      (second.actualAccuracy ?? -1) - (first.actualAccuracy ?? -1) ||
      second.settled - first.settled,
    ).slice(0, 3);

  return {
    leagues,
    selections,
    sides,
    quality,
    probability,
    worstLeagues,
    worstSelections,
    bestProbabilityBands,
    fairOddsPassed: rows.filter((row) => row.minimumFairOddsPassed).length,
    fairOddsBelow: rows.filter((row) => !row.minimumFairOddsPassed).length,
  };
}

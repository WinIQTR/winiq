import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import { selectIndependentValueBetRows } from "@/lib/value-bet-learning";

export type HealthLevel = "HEALTHY" | "WARNING" | "CRITICAL";
export type DriftStatus = "COLLECTING" | "STABLE" | "WARNING" | "CRITICAL";

export type DriftMetrics = {
  selections: number;
  accuracy: number;
  averageProbability: number;
  brierScore: number;
  ece: number;
};

export type ModelHealthReport = {
  overallLevel: HealthLevel;
  snapshot: { level: HealthLevel; generatedAt: Date | null; ageHours: number | null };
  odds: { level: HealthLevel; selections: number; averageSourceLagHours: number | null; staleSelections: number };
  drift: {
    status: DriftStatus;
    independentSelections: number;
    minimumRequired: number;
    baseline: DriftMetrics | null;
    recent: DriftMetrics | null;
    changes: { brier: number; ece: number; probabilityPoints: number; accuracyPoints: number } | null;
  };
  automaticProductionChangeAllowed: false;
};

const BASELINE_MINIMUM = 100;
const RECENT_WINDOW = 30;
const HOUR_MS = 60 * 60 * 1000;
const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const worst = (...levels: HealthLevel[]): HealthLevel => levels.includes("CRITICAL") ? "CRITICAL" : levels.includes("WARNING") ? "WARNING" : "HEALTHY";

function snapshotHealth(generatedAt: Date | null, now: Date): ModelHealthReport["snapshot"] {
  if (!generatedAt || Number.isNaN(generatedAt.getTime())) return { level: "CRITICAL", generatedAt: null, ageHours: null };
  const ageHours = Math.max(0, (now.getTime() - generatedAt.getTime()) / HOUR_MS);
  return { level: ageHours > 24 ? "CRITICAL" : ageHours > 8 ? "WARNING" : "HEALTHY", generatedAt, ageHours: round(ageHours, 1) };
}

function oddsHealth(rows: readonly ValueBetDashboardRow[]): ModelHealthReport["odds"] {
  if (rows.length === 0) return { level: "HEALTHY", selections: 0, averageSourceLagHours: null, staleSelections: 0 };
  const lags = rows.map((row) => Math.max(0, (row.capturedAt.getTime() - row.sourceUpdatedAt.getTime()) / HOUR_MS));
  const average = lags.reduce((total, lag) => total + lag, 0) / lags.length;
  const staleSelections = lags.filter((lag) => lag > 24).length;
  const warningSelections = lags.filter((lag) => lag > 6).length;
  const criticalRatio = staleSelections / lags.length;
  const warningRatio = warningSelections / lags.length;
  const level: HealthLevel = criticalRatio >= 0.2 ? "CRITICAL" : warningRatio >= 0.2 ? "WARNING" : "HEALTHY";
  return { level, selections: rows.length, averageSourceLagHours: round(average, 1), staleSelections };
}

function driftMetrics(rows: readonly ValueBetDashboardRow[]): DriftMetrics {
  let correct = 0;
  let probabilityTotal = 0;
  let brier = 0;
  const bins = Array.from({ length: 10 }, () => ({ count: 0, probability: 0, outcome: 0 }));
  for (const row of rows) {
    const p = Math.min(0.999999, Math.max(0.000001, row.modelProbability / 100));
    const y = row.result === "WON" ? 1 : 0;
    if ((p >= 0.5 ? 1 : 0) === y) correct += 1;
    probabilityTotal += p;
    brier += (p - y) ** 2;
    const bin = bins[Math.min(9, Math.floor(p * 10))]!;
    bin.count += 1; bin.probability += p; bin.outcome += y;
  }
  const ece = bins.reduce((total, bin) => bin.count === 0 ? total : total + (bin.count / rows.length) * Math.abs(bin.probability / bin.count - bin.outcome / bin.count), 0);
  return {
    selections: rows.length,
    accuracy: round((correct / rows.length) * 100, 1),
    averageProbability: round((probabilityTotal / rows.length) * 100, 1),
    brierScore: round(brier / rows.length, 4),
    ece: round(ece, 4),
  };
}

function driftHealth(rows: readonly ValueBetDashboardRow[]): ModelHealthReport["drift"] {
  const independent = selectIndependentValueBetRows(rows);
  const minimumRequired = BASELINE_MINIMUM + RECENT_WINDOW;
  if (independent.length < minimumRequired) {
    return { status: "COLLECTING", independentSelections: independent.length, minimumRequired, baseline: null, recent: null, changes: null };
  }
  const baselineRows = independent.slice(0, -RECENT_WINDOW);
  const recentRows = independent.slice(-RECENT_WINDOW);
  const baseline = driftMetrics(baselineRows);
  const recent = driftMetrics(recentRows);
  const changes = {
    brier: round(recent.brierScore - baseline.brierScore, 4),
    ece: round(recent.ece - baseline.ece, 4),
    probabilityPoints: round(recent.averageProbability - baseline.averageProbability, 1),
    accuracyPoints: round(recent.accuracy - baseline.accuracy, 1),
  };
  const critical = changes.brier >= 0.06 || changes.ece >= 0.1 || Math.abs(changes.probabilityPoints) >= 10 || changes.accuracyPoints <= -20;
  const warning = changes.brier >= 0.03 || changes.ece >= 0.05 || Math.abs(changes.probabilityPoints) >= 5 || changes.accuracyPoints <= -10;
  return { status: critical ? "CRITICAL" : warning ? "WARNING" : "STABLE", independentSelections: independent.length, minimumRequired, baseline, recent, changes };
}

export function buildModelHealthReport(options: {
  generatedAt: Date | null;
  upcoming: readonly ValueBetDashboardRow[];
  settled: readonly ValueBetDashboardRow[];
  now?: Date;
}): ModelHealthReport {
  const snapshot = snapshotHealth(options.generatedAt, options.now ?? new Date());
  const odds = oddsHealth(options.upcoming);
  const drift = driftHealth(options.settled);
  const driftLevel: HealthLevel = drift.status === "CRITICAL" ? "CRITICAL" : drift.status === "WARNING" ? "WARNING" : "HEALTHY";
  return {
    overallLevel: worst(snapshot.level, odds.level, driftLevel),
    snapshot, odds, drift,
    automaticProductionChangeAllowed: false,
  };
}

import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import { selectIndependentValueBetRows } from "@/lib/value-bet-learning";

export type LeagueProfileStatus = "COLLECTING" | "PRELIMINARY" | "RELIABLE" | "BROAD_SAMPLE" | "MAXIMUM_SAMPLE";

export type ValueBetLeagueProfile = {
  leagueApiId: number;
  leagueName: string;
  independentSelections: number;
  won: number;
  lost: number;
  winRate: number;
  averageModelProbability: number;
  calibrationGap: number;
  brierScore: number;
  logLoss: number;
  profitUnits: number;
  roi: number;
  reliabilityScore: number;
  status: LeagueProfileStatus;
  calibrationReady: boolean;
  reliabilityReady: boolean;
  productionUseAllowed: false;
};

export type ValueBetLeagueProfileReport = {
  independentSelections: number;
  leagues: ValueBetLeagueProfile[];
  calibrationReadyLeagues: number;
  reliableLeagues: number;
  productionUseAllowed: false;
};

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

function statusFor(sample: number): LeagueProfileStatus {
  if (sample < 40) return "COLLECTING";
  if (sample < 100) return "PRELIMINARY";
  if (sample < 500) return "RELIABLE";
  if (sample < 1000) return "BROAD_SAMPLE";
  return "MAXIMUM_SAMPLE";
}

function profile(rows: readonly ValueBetDashboardRow[]): ValueBetLeagueProfile {
  const won = rows.filter((row) => row.result === "WON").length;
  const lost = rows.length - won;
  const winRate = (won / rows.length) * 100;
  const averageModelProbability = rows.reduce((total, row) => total + row.modelProbability, 0) / rows.length;
  const calibrationGap = winRate - averageModelProbability;
  let brier = 0;
  let logLoss = 0;
  let profit = 0;

  for (const row of rows) {
    const outcome = row.result === "WON" ? 1 : 0;
    const probability = clamp(row.modelProbability / 100, 0.000001, 0.999999);
    brier += (probability - outcome) ** 2;
    logLoss += -(outcome * Math.log(probability) + (1 - outcome) * Math.log(1 - probability));
    profit += row.profitUnits ?? (outcome ? row.bestOdds - 1 : -1);
  }

  const brierScore = brier / rows.length;
  const historicalAccuracyComponent = clamp(winRate, 0, 100);
  const calibrationComponent = clamp(100 - Math.abs(calibrationGap) * 4, 0, 100);
  const sampleComponent = clamp((rows.length / 1000) * 100, 0, 100);
  const brierComponent = clamp((1 - brierScore) * 100, 0, 100);
  const reliabilityScore = (
    historicalAccuracyComponent * 0.5 +
    calibrationComponent * 0.2 +
    sampleComponent * 0.15 +
    brierComponent * 0.15
  );

  return {
    leagueApiId: rows[0]?.leagueApiId ?? 0,
    leagueName: rows[0]?.leagueName ?? "Unknown League",
    independentSelections: rows.length,
    won,
    lost,
    winRate: round(winRate, 1),
    averageModelProbability: round(averageModelProbability, 1),
    calibrationGap: round(calibrationGap, 1),
    brierScore: round(brierScore, 4),
    logLoss: round(logLoss / rows.length, 4),
    profitUnits: round(profit),
    roi: round((profit / rows.length) * 100, 1),
    reliabilityScore: round(reliabilityScore, 1),
    status: statusFor(rows.length),
    calibrationReady: rows.length >= 40,
    reliabilityReady: rows.length >= 100,
    productionUseAllowed: false,
  };
}

export function buildValueBetLeagueProfileReport(
  rows: readonly ValueBetDashboardRow[],
): ValueBetLeagueProfileReport {
  const independent = selectIndependentValueBetRows(rows);
  const groups = new Map<number, ValueBetDashboardRow[]>();
  for (const row of independent) {
    groups.set(row.leagueApiId, [...(groups.get(row.leagueApiId) ?? []), row]);
  }
  const leagues = [...groups.values()]
    .map(profile)
    .sort((a, b) => b.independentSelections - a.independentSelections || a.leagueName.localeCompare(b.leagueName));

  return {
    independentSelections: independent.length,
    leagues,
    calibrationReadyLeagues: leagues.filter((league) => league.calibrationReady).length,
    reliableLeagues: leagues.filter((league) => league.reliabilityReady).length,
    productionUseAllowed: false,
  };
}

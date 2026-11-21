import {
  DEFAULT_DECISION_ENGINE_CONFIG,
  type DecisionEngineConfig,
} from "@/modules/decision-engine/config";

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

export type ExposureCandidate = {
  id: string;
  matchId: number;
  leagueKey: string;
  kickoffAt: Date;
  /** Hypothetical bankroll fraction 0–1 (e.g. Kelly/100). */
  stakeFraction: number;
  /** Higher is better for ranking. */
  score: number;
  correlationGroup?: string;
};

export type ExposureSelection = ExposureCandidate & {
  accepted: boolean;
  rejectionReason:
    | null
    | "MATCH_PRIMARY_CAP"
    | "DAILY_SELECTION_CAP"
    | "DAILY_FRACTION_CAP"
    | "LEAGUE_FRACTION_CAP"
    | "CORRELATED_GROUP_CAP"
    | "SELECTION_FRACTION_CAP";
  allocatedFraction: number;
};

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).format(value);
}

/**
 * Enforce portfolio exposure caps: 1 primary/match, daily count, league/day
 * and correlation group fractions.
 */
export function applyExposureCaps(
  candidates: readonly ExposureCandidate[],
  config: DecisionEngineConfig["exposure"] = DEFAULT_DECISION_ENGINE_CONFIG.exposure,
): ExposureSelection[] {
  const ranked = [...candidates].sort(
    (a, b) => b.score - a.score || a.kickoffAt.getTime() - b.kickoffAt.getTime(),
  );

  const matchUsed = new Set<number>();
  const dailyCount = new Map<string, number>();
  const dailyFraction = new Map<string, number>();
  const leagueFraction = new Map<string, number>();
  const groupFraction = new Map<string, number>();

  return ranked.map((candidate) => {
    const dateKey = istanbulDateKey(candidate.kickoffAt);
    const leagueKey = `${dateKey}|${candidate.leagueKey}`;
    const groupKey = `${dateKey}|${candidate.correlationGroup ?? candidate.matchId}`;
    const cappedStake = Math.min(
      candidate.stakeFraction,
      config.maximumHypotheticalFractionPerSelection,
    );

    const reject = (
      reason: NonNullable<ExposureSelection["rejectionReason"]>,
    ): ExposureSelection => ({
      ...candidate,
      accepted: false,
      rejectionReason: reason,
      allocatedFraction: 0,
    });

    if (matchUsed.has(candidate.matchId)) return reject("MATCH_PRIMARY_CAP");
    if (
      (dailyCount.get(dateKey) ?? 0) >= config.maximumQualifiedSelectionsPerDay
    ) {
      return reject("DAILY_SELECTION_CAP");
    }
    if (cappedStake > config.maximumHypotheticalFractionPerSelection) {
      return reject("SELECTION_FRACTION_CAP");
    }
    if (
      (dailyFraction.get(dateKey) ?? 0) + cappedStake >
      config.maximumHypotheticalDailyFraction + 1e-12
    ) {
      return reject("DAILY_FRACTION_CAP");
    }
    if (
      (leagueFraction.get(leagueKey) ?? 0) + cappedStake >
      config.maximumLeagueDailyFraction + 1e-12
    ) {
      return reject("LEAGUE_FRACTION_CAP");
    }
    if (
      (groupFraction.get(groupKey) ?? 0) + cappedStake >
      config.maximumCorrelatedGroupFraction + 1e-12
    ) {
      return reject("CORRELATED_GROUP_CAP");
    }

    matchUsed.add(candidate.matchId);
    dailyCount.set(dateKey, (dailyCount.get(dateKey) ?? 0) + 1);
    dailyFraction.set(dateKey, (dailyFraction.get(dateKey) ?? 0) + cappedStake);
    leagueFraction.set(
      leagueKey,
      (leagueFraction.get(leagueKey) ?? 0) + cappedStake,
    );
    groupFraction.set(groupKey, (groupFraction.get(groupKey) ?? 0) + cappedStake);

    return {
      ...candidate,
      accepted: true,
      rejectionReason: null,
      allocatedFraction: cappedStake,
    };
  });
}

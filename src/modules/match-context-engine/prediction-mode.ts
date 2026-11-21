/**
 * Dual prediction modes (CesarIllescas MIT):
 * - early_prediction: days/hours before kickoff — no confirmed XI / late odds
 * - lineup_known_prediction: after official lineups
 */

export type PredictionMode = "early_prediction" | "lineup_known_prediction";

export type PredictionModeContext = {
  now?: Date;
  kickoffAt: Date;
  lineupStatus?: "PREDICTED" | "CONFIRMED" | string | null;
  confirmedLineupPresent?: boolean;
};

/** Feature keys that must not feed early_prediction. */
export const EARLY_FORBIDDEN_FEATURES = [
  "confirmed_starting_xi",
  "confirmed_formation",
  "confirmed_keeper",
  "late_odds",
  "closing_odds",
  "last_minute_injury_confirmed",
] as const;

export type FeatureGateResult = {
  mode: PredictionMode;
  allowed: boolean;
  reason: string | null;
};

export function resolvePredictionMode(
  context: PredictionModeContext,
): PredictionMode {
  const confirmed =
    context.confirmedLineupPresent === true ||
    context.lineupStatus === "CONFIRMED";
  if (confirmed) return "lineup_known_prediction";
  return "early_prediction";
}

export function isFeatureAllowedInMode(
  featureKey: string,
  mode: PredictionMode,
): FeatureGateResult {
  const normalized = featureKey.trim().toLowerCase();
  const forbidden = EARLY_FORBIDDEN_FEATURES.some(
    (key) => normalized === key || normalized.includes(key),
  );
  if (mode === "early_prediction" && forbidden) {
    return {
      mode,
      allowed: false,
      reason: `Feature "${featureKey}" is blocked in early_prediction`,
    };
  }
  return { mode, allowed: true, reason: null };
}

export function filterFeaturesForMode<T extends { key: string }>(
  features: readonly T[],
  mode: PredictionMode,
): { kept: T[]; blocked: T[] } {
  const kept: T[] = [];
  const blocked: T[] = [];
  for (const feature of features) {
    if (isFeatureAllowedInMode(feature.key, mode).allowed) kept.push(feature);
    else blocked.push(feature);
  }
  return { kept, blocked };
}

export function hoursUntilKickoff(
  kickoffAt: Date,
  now: Date = new Date(),
): number {
  return Math.max(0, (kickoffAt.getTime() - now.getTime()) / (1000 * 60 * 60));
}

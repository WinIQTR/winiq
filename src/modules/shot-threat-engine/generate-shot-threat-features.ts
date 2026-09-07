import {
  calculateTeamShotThreat,
} from "./calculate-team-shot-threat";

export const SHOT_THREAT_FEATURE_KEYS = [
  "shots_per_game",
  "shots_on_target_per_game",
  "shot_accuracy",
  "possession_average",
  "corners_per_game",
  "attacking_pressure",
  "last5_shots_per_game",
  "last5_shots_on_target_per_game",
  "last5_attacking_pressure",
] as const;

export type ShotThreatFeatureKey =
  (typeof SHOT_THREAT_FEATURE_KEYS)[number];

export type GeneratedShotThreatFeature = {
  key:
    ShotThreatFeatureKey;

  rawValue:
    number | null;

  dataQualityScore:
    number;
};

export async function generateShotThreatFeatures(
  teamId: number,
  season: number,
  beforeDate: Date,
): Promise<
  GeneratedShotThreatFeature[]
> {
  const statistics =
    await calculateTeamShotThreat({
      teamId,
      season,
      beforeDate,
    });

  const quality =
    statistics.dataQualityScore;

  return [
    {
      key:
        "shots_per_game",

      rawValue:
        statistics.shotsPerGame,

      dataQualityScore:
        quality,
    },

    {
      key:
        "shots_on_target_per_game",

      rawValue:
        statistics.shotsOnTargetPerGame,

      dataQualityScore:
        quality,
    },

    {
      key:
        "shot_accuracy",

      rawValue:
        statistics.shotAccuracy,

      dataQualityScore:
        quality,
    },

    {
      key:
        "possession_average",

      rawValue:
        statistics.possessionAverage,

      dataQualityScore:
        quality,
    },

    {
      key:
        "corners_per_game",

      rawValue:
        statistics.cornersPerGame,

      dataQualityScore:
        quality,
    },

    {
      key:
        "attacking_pressure",

      rawValue:
        statistics.attackingPressureScore,

      dataQualityScore:
        quality,
    },

    {
      key:
        "last5_shots_per_game",

      rawValue:
        statistics.last5ShotsPerGame,

      dataQualityScore:
        quality,
    },

    {
      key:
        "last5_shots_on_target_per_game",

      rawValue:
        statistics.last5ShotsOnTargetPerGame,

      dataQualityScore:
        quality,
    },

    {
      key:
        "last5_attacking_pressure",

      rawValue:
        statistics.last5AttackingPressureScore,

      dataQualityScore:
        quality,
    },
  ];
}
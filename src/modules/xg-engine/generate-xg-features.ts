import { calculateTeamXg } from "./calculate-team-xg";

export const XG_FEATURE_KEYS = [
  "expected_goals_per_game",
  "expected_goals_against_per_game",
  "expected_goals_difference",
  "last5_expected_goals",
  "last5_expected_goals_against",
  "last5_expected_goals_difference",
] as const;

export type XgFeatureKey =
  (typeof XG_FEATURE_KEYS)[number];

export type GeneratedXgFeature = {
  key: XgFeatureKey;
  rawValue: number | null;
  dataQualityScore: number;
};

export async function generateXgFeatures(
  teamId: number,
  season: number,
  beforeDate: Date,
): Promise<GeneratedXgFeature[]> {
  const xg = await calculateTeamXg({
    teamId,
    season,
    beforeDate,
  });

  return [
    {
      key: "expected_goals_per_game",
      rawValue: xg.averageXg,
      dataQualityScore: xg.dataQuality,
    },
    {
      key: "expected_goals_against_per_game",
      rawValue: xg.averageXga,
      dataQualityScore: xg.dataQuality,
    },
    {
      key: "expected_goals_difference",
      rawValue: xg.averageXgd,
      dataQualityScore: xg.dataQuality,
    },
    {
      key: "last5_expected_goals",
      rawValue: xg.last5AverageXg,
      dataQualityScore: xg.dataQuality,
    },
    {
      key: "last5_expected_goals_against",
      rawValue: xg.last5AverageXga,
      dataQualityScore: xg.dataQuality,
    },
    {
      key: "last5_expected_goals_difference",
      rawValue: xg.last5AverageXgd,
      dataQualityScore: xg.dataQuality,
    },
  ];
}
import {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "@/generated/prisma/client";

import {
  registerFeature,
} from "@/modules/feature-registry";

export const H2H_FEATURE_KEYS = [
  "h2h_home_win_rate",
  "h2h_draw_rate",
  "h2h_away_win_rate",
  "h2h_home_goals_per_game",
  "h2h_away_goals_per_game",
  "h2h_total_goals_per_game",
] as const;

export type H2hFeatureKey =
  (typeof H2H_FEATURE_KEYS)[number];

export function registerHeadToHeadFeatures():
  void {
  registerFeature({
    key: "h2h_home_win_rate",
    name: "H2H Home Win Rate",
    description:
      "Current home team's win percentage in previous head-to-head meetings.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.PERCENTAGE,
    status: FeatureStatus.ACTIVE,

    unit: "%",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });

  registerFeature({
    key: "h2h_draw_rate",
    name: "H2H Draw Rate",
    description:
      "Draw percentage in previous head-to-head meetings.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.PERCENTAGE,
    status: FeatureStatus.ACTIVE,

    unit: "%",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: null,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });

  registerFeature({
    key: "h2h_away_win_rate",
    name: "H2H Away Win Rate",
    description:
      "Current away team's win percentage in previous head-to-head meetings.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.PERCENTAGE,
    status: FeatureStatus.ACTIVE,

    unit: "%",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });

  registerFeature({
    key: "h2h_home_goals_per_game",
    name: "H2H Home Goals Per Game",
    description:
      "Average goals scored by the current home team in previous meetings.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.NUMBER,
    status: FeatureStatus.ACTIVE,

    unit: "goals/game",
    minimumValue: 0,
    maximumValue: 6,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });

  registerFeature({
    key: "h2h_away_goals_per_game",
    name: "H2H Away Goals Per Game",
    description:
      "Average goals scored by the current away team in previous meetings.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.NUMBER,
    status: FeatureStatus.ACTIVE,

    unit: "goals/game",
    minimumValue: 0,
    maximumValue: 6,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });

  registerFeature({
    key: "h2h_total_goals_per_game",
    name: "H2H Total Goals Per Game",
    description:
      "Average total goals in previous meetings between the two teams.",

    scope: FeatureScope.MATCH,
    category: FeatureCategory.HEAD_TO_HEAD,
    valueType: FeatureValueType.NUMBER,
    status: FeatureStatus.ACTIVE,

    unit: "goals/game",
    minimumValue: 0,
    maximumValue: 10,
    higherIsBetter: null,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: "h2h-v1",
  });
}
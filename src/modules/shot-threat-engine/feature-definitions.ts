import {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "@/generated/prisma/client";

import {
  registerFeature,
} from "@/modules/feature-registry";

import {
  SHOT_THREAT_FEATURE_KEYS,
} from "./generate-shot-threat-features";

export type ShotThreatFeatureKey =
  (typeof SHOT_THREAT_FEATURE_KEYS)[number];

export function registerShotThreatFeatures(): void {
  const definitions: Array<{
    key: ShotThreatFeatureKey;

    name: string;

    description: string;

    unit: string;

    minimumValue: number;

    maximumValue: number;

    higherIsBetter:
      boolean | null;
  }> = [
    {
      key:
        "shots_per_game",

      name:
        "Shots Per Game",

      description:
        "Average total shots per match before kickoff.",

      unit:
        "shots/game",

      minimumValue:
        0,

      maximumValue:
        30,

      higherIsBetter:
        true,
    },

    {
      key:
        "shots_on_target_per_game",

      name:
        "Shots On Target Per Game",

      description:
        "Average shots on target per match before kickoff.",

      unit:
        "shots/game",

      minimumValue:
        0,

      maximumValue:
        15,

      higherIsBetter:
        true,
    },

    {
      key:
        "shot_accuracy",

      name:
        "Shot Accuracy",

      description:
        "Percentage of total shots that were on target.",

      unit:
        "%",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,
    },

    {
      key:
        "possession_average",

      name:
        "Average Possession",

      description:
        "Average possession percentage before kickoff.",

      unit:
        "%",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,
    },

    {
      key:
        "corners_per_game",

      name:
        "Corners Per Game",

      description:
        "Average corners earned per match before kickoff.",

      unit:
        "corners/game",

      minimumValue:
        0,

      maximumValue:
        15,

      higherIsBetter:
        true,
    },

    {
      key:
        "attacking_pressure",

      name:
        "Attacking Pressure",

      description:
        "Composite attacking pressure score based on shots, shots on target, possession and corners.",

      unit:
        "score",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,
    },

    {
      key:
        "last5_shots_per_game",

      name:
        "Last 5 Shots Per Game",

      description:
        "Average total shots across the most recent five matches before kickoff.",

      unit:
        "shots/game",

      minimumValue:
        0,

      maximumValue:
        30,

      higherIsBetter:
        true,
    },

    {
      key:
        "last5_shots_on_target_per_game",

      name:
        "Last 5 Shots On Target Per Game",

      description:
        "Average shots on target across the most recent five matches before kickoff.",

      unit:
        "shots/game",

      minimumValue:
        0,

      maximumValue:
        15,

      higherIsBetter:
        true,
    },

    {
      key:
        "last5_attacking_pressure",

      name:
        "Last 5 Attacking Pressure",

      description:
        "Composite attacking pressure score across the most recent five matches before kickoff.",

      unit:
        "score",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,
    },
  ];

  for (
    const definition
    of definitions
  ) {
    registerFeature({
      key:
        definition.key,

      name:
        definition.name,

      description:
        definition.description,

      scope:
        FeatureScope.TEAM,

      /*
       * Prisma enum'umuzda FORM yok.
       *
       * Shot Threat oyuncu/takımın
       * yakın dönem performansını
       * temsil ettiği için RECENT_FORM
       * kategorisine bağlıyoruz.
       */
      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        definition.unit,

      minimumValue:
        definition.minimumValue,

      maximumValue:
        definition.maximumValue,

      higherIsBetter:
        definition.higherIsBetter,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_TEAM_STATISTICS",

      calculationVersion:
        "shot-threat-v1",
    });
  }
}
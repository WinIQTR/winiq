import {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "@/generated/prisma/client";

import {
  registerFeature,
} from "@/modules/feature-registry";

export const SQUAD_STRENGTH_FEATURE_KEYS = [
  "squad_strength",
  "starting_eleven_strength",
  "bench_strength",
  "goalkeeper_strength",
  "defence_strength",
  "midfield_strength",
  "attack_strength",
  "squad_depth",
  "lineup_certainty",
] as const;

export type SquadStrengthFeatureKey =
  (typeof SQUAD_STRENGTH_FEATURE_KEYS)[number];

const VERSION =
  "squad-strength-v1";

export function registerSquadStrengthFeatures():
  void {
  registerFeature({
    key: "squad_strength",
    name: "Squad Strength",
    description:
      "Overall pre-match squad strength derived from player impact scores and lineup information.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "starting_eleven_strength",
    name: "Starting Eleven Strength",
    description:
      "Combined strength of the expected or confirmed starting eleven.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "bench_strength",
    name: "Bench Strength",
    description:
      "Strength and quality of the available substitute players.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "goalkeeper_strength",
    name: "Goalkeeper Strength",
    description:
      "Pre-match strength score of the goalkeeper unit.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "defence_strength",
    name: "Defence Strength",
    description:
      "Pre-match strength score of the defensive unit.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "midfield_strength",
    name: "Midfield Strength",
    description:
      "Pre-match strength score of the midfield unit.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "attack_strength",
    name: "Attack Strength",
    description:
      "Pre-match strength score of the attacking unit.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "squad_depth",
    name: "Squad Depth",
    description:
      "Depth of the available squad beyond the starting eleven.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.NUMBER,
    status:
      FeatureStatus.ACTIVE,

    unit: "score",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });

  registerFeature({
    key: "lineup_certainty",
    name: "Lineup Certainty",
    description:
      "Confidence score representing how certain the pre-match lineup information is.",

    scope: FeatureScope.TEAM,
    category:
      FeatureCategory.SQUAD_AVAILABILITY,
    valueType:
      FeatureValueType.PERCENTAGE,
    status:
      FeatureStatus.ACTIVE,

    unit: "%",
    minimumValue: 0,
    maximumValue: 100,
    higherIsBetter: true,

    availableBeforeMatch: true,
    requiredDataSource: "INTERNAL",
    calculationVersion: VERSION,
  });
}
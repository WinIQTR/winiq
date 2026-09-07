import {
  FeatureStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  normalizeFeatureValue,
} from "@/modules/feature-engine/normalize-feature-value";

import {
  generateSquadFeatures,
} from "./generate-squad-features";

import {
  SQUAD_STRENGTH_FEATURE_KEYS,
  type SquadStrengthFeatureKey,
} from "./feature-definitions";

export type SaveSquadFeaturesResult = {
  matchId: number;
  teamId: number;

  calculationRunId: string;

  createdCount: number;
  updatedCount: number;
  missingCount: number;

  values: Array<{
    key: SquadStrengthFeatureKey;
    rawValue: number | null;
    normalizedValue: number | null;
    dataQualityScore: number;
  }>;
};

export async function saveSquadFeatures(
  options: {
    matchId: number;
    teamId: number;

    calculationRunId: string;

    effectiveCalculatedAt: Date;
  },
): Promise<SaveSquadFeaturesResult> {
  const {
    matchId,
    teamId,
    calculationRunId,
    effectiveCalculatedAt,
  } = options;

  const generated =
    await generateSquadFeatures({
      matchId,
      teamId,
    });

  const generatedByKey =
    new Map(
      generated.map(
        (feature) => [
          feature.key,
          feature,
        ],
      ),
    );

  const definitions =
    await prisma.featureDefinition.findMany({
      where: {
        key: {
          in: [
            ...SQUAD_STRENGTH_FEATURE_KEYS,
          ],
        },

        status:
          FeatureStatus.ACTIVE,
      },

      orderBy: {
        key:
          "asc",
      },
    });

  let createdCount = 0;
  let updatedCount = 0;
  let missingCount = 0;

  const savedValues:
    SaveSquadFeaturesResult["values"] =
      [];

  for (
    const definition
    of definitions
  ) {
    const key =
      definition.key as
        SquadStrengthFeatureKey;

    const generatedFeature =
      generatedByKey.get(
        key,
      );

    const rawValue =
      generatedFeature?.rawValue ??
      null;

    const dataQualityScore =
      rawValue === null
        ? 0
        : generatedFeature
            ?.dataQualityScore ??
          0;

    const canNormalize =
      rawValue !== null &&
      Number.isFinite(
        rawValue,
      ) &&
      definition.minimumValue !==
        null &&
      definition.maximumValue !==
        null &&
      definition.higherIsBetter !==
        null;

    const normalizedValue =
      canNormalize
        ? normalizeFeatureValue({
            rawValue:
              rawValue as number,

            minimumValue:
              definition.minimumValue as number,

            maximumValue:
              definition.maximumValue as number,

            higherIsBetter:
              definition.higherIsBetter as boolean,
          })
        : null;

    if (
      rawValue === null
    ) {
      missingCount += 1;
    }

    const uniqueKey = {
      matchId,
      featureId:
        definition.id,
      teamId,
      calculationRunId,
    };

    const existing =
      await prisma.matchFeatureValue.findUnique({
        where: {
          matchId_featureId_teamId_calculationRunId:
            uniqueKey,
        },

        select: {
          id: true,
        },
      });

    await prisma.matchFeatureValue.upsert({
      where: {
        matchId_featureId_teamId_calculationRunId:
          uniqueKey,
      },

      update: {
        numericValue:
          rawValue,

        textValue:
          null,

        booleanValue:
          null,

        normalizedValue,

        dataQualityScore,

        source:
          "INTERNAL_SQUAD_STRENGTH",

        sourceUpdatedAt:
          effectiveCalculatedAt,

        calculatedAt:
          effectiveCalculatedAt,
      },

      create: {
        matchId,
        featureId:
          definition.id,
        teamId,

        numericValue:
          rawValue,

        textValue:
          null,

        booleanValue:
          null,

        normalizedValue,

        dataQualityScore,

        source:
          "INTERNAL_SQUAD_STRENGTH",

        sourceUpdatedAt:
          effectiveCalculatedAt,

        calculationRunId,

        calculatedAt:
          effectiveCalculatedAt,
      },
    });

    if (
      existing
    ) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }

    savedValues.push({
      key,
      rawValue,
      normalizedValue,
      dataQualityScore,
    });
  }

  return {
    matchId,
    teamId,
    calculationRunId,

    createdCount,
    updatedCount,
    missingCount,

    values:
      savedValues,
  };
}
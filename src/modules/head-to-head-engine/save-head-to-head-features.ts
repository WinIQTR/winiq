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
  calculateHeadToHead,
} from "./calculate-head-to-head";

import {
  H2H_FEATURE_KEYS,
  type H2hFeatureKey,
} from "./feature-definitions";

export type SaveHeadToHeadFeaturesResult = {
  matchId: number;
  calculationRunId: string;

  sampleSize: number;

  createdCount: number;
  updatedCount: number;

  values: Array<{
    key: H2hFeatureKey;
    rawValue: number;
    normalizedValue: number | null;
    dataQualityScore: number;
  }>;

  warnings: string[];
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function calculateH2hQuality(
  sampleSize: number,
  expectedMatches = 5,
): number {
  if (
    sampleSize <= 0
  ) {
    return 0;
  }

  return round(
    Math.min(
      sampleSize /
        expectedMatches,
      1,
    ) * 100,
  );
}

export async function saveHeadToHeadFeatures(
  options: {
    matchId: number;
    calculationRunId: string;
    effectiveCalculatedAt: Date;
    limit?: number;
  },
): Promise<SaveHeadToHeadFeaturesResult> {
  const {
    matchId,
    calculationRunId,
    effectiveCalculatedAt,
    limit = 5,
  } = options;

  const h2h =
    await calculateHeadToHead(
      matchId,
      limit,
    );

  const quality =
    calculateH2hQuality(
      h2h.sampleSize,
      limit,
    );

  const values: Record<
    H2hFeatureKey,
    number
  > = {
    h2h_home_win_rate:
      h2h.homeWinRate,

    h2h_draw_rate:
      h2h.drawRate,

    h2h_away_win_rate:
      h2h.awayWinRate,

    h2h_home_goals_per_game:
      h2h.homeGoalsPerGame,

    h2h_away_goals_per_game:
      h2h.awayGoalsPerGame,

    h2h_total_goals_per_game:
      h2h.totalGoalsPerGame,
  };

  const definitions =
    await prisma.featureDefinition.findMany({
      where: {
        key: {
          in: [
            ...H2H_FEATURE_KEYS,
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

  let createdCount =
    0;

  let updatedCount =
    0;

  const savedValues:
    SaveHeadToHeadFeaturesResult["values"] =
      [];

  for (
    const definition
    of definitions
  ) {
    const key =
      definition.key as
        H2hFeatureKey;

    const rawValue =
      values[key];

    const canNormalize =
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
            rawValue,

            minimumValue:
              definition.minimumValue as number,

            maximumValue:
              definition.maximumValue as number,

            higherIsBetter:
              definition.higherIsBetter as boolean,
          })
        : null;

    const existing =
      await prisma.matchFeatureValue.findFirst({
        where: {
          matchId,

          featureId:
            definition.id,

          teamId:
            null,

          calculationRunId,
        },

        select: {
          id:
            true,
        },
      });

    if (
      existing
    ) {
      await prisma.matchFeatureValue.update({
        where: {
          id:
            existing.id,
        },

        data: {
          numericValue:
            rawValue,

          textValue:
            null,

          booleanValue:
            null,

          normalizedValue,

          dataQualityScore:
            quality,

          source:
            "INTERNAL_H2H",

          sourceUpdatedAt:
            h2h.matches[0]
              ?.kickoffAt ??
            null,

          calculatedAt:
            effectiveCalculatedAt,
        },
      });

      updatedCount +=
        1;
    } else {
      await prisma.matchFeatureValue.create({
        data: {
          matchId,

          featureId:
            definition.id,

          teamId:
            null,

          numericValue:
            rawValue,

          textValue:
            null,

          booleanValue:
            null,

          normalizedValue,

          dataQualityScore:
            quality,

          source:
            "INTERNAL_H2H",

          sourceUpdatedAt:
            h2h.matches[0]
              ?.kickoffAt ??
            null,

          calculationRunId,

          calculatedAt:
            effectiveCalculatedAt,
        },
      });

      createdCount +=
        1;
    }

    savedValues.push({
      key,
      rawValue,
      normalizedValue,
      dataQualityScore:
        quality,
    });
  }

  return {
    matchId,
    calculationRunId,

    sampleSize:
      h2h.sampleSize,

    createdCount,
    updatedCount,

    values:
      savedValues,

    warnings:
      h2h.warnings,
  };
}
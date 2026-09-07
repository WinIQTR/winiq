import {
  prisma,
} from "@/lib/prisma";

import {
  ACTIVE_CALCULATION_RUN_ID,
  loadActiveFeatureModel,
} from "@/modules/feature-engine";

import {
  CATEGORY_WEIGHTS,
  RATING_CATEGORIES,
  RATING_GROUPS,
} from "./rating-groups";

import type {
  CategoryRating,
  RatingCategory,
  RatingFeatureContribution,
  TeamRating,
} from "./types";

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function calculatePercentage(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator <=
    0
  ) {
    return 0;
  }

  return round(
    clamp(
      (
        numerator /
        denominator
      ) *
        100,
      0,
      100,
    ),
  );
}

type LoadedModel =
  Awaited<
    ReturnType<
      typeof loadActiveFeatureModel
    >
  >;

type StoredFeatureValue =
  Awaited<
    ReturnType<
      typeof prisma.matchFeatureValue.findMany
    >
  >[number];

function calculateCategoryRating(
  options: {
    category: RatingCategory;

    model: LoadedModel;

    storedValuesByKey: Map<
      string,
      StoredFeatureValue
    >;
  },
): CategoryRating {
  const featureKeys =
    RATING_GROUPS[
      options.category
    ];

  /*
   * Yalnızca aktif modelde ağırlığı bulunan
   * feature'lar kategori hesabına girer.
   */
  const modelFeatures =
    options.model.features.filter(
      (
        feature,
      ) =>
        featureKeys.includes(
          feature.key,
        ),
    );

  const configuredWeight =
    modelFeatures.reduce(
      (
        total,
        feature,
      ) =>
        total +
        Math.max(
          feature.weight,
          0,
        ),

      0,
    );

  let availableWeight =
    0;

  let effectiveWeight =
    0;

  let weightedScoreTotal =
    0;

  const contributions:
    RatingFeatureContribution[] =
      [];

  for (
    const modelFeature
    of modelFeatures
  ) {
    const storedValue =
      options
        .storedValuesByKey
        .get(
          modelFeature.key,
        );

    if (
      !storedValue ||
      storedValue.numericValue ===
        null ||
      storedValue.normalizedValue ===
        null ||
      !Number.isFinite(
        storedValue.normalizedValue,
      )
    ) {
      continue;
    }

    const dataQualityScore =
      clamp(
        storedValue.dataQualityScore,
        0,
        100,
      );

    const featureWeight =
      Math.max(
        modelFeature.weight,
        0,
      );

    const qualityMultiplier =
      dataQualityScore /
      100;

    const featureEffectiveWeight =
      featureWeight *
      qualityMultiplier;

    const weightedContribution =
      storedValue.normalizedValue *
      featureEffectiveWeight;

    availableWeight +=
      featureWeight;

    effectiveWeight +=
      featureEffectiveWeight;

    weightedScoreTotal +=
      weightedContribution;

    contributions.push({
      key:
        modelFeature.key,

      name:
        modelFeature.name,

      normalizedValue:
        storedValue.normalizedValue,

      configuredWeight:
        round(
          featureWeight,
          6,
        ),

      effectiveWeight:
        round(
          featureEffectiveWeight,
          6,
        ),

      dataQualityScore,

      weightedContribution:
        round(
          weightedContribution,
          4,
        ),
    });
  }

  const score =
    effectiveWeight >
    0
      ? round(
          weightedScoreTotal /
            effectiveWeight,
        )
      : null;

  const coveragePercentage =
    calculatePercentage(
      availableWeight,
      configuredWeight,
    );

  const averageDataQuality =
    availableWeight >
    0
      ? calculatePercentage(
          effectiveWeight,
          availableWeight,
        )
      : 0;

  /*
   * Kategori güveni:
   *
   * %65 feature kapsamı
   * %35 veri kalitesi
   *
   * Bir feature mevcut ancak veri kalitesi
   * düşükse confidence azalır.
   */
  const confidenceScore =
    round(
      clamp(
        coveragePercentage *
          0.65 +
          averageDataQuality *
            0.35,
        0,
        100,
      ),
    );

  return {
    category:
      options.category,

    score,
    confidenceScore,

    configuredWeight:
      round(
        configuredWeight,
        6,
      ),

    availableWeight:
      round(
        availableWeight,
        6,
      ),

    effectiveWeight:
      round(
        effectiveWeight,
        6,
      ),

    coveragePercentage,

    configuredFeatureCount:
      modelFeatures.length,

    usedFeatureCount:
      contributions.length,

    missingFeatureCount:
      modelFeatures.length -
      contributions.length,

    contributions,
  };
}

function resolveCalculationRunId(
  options: {
    matchId: number;
    kickoffAt: Date;
  },
): string {
  const historicalBoundary =
    new Date(
      "2025-08-01T00:00:00.000Z",
    );

  if (
    options.kickoffAt <
    historicalBoundary
  ) {
    return [
      "historical-premier-league-2024-v1-match",
      options.matchId,
    ].join(
      "-",
    );
  }

  return ACTIVE_CALCULATION_RUN_ID;
}

export async function calculateTeamRating(
  options: {
    matchId: number;
    teamId: number;
  },
): Promise<TeamRating> {
  const {
    matchId,
    teamId,
  } =
    options;

  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <=
      0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      teamId,
    ) ||
    teamId <=
      0
  ) {
    throw new Error(
      "teamId pozitif bir tam sayı olmalıdır.",
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      include: {
        homeTeam:
          true,

        awayTeam:
          true,
      },
    });

  if (
    !match
  ) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  if (
    match.homeTeamId !==
      teamId &&
    match.awayTeamId !==
      teamId
  ) {
    throw new Error(
      `${teamId} ID değerine sahip takım bu maçta yer almıyor.`,
    );
  }

  const team =
    match.homeTeamId ===
    teamId
      ? match.homeTeam
      : match.awayTeam;

  const model =
    await loadActiveFeatureModel();

  const calculationRunId =
    resolveCalculationRunId({
      matchId:
        match.id,

      kickoffAt:
        match.kickoffAt,
    });

  const storedValues =
    await prisma.matchFeatureValue.findMany({
      where: {
        matchId,
        teamId,
        calculationRunId,
      },

      orderBy: {
        calculatedAt:
          "desc",
      },
    });

  const storedValuesByKey =
    new Map<
      string,
      StoredFeatureValue
    >();

  /*
   * Aynı feature için birden fazla kayıt
   * varsa en güncel kayıt kullanılır.
   */
  for (
    const storedValue
    of storedValues
  ) {
    const feature =
      model.features.find(
        (
          item,
        ) =>
          item.id ===
          storedValue.featureId,
      );

    if (
      feature &&
      !storedValuesByKey.has(
        feature.key,
      )
    ) {
      storedValuesByKey.set(
        feature.key,
        storedValue,
      );
    }
  }

  const categories =
    RATING_CATEGORIES.map(
      (
        category,
      ) =>
        calculateCategoryRating({
          category,
          model,
          storedValuesByKey,
        }),
    );

  const categoryByName =
    new Map(
      categories.map(
        (
          category,
        ) => [
          category.category,
          category,
        ],
      ),
    );

  let overallEffectiveWeight =
    0;

  let overallWeightedScore =
    0;

  let availableCategoryWeight =
    0;

  for (
    const category
    of categories
  ) {
    if (
      category.score ===
      null
    ) {
      continue;
    }

    const configuredCategoryWeight =
      CATEGORY_WEIGHTS[
        category.category
      ];

    const confidenceMultiplier =
      category.confidenceScore /
      100;

    const categoryEffectiveWeight =
      configuredCategoryWeight *
      confidenceMultiplier;

    availableCategoryWeight +=
      configuredCategoryWeight;

    overallEffectiveWeight +=
      categoryEffectiveWeight;

    overallWeightedScore +=
      category.score *
      categoryEffectiveWeight;
  }

  const overall =
    overallEffectiveWeight >
    0
      ? round(
          overallWeightedScore /
            overallEffectiveWeight,
        )
      : null;

  const totalCategoryWeight =
    Object.values(
      CATEGORY_WEIGHTS,
    ).reduce(
      (
        total,
        weight,
      ) =>
        total +
        weight,

      0,
    );

  const categoryCoverage =
    calculatePercentage(
      availableCategoryWeight,
      totalCategoryWeight,
    );

  const weightedCategoryConfidence =
    categories.reduce(
      (
        total,
        category,
      ) => {
        if (
          category.score ===
          null
        ) {
          return total;
        }

        return (
          total +
          category.confidenceScore *
            CATEGORY_WEIGHTS[
              category.category
            ]
        );
      },

      0,
    );

  const averageCategoryConfidence =
    availableCategoryWeight >
    0
      ? round(
          weightedCategoryConfidence /
            availableCategoryWeight,
        )
      : 0;

  /*
   * Genel güven:
   *
   * %35 kategori kapsamı
   * %65 kategori içi veri güveni
   */
  const confidenceScore =
    round(
      clamp(
        categoryCoverage *
          0.35 +
          averageCategoryConfidence *
            0.65,
        0,
        100,
      ),
    );

  return {
    matchId,
    teamId,

    teamName:
      team.name,

    form:
      categoryByName.get(
        "form",
      )?.score ??
      null,

    attack:
      categoryByName.get(
        "attack",
      )?.score ??
      null,

    defense:
      categoryByName.get(
        "defense",
      )?.score ??
      null,

    venue:
      categoryByName.get(
        "venue",
      )?.score ??
      null,

    xg:
      categoryByName.get(
        "xg",
      )?.score ??
      null,

    shotThreat:
      categoryByName.get(
        "shotThreat",
      )?.score ??
      null,

    fitness:
      categoryByName.get(
        "fitness",
      )?.score ??
      null,

    overall,
    confidenceScore,

    calculationRunId,

    modelVersion:
      model.version,

    categories,
  };
}
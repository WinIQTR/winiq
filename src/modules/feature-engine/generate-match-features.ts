import {
  FeatureStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateTeamForm,
} from "@/modules/statistics-engine/calculate-team-form";

import {
  generateXgFeatures,
  XG_FEATURE_KEYS,
  type XgFeatureKey,
} from "@/modules/xg-engine";

import {
  generateShotThreatFeatures,
  SHOT_THREAT_FEATURE_KEYS,
  type ShotThreatFeatureKey,
} from "@/modules/shot-threat-engine";

import {
  normalizeFeatureValue,
} from "./normalize-feature-value";

/*
 * Canlı maçlar için güncel Feature Engine V2
 * calculation run kimliği.
 */
export const ACTIVE_CALCULATION_RUN_ID =
  "team-form-v2-venue-xg-shot-v0.5-live";

/*
 * Tarihsel 2024 snapshot yapısı şimdilik
 * korunmaktadır.
 */
export const HISTORICAL_SNAPSHOT_RUN_PREFIX =
  "historical-premier-league-2024-v1";

const FORM_FEATURE_KEYS = [
  /*
   * Mevcut son 5 form feature'ları.
   */
  "last_5_points_per_game",
  "goals_scored_per_game",
  "goals_conceded_per_game",

  /*
   * Feature Engine V2 — genel son 10 form.
   */
  "last_10_points_per_game",
  "last_10_goals_scored_per_game",
  "last_10_goals_conceded_per_game",

  /*
   * Ev sahibi için iç saha,
   * deplasman takımı için dış saha formu.
   */
  "venue_last_5_points_per_game",
  "venue_goals_scored_per_game",
  "venue_goals_conceded_per_game",

  /*
   * Saha bazlı son 10 form.
   */
  "venue_last_10_points_per_game",
  "venue_last_10_goals_scored_per_game",
  "venue_last_10_goals_conceded_per_game",

  /*
   * Son 10 maç sonuç ve gol profili.
   */
  "win_rate",
  "draw_rate",
  "loss_rate",
  "clean_sheet_rate",
  "btts_rate",
  "over_2_5_rate",
  "goal_difference_per_game",

  /*
   * Son 5 ile son 10 arasındaki değişim.
   */
  "form_momentum",

  /*
   * Dinlenme ve maç yoğunluğu.
   */
  "fixture_congestion_14_days",
  "rest_days",

  /*
   * Kadro verisi sonraki aşamada üretilecek.
   */
  "starting_eleven_quality",
] as const;

const SUPPORTED_FEATURE_KEYS = [
  ...FORM_FEATURE_KEYS,
  ...XG_FEATURE_KEYS,
  ...SHOT_THREAT_FEATURE_KEYS,
] as const;

type FormFeatureKey =
  (typeof FORM_FEATURE_KEYS)[number];

type SupportedFeatureKey =
  | FormFeatureKey
  | XgFeatureKey
  | ShotThreatFeatureKey;

type MatchVenue =
  | "HOME"
  | "AWAY";

type TeamRawFeatureValue = {
  rawValue: number | null;
  dataQualityScore: number;
};

type TeamRawFeatureValues = Record<
  SupportedFeatureKey,
  TeamRawFeatureValue
>;

export type GenerateMatchFeaturesOptions = {
  matchId: number;

  calculationRunId?: string;

  /*
   * Feature hesaplamasının hangi zamandan önceki
   * verileri kullanacağını belirtir.
   */
  snapshotTime?: Date;

  /*
   * Tarihsel replay işlemlerinde calculatedAt
   * değerini kontrol eder.
   */
  effectiveCalculatedAt?: Date;
};

export type GeneratedTeamFeatures = {
  teamId: number;
  teamName: string;

  createdCount: number;
  updatedCount: number;
  missingCount: number;

  values: Array<{
    key: string;
    rawValue: number | null;
    normalizedValue: number | null;
    dataQualityScore: number;
  }>;
};

export type GenerateMatchFeaturesResult = {
  match: {
    id: number;
    apiId: number;
    kickoffAt: Date;
    homeTeam: string;
    awayTeam: string;
  };

  calculationRunId: string;
  snapshotTime: Date;
  effectiveCalculatedAt: Date;

  home: GeneratedTeamFeatures;
  away: GeneratedTeamFeatures;
};

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

function calculateHistoryQuality(
  matchesUsed: number,
  expectedMatches: number,
): number {
  if (
    matchesUsed <=
    0
  ) {
    return 0;
  }

  return round(
    Math.min(
      matchesUsed /
        expectedMatches,
      1,
    ) *
      100,
  );
}

function calculateDifference(
  firstValue: number | null,
  secondValue: number | null,
): number | null {
  if (
    firstValue ===
      null ||
    secondValue ===
      null
  ) {
    return null;
  }

  return round(
    firstValue -
      secondValue,
  );
}

function validateCalculationRunId(
  calculationRunId: string,
): void {
  if (
    calculationRunId
      .trim()
      .length ===
    0
  ) {
    throw new Error(
      "calculationRunId boş olamaz.",
    );
  }

  if (
    calculationRunId.length >
    190
  ) {
    throw new Error(
      "calculationRunId en fazla 190 karakter olabilir.",
    );
  }
}

function normalizeGenerateOptions(
  input:
    | number
    | GenerateMatchFeaturesOptions,
): GenerateMatchFeaturesOptions {
  if (
    typeof input ===
    "number"
  ) {
    return {
      matchId:
        input,

      calculationRunId:
        ACTIVE_CALCULATION_RUN_ID,
    };
  }

  return {
    ...input,

    calculationRunId:
      input.calculationRunId ??
      ACTIVE_CALCULATION_RUN_ID,
  };
}

async function buildTeamRawFeatureValues(
  options: {
    teamId: number;
    seasonYear: number;
    beforeDate: Date;
    venue: MatchVenue;
  },
): Promise<{
  values: TeamRawFeatureValues;
  sourceUpdatedAt: Date | null;
}> {
  const [
    overallForm5,
    overallForm10,
    venueForm5,
    venueForm10,
    generatedXgFeatures,
    generatedShotThreatFeatures,
  ] =
    await Promise.all([
      calculateTeamForm({
        teamId:
          options.teamId,

        beforeDate:
          options.beforeDate,

        matchLimit:
          5,

        venue:
          "ALL",
      }),

      calculateTeamForm({
        teamId:
          options.teamId,

        beforeDate:
          options.beforeDate,

        matchLimit:
          10,

        venue:
          "ALL",
      }),

      calculateTeamForm({
        teamId:
          options.teamId,

        beforeDate:
          options.beforeDate,

        matchLimit:
          5,

        venue:
          options.venue,
      }),

      calculateTeamForm({
        teamId:
          options.teamId,

        beforeDate:
          options.beforeDate,

        matchLimit:
          10,

        venue:
          options.venue,
      }),

      generateXgFeatures(
        options.teamId,
        options.seasonYear,
        options.beforeDate,
      ),

      generateShotThreatFeatures(
        options.teamId,
        options.seasonYear,
        options.beforeDate,
      ),
    ]);

  const overallHistoryQuality5 =
    calculateHistoryQuality(
      overallForm5.matchesUsed,
      5,
    );

  const overallHistoryQuality10 =
    calculateHistoryQuality(
      overallForm10.matchesUsed,
      10,
    );

  const venueHistoryQuality5 =
    calculateHistoryQuality(
      venueForm5.matchesUsed,
      5,
    );

  const venueHistoryQuality10 =
    calculateHistoryQuality(
      venueForm10.matchesUsed,
      10,
    );

  const formMomentum =
    calculateDifference(
      overallForm5.pointsPerGame,
      overallForm10.pointsPerGame,
    );

  const momentumQuality =
    formMomentum ===
      null
      ? 0
      : Math.min(
          overallHistoryQuality5,
          overallHistoryQuality10,
        );

  const xgValues =
    Object.fromEntries(
      generatedXgFeatures.map(
        (
          feature,
        ) => [
          feature.key,
          {
            rawValue:
              feature.rawValue,

            dataQualityScore:
              feature.rawValue ===
              null
                ? 0
                : feature.dataQualityScore,
          },
        ],
      ),
    ) as Record<
      XgFeatureKey,
      TeamRawFeatureValue
    >;

  const shotThreatValues =
    Object.fromEntries(
      generatedShotThreatFeatures.map(
        (
          feature,
        ) => [
          feature.key,
          {
            rawValue:
              feature.rawValue,

            dataQualityScore:
              feature.rawValue ===
              null
                ? 0
                : feature.dataQualityScore,
          },
        ],
      ),
    ) as Record<
      ShotThreatFeatureKey,
      TeamRawFeatureValue
    >;

  const sourceDates = [
    overallForm5.lastMatchAt,
    overallForm10.lastMatchAt,
    venueForm5.lastMatchAt,
    venueForm10.lastMatchAt,
  ].filter(
    (
      value,
    ): value is Date =>
      value !==
      null,
  );

  const sourceUpdatedAt =
    sourceDates.length >
    0
      ? new Date(
          Math.max(
            ...sourceDates.map(
              (
                value,
              ) =>
                value.getTime(),
            ),
          ),
        )
      : null;

  return {
    values: {
      last_5_points_per_game: {
        rawValue:
          overallForm5.pointsPerGame,

        dataQualityScore:
          overallForm5.pointsPerGame ===
          null
            ? 0
            : overallHistoryQuality5,
      },

      goals_scored_per_game: {
        rawValue:
          overallForm5.goalsScoredPerGame,

        dataQualityScore:
          overallForm5.goalsScoredPerGame ===
          null
            ? 0
            : overallHistoryQuality5,
      },

      goals_conceded_per_game: {
        rawValue:
          overallForm5.goalsConcededPerGame,

        dataQualityScore:
          overallForm5.goalsConcededPerGame ===
          null
            ? 0
            : overallHistoryQuality5,
      },

      last_10_points_per_game: {
        rawValue:
          overallForm10.pointsPerGame,

        dataQualityScore:
          overallForm10.pointsPerGame ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      last_10_goals_scored_per_game: {
        rawValue:
          overallForm10.goalsScoredPerGame,

        dataQualityScore:
          overallForm10.goalsScoredPerGame ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      last_10_goals_conceded_per_game: {
        rawValue:
          overallForm10.goalsConcededPerGame,

        dataQualityScore:
          overallForm10.goalsConcededPerGame ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      venue_last_5_points_per_game: {
        rawValue:
          venueForm5.pointsPerGame,

        dataQualityScore:
          venueForm5.pointsPerGame ===
          null
            ? 0
            : venueHistoryQuality5,
      },

      venue_goals_scored_per_game: {
        rawValue:
          venueForm5.goalsScoredPerGame,

        dataQualityScore:
          venueForm5.goalsScoredPerGame ===
          null
            ? 0
            : venueHistoryQuality5,
      },

      venue_goals_conceded_per_game: {
        rawValue:
          venueForm5.goalsConcededPerGame,

        dataQualityScore:
          venueForm5.goalsConcededPerGame ===
          null
            ? 0
            : venueHistoryQuality5,
      },

      venue_last_10_points_per_game: {
        rawValue:
          venueForm10.pointsPerGame,

        dataQualityScore:
          venueForm10.pointsPerGame ===
          null
            ? 0
            : venueHistoryQuality10,
      },

      venue_last_10_goals_scored_per_game: {
        rawValue:
          venueForm10.goalsScoredPerGame,

        dataQualityScore:
          venueForm10.goalsScoredPerGame ===
          null
            ? 0
            : venueHistoryQuality10,
      },

      venue_last_10_goals_conceded_per_game: {
        rawValue:
          venueForm10.goalsConcededPerGame,

        dataQualityScore:
          venueForm10.goalsConcededPerGame ===
          null
            ? 0
            : venueHistoryQuality10,
      },

      win_rate: {
        rawValue:
          overallForm10.winRate,

        dataQualityScore:
          overallForm10.winRate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      draw_rate: {
        rawValue:
          overallForm10.drawRate,

        dataQualityScore:
          overallForm10.drawRate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      loss_rate: {
        rawValue:
          overallForm10.lossRate,

        dataQualityScore:
          overallForm10.lossRate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      clean_sheet_rate: {
        rawValue:
          overallForm10.cleanSheetRate,

        dataQualityScore:
          overallForm10.cleanSheetRate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      btts_rate: {
        rawValue:
          overallForm10.bttsRate,

        dataQualityScore:
          overallForm10.bttsRate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      over_2_5_rate: {
        rawValue:
          overallForm10.over25Rate,

        dataQualityScore:
          overallForm10.over25Rate ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      goal_difference_per_game: {
        rawValue:
          overallForm10.goalDifferencePerGame,

        dataQualityScore:
          overallForm10.goalDifferencePerGame ===
          null
            ? 0
            : overallHistoryQuality10,
      },

      form_momentum: {
        rawValue:
          formMomentum,

        dataQualityScore:
          momentumQuality,
      },

      fixture_congestion_14_days: {
        rawValue:
          overallForm5.matchesInLast14Days,

        dataQualityScore:
          100,
      },

      rest_days: {
        rawValue:
          overallForm5.restDays,

        dataQualityScore:
          overallForm5.restDays ===
          null
            ? 0
            : 100,
      },

      starting_eleven_quality: {
        rawValue:
          null,

        dataQualityScore:
          0,
      },

      ...xgValues,
      ...shotThreatValues,
    },

    sourceUpdatedAt,
  };
}

async function saveTeamFeatureValues(
  options: {
    matchId: number;
    teamId: number;
    teamName: string;

    rawValues:
      TeamRawFeatureValues;

    sourceUpdatedAt:
      Date | null;

    calculationRunId:
      string;

    effectiveCalculatedAt:
      Date;
  },
): Promise<GeneratedTeamFeatures> {
  const definitions =
    await prisma.featureDefinition.findMany({
      where: {
        key: {
          in: [
            ...SUPPORTED_FEATURE_KEYS,
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

  const foundDefinitionKeys =
    new Set(
      definitions.map(
        (
          definition,
        ) =>
          definition.key,
      ),
    );

  const missingDefinitions =
    SUPPORTED_FEATURE_KEYS.filter(
      (
        key,
      ) =>
        !foundDefinitionKeys.has(
          key,
        ),
    );

  if (
    missingDefinitions.length >
    0
  ) {
    throw new Error(
      [
        "Feature tanımları eksik.",
        "Önce sync-feature-definitions.ts çalıştırılmalıdır.",
        `Eksik: ${missingDefinitions.join(", ")}`,
      ].join(
        " ",
      ),
    );
  }

  let createdCount =
    0;

  let updatedCount =
    0;

  let missingCount =
    0;

  const savedValues:
    GeneratedTeamFeatures["values"] =
      [];

  for (
    const definition
    of definitions
  ) {
    const key =
      definition.key as SupportedFeatureKey;

    const rawFeature =
      options.rawValues[
        key
      ] ?? {
        rawValue:
          null,

        dataQualityScore:
          0,
      };

    const rawValue =
      rawFeature.rawValue;

    const canNormalize =
      rawValue !==
        null &&
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

    const dataQualityScore =
      rawValue ===
      null
        ? 0
        : rawFeature.dataQualityScore;

    if (
      rawValue ===
      null
    ) {
      missingCount +=
        1;
    }

    const uniqueKey = {
      matchId:
        options.matchId,

      featureId:
        definition.id,

      teamId:
        options.teamId,

      calculationRunId:
        options.calculationRunId,
    };

    const existingValue =
      await prisma.matchFeatureValue.findUnique({
        where: {
          matchId_featureId_teamId_calculationRunId:
            uniqueKey,
        },

        select: {
          id:
            true,
        },
      });

    const isXgFeature =
      (
        XG_FEATURE_KEYS as readonly string[]
      ).includes(
        key,
      );

    const isShotThreatFeature =
      (
        SHOT_THREAT_FEATURE_KEYS as readonly string[]
      ).includes(
        key,
      );

    const isVenueFeature =
      key.startsWith(
        "venue_",
      );

    const source =
      isXgFeature
        ? "INTERNAL_XG"
        : isShotThreatFeature
          ? "INTERNAL_SHOT_THREAT"
          : isVenueFeature
            ? "INTERNAL_VENUE_FORM"
            : "INTERNAL_TEAM_FORM";

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
        source,

        sourceUpdatedAt:
          options.sourceUpdatedAt,

        calculatedAt:
          options.effectiveCalculatedAt,
      },

      create: {
        matchId:
          options.matchId,

        featureId:
          definition.id,

        teamId:
          options.teamId,

        numericValue:
          rawValue,

        textValue:
          null,

        booleanValue:
          null,

        normalizedValue,
        dataQualityScore,
        source,

        sourceUpdatedAt:
          options.sourceUpdatedAt,

        calculationRunId:
          options.calculationRunId,

        calculatedAt:
          options.effectiveCalculatedAt,
      },
    });

    if (
      existingValue
    ) {
      updatedCount +=
        1;
    } else {
      createdCount +=
        1;
    }

    savedValues.push({
      key,
      rawValue,
      normalizedValue,
      dataQualityScore,
    });
  }

  return {
    teamId:
      options.teamId,

    teamName:
      options.teamName,

    createdCount,
    updatedCount,
    missingCount,

    values:
      savedValues,
  };
}

export async function generateMatchFeatures(
  input:
    | number
    | GenerateMatchFeaturesOptions,
): Promise<GenerateMatchFeaturesResult> {
  const options =
    normalizeGenerateOptions(
      input,
    );

  if (
    !Number.isInteger(
      options.matchId,
    ) ||
    options.matchId <=
      0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const calculationRunId =
    options.calculationRunId ??
    ACTIVE_CALCULATION_RUN_ID;

  validateCalculationRunId(
    calculationRunId,
  );

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          options.matchId,
      },

      include: {
        homeTeam:
          true,

        awayTeam:
          true,

        season:
          true,
      },
    });

  if (
    !match
  ) {
    throw new Error(
      `${options.matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  const snapshotTime =
    options.snapshotTime ??
    match.kickoffAt;

  if (
    snapshotTime >
    match.kickoffAt
  ) {
    throw new Error(
      [
        "snapshotTime maç başlangıcından sonra olamaz.",
        `snapshotTime=${snapshotTime.toISOString()}`,
        `kickoffAt=${match.kickoffAt.toISOString()}`,
      ].join(
        " ",
      ),
    );
  }

  const effectiveCalculatedAt =
    options.effectiveCalculatedAt ??
    snapshotTime;

  if (
    effectiveCalculatedAt >
    match.kickoffAt
  ) {
    throw new Error(
      [
        "effectiveCalculatedAt maç başlangıcından sonra olamaz.",
        `effectiveCalculatedAt=${effectiveCalculatedAt.toISOString()}`,
        `kickoffAt=${match.kickoffAt.toISOString()}`,
      ].join(
        " ",
      ),
    );
  }

  const [
    homeRawData,
    awayRawData,
  ] =
    await Promise.all([
      buildTeamRawFeatureValues({
        teamId:
          match.homeTeamId,

        seasonYear:
          match.season.year,

        beforeDate:
          snapshotTime,

        venue:
          "HOME",
      }),

      buildTeamRawFeatureValues({
        teamId:
          match.awayTeamId,

        seasonYear:
          match.season.year,

        beforeDate:
          snapshotTime,

        venue:
          "AWAY",
      }),
    ]);

  const [
    home,
    away,
  ] =
    await Promise.all([
      saveTeamFeatureValues({
        matchId:
          match.id,

        teamId:
          match.homeTeamId,

        teamName:
          match.homeTeam.name,

        rawValues:
          homeRawData.values,

        sourceUpdatedAt:
          homeRawData.sourceUpdatedAt,

        calculationRunId,

        effectiveCalculatedAt,
      }),

      saveTeamFeatureValues({
        matchId:
          match.id,

        teamId:
          match.awayTeamId,

        teamName:
          match.awayTeam.name,

        rawValues:
          awayRawData.values,

        sourceUpdatedAt:
          awayRawData.sourceUpdatedAt,

        calculationRunId,

        effectiveCalculatedAt,
      }),
    ]);

  return {
    match: {
      id:
        match.id,

      apiId:
        match.apiId,

      kickoffAt:
        match.kickoffAt,

      homeTeam:
        match.homeTeam.name,

      awayTeam:
        match.awayTeam.name,
    },

    calculationRunId,
    snapshotTime,
    effectiveCalculatedAt,

    home,
    away,
  };
}
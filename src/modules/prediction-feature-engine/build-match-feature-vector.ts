import {
  FeatureScope,
  FeatureStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

import type {
  MatchPredictionFeatureVector,
  PredictionFeatureSource,
  PredictionFeatureValue,
} from "./types";

const SQUAD_FEATURE_KEYS = new Set([
  "squad_strength",
  "starting_eleven_strength",
  "bench_strength",
  "goalkeeper_strength",
  "defence_strength",
  "midfield_strength",
  "attack_strength",
  "squad_depth",
  "lineup_certainty",
]);

const H2H_FEATURE_KEYS = new Set([
  "h2h_home_win_rate",
  "h2h_draw_rate",
  "h2h_away_win_rate",
  "h2h_home_goals_per_game",
  "h2h_away_goals_per_game",
  "h2h_total_goals_per_game",
]);

const SHOT_THREAT_FEATURE_KEYS =
  new Set([
    "shots_per_game",
    "shots_on_target_per_game",
    "shot_accuracy",
    "possession_average",
    "corners_per_game",
    "attacking_pressure",
    "last5_shots_per_game",
    "last5_shots_on_target_per_game",
    "last5_attacking_pressure",
  ]);

function round(
  value: number,
  decimals = 4,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

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

function getSource(
  key: string,
): PredictionFeatureSource {
  if (
    SQUAD_FEATURE_KEYS.has(
      key,
    )
  ) {
    return "SQUAD";
  }

  if (
    H2H_FEATURE_KEYS.has(
      key,
    )
  ) {
    return "H2H";
  }

  if (
    SHOT_THREAT_FEATURE_KEYS.has(
      key,
    )
  ) {
    return "SHOT_THREAT";
  }

  return "CORE";
}
function getCombinedQuality(
  homeQuality: number,
  awayQuality: number,
): number {
  /*
   * İki takımın da verisi önemli.
   *
   * Basit ortalama kullanıyoruz.
   * Daha sonra minimum-weighted
   * kaliteye çevirebiliriz.
   */
  return round(
    clamp(
      (
        homeQuality +
        awayQuality
      ) /
        2,
      0,
      100,
    ),
    2,
  );
}

export async function buildMatchFeatureVector(
  options: {
    matchId: number;
    calculationRunId: string;
  },
): Promise<MatchPredictionFeatureVector> {
  const {
    matchId,
    calculationRunId,
  } = options;

  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    calculationRunId.trim()
      .length === 0
  ) {
    throw new Error(
      "calculationRunId boş olamaz.",
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  /*
   * Bu run'a ait aktif feature kayıtlarını
   * çekiyoruz.
   */
  const values =
    await prisma.matchFeatureValue.findMany({
      where: {
        matchId,

        calculationRunId,

        feature: {
          status:
            FeatureStatus.ACTIVE,
        },
      },

      select: {
        teamId: true,

        numericValue: true,

        normalizedValue: true,

        dataQualityScore: true,

        feature: {
          select: {
            key: true,
            scope: true,
          },
        },
      },

      orderBy: {
        feature: {
          key:
            "asc",
        },
      },
    });

  const warnings:
    string[] = [];

  const teamFeatureMap =
    new Map<
      string,
      {
        home: {
          value: number | null;
          quality: number;
        };

        away: {
          value: number | null;
          quality: number;
        };
      }
    >();

  /*
   * TEAM scope feature'ları:
   *
   * aynı key için:
   * homeTeamId kaydı
   * awayTeamId kaydı
   */
  for (
    const item
    of values
  ) {
    if (
      item.feature.scope !==
      FeatureScope.TEAM
    ) {
      continue;
    }

    const key =
      item.feature.key;

    const current =
      teamFeatureMap.get(
        key,
      ) ?? {
        home: {
          value: null,
          quality: 0,
        },

        away: {
          value: null,
          quality: 0,
        },
      };

    /*
     * Model girdisinde mümkünse
     * normalizedValue kullan.
     *
     * Normalize edilememiş feature varsa
     * raw numeric value fallback.
     */
    const value =
      item.normalizedValue ??
      item.numericValue;

    if (
      item.teamId ===
      match.homeTeamId
    ) {
      current.home = {
        value,

        quality:
          item.dataQualityScore,
      };
    }

    if (
      item.teamId ===
      match.awayTeamId
    ) {
      current.away = {
        value,

        quality:
          item.dataQualityScore,
      };
    }

    teamFeatureMap.set(
      key,
      current,
    );
  }

  const features:
    PredictionFeatureValue[] =
      [];

  const vector: Record<
    string,
    number | null
  > = {};

  /*
   * TEAM FEATURE VECTOR
   */
  for (
    const [
      key,
      pair,
    ]
    of teamFeatureMap
  ) {
    const homeValue =
      pair.home.value;

    const awayValue =
      pair.away.value;

    const difference =
      homeValue !== null &&
      awayValue !== null
        ? round(
            homeValue -
              awayValue,
          )
        : null;

    const combinedQuality =
      getCombinedQuality(
        pair.home.quality,
        pair.away.quality,
      );

    const source =
      getSource(
        key,
      );

    features.push({
      key,

      homeValue,
      awayValue,

      difference,

      homeQuality:
        pair.home.quality,

      awayQuality:
        pair.away.quality,

      combinedQuality,

      source,
    });

    vector[
      `home_${key}`
    ] =
      homeValue;

    vector[
      `away_${key}`
    ] =
      awayValue;

    vector[
      `diff_${key}`
    ] =
      difference;

    if (
      homeValue === null
    ) {
      warnings.push(
        `Home feature eksik: ${key}`,
      );
    }

    if (
      awayValue === null
    ) {
      warnings.push(
        `Away feature eksik: ${key}`,
      );
    }
  }

  /*
   * ==================================================
   * MATCH SCOPE FEATURES
   * ==================================================
   *
   * H2H gibi feature'lar teamId=null olarak
   * saklanabilir.
   *
   * Bunları direkt vector'a tek değer
   * olarak ekliyoruz.
   */
  const matchScopeValues =
    values.filter(
      (item) =>
        item.feature.scope ===
        FeatureScope.MATCH,
    );

  for (
    const item
    of matchScopeValues
  ) {
    const key =
      item.feature.key;

    const value =
      item.normalizedValue ??
      item.numericValue;

    vector[key] =
      value;

    features.push({
      key,

      homeValue:
        value,

      awayValue:
        null,

      difference:
        null,

      homeQuality:
        item.dataQualityScore,

      awayQuality:
        0,

      combinedQuality:
        item.dataQualityScore,

      source:
        getSource(
          key,
        ),
    });

    if (
      value === null
    ) {
      warnings.push(
        `Match feature eksik: ${key}`,
      );
    }
  }

  const qualityValues =
    features
      .filter(
        (feature) => {
          if (
            feature.source ===
            "H2H"
          ) {
            return (
              feature.homeValue !==
              null
            );
          }

          return (
            feature.homeValue !==
              null &&
            feature.awayValue !==
              null
          );
        },
      )
      .map(
        (feature) =>
          feature.combinedQuality,
      );

  const missingFeatureCount =
    features.filter(
      (feature) => {
        if (
          feature.source ===
          "H2H"
        ) {
          return (
            feature.homeValue ===
            null
          );
        }

        return (
          feature.homeValue ===
            null ||
          feature.awayValue ===
            null
        );
      },
    ).length;

  const averageQuality =
    qualityValues.length > 0
      ? round(
          qualityValues.reduce(
            (
              total,
              value,
            ) =>
              total + value,
            0,
          ) /
            qualityValues.length,
          2,
        )
      : 0;

  const minimumQuality =
    qualityValues.length > 0
      ? round(
          Math.min(
            ...qualityValues,
          ),
          2,
        )
      : 0;

  return {
    match: {
      id:
        match.id,

      kickoffAt:
        match.kickoffAt,

      homeTeamId:
        match.homeTeamId,

      awayTeamId:
        match.awayTeamId,

      homeTeam:
        match.homeTeam.name,

      awayTeam:
        match.awayTeam.name,
    },

    calculationRunId,

    features,

    vector,

    quality: {
      average:
        averageQuality,

      minimum:
        minimumQuality,

      featureCount:
        features.length,

      missingFeatureCount,
    },

    warnings,
  };
}
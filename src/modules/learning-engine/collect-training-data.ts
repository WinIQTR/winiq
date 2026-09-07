import {
  prisma,
} from "@/lib/prisma";

import {
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine/generate-match-features";

import {
  buildMatchFeatureVector,
} from "@/modules/prediction-feature-engine";

import type {
  MatchOutcome,
  TrainingDataCollectionOptions,
  TrainingDataCollectionResult,
  TrainingFeatureValues,
  TrainingMatchRow,
} from "./types";

function round(
  value: number,
  decimals = 6,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function determineOutcome(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (
    homeScore >
    awayScore
  ) {
    return "HOME";
  }

  if (
    awayScore >
    homeScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

function createHistoricalSnapshotRunId(
  matchId: number,
): string {
  return [
    HISTORICAL_SNAPSHOT_RUN_PREFIX,
    "match",
    matchId,
  ].join("-");
}

/*
 * Prediction Feature Vector içindeki null
 * değerler training row'a yazılmaz.
 *
 * Eksik değer doldurma işlemi daha sonra
 * buildTrainingMatrix() tarafından yapılır.
 */
function convertPredictionVector(
  vector: Record<
    string,
    number | null
  >,
): TrainingFeatureValues {
  const features:
    TrainingFeatureValues = {};

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      vector,
    )
  ) {
    if (
      value === null ||
      !Number.isFinite(
        value,
      )
    ) {
      continue;
    }

    features[key] =
      round(
        value,
      );
  }

  return features;
}

/*
 * featureKeys opsiyonu verilirse:
 *
 * shots_per_game
 *
 * için:
 *
 * home_shots_per_game
 * away_shots_per_game
 * diff_shots_per_game
 *
 * alanlarını tutar.
 *
 * H2H gibi MATCH scope feature için doğrudan
 * key eşleşmesini de kabul eder.
 */
function filterFeatureVector(options: {
  features:
    TrainingFeatureValues;

  requestedFeatureKeys?:
    string[];
}): TrainingFeatureValues {
  if (
    !options.requestedFeatureKeys ||
    options.requestedFeatureKeys.length ===
      0
  ) {
    return {
      ...options.features,
    };
  }

  const requested =
    new Set(
      options.requestedFeatureKeys,
    );

  const result:
    TrainingFeatureValues = {};

  for (
    const [
      vectorKey,
      value,
    ]
    of Object.entries(
      options.features,
    )
  ) {
    if (
      requested.has(
        vectorKey,
      )
    ) {
      result[
        vectorKey
      ] = value;

      continue;
    }

    const prefixes = [
      "home_",
      "away_",
      "diff_",
    ];

    let matched =
      false;

    for (
      const prefix
      of prefixes
    ) {
      if (
        !vectorKey.startsWith(
          prefix,
        )
      ) {
        continue;
      }

      const baseKey =
        vectorKey.slice(
          prefix.length,
        );

      if (
        requested.has(
          baseKey,
        )
      ) {
        result[
          vectorKey
        ] = value;

        matched =
          true;

        break;
      }
    }

    if (
      matched
    ) {
      continue;
    }
  }

  return result;
}

export async function collectTrainingData(
  options:
    TrainingDataCollectionOptions,
): Promise<
  TrainingDataCollectionResult
> {
  const minimumDataQualityScore =
    options.minimumDataQualityScore ??
    0;

  /*
   * Önce gerçekten bitmiş ve sonucu bulunan
   * maçları çekiyoruz.
   *
   * Feature üretimini burada tekrar yapmıyoruz.
   * Historical Snapshot'tan Prediction Feature
   * Vector üretiyoruz.
   */
  const allMatches =
    await prisma.match.findMany({
      where: {
        status:
          "FINISHED",

        homeScore: {
          not:
            null,
        },

        awayScore: {
          not:
            null,
        },

        season: {
          year:
            options.seasonYear,

          league: {
            apiId:
              options.leagueApiId,
          },
        },
      },

      select: {
        id: true,
        apiId: true,

        seasonId:
          true,

        kickoffAt:
          true,

        homeTeamId:
          true,

        awayTeamId:
          true,

        homeScore:
          true,

        awayScore:
          true,

        homeTeam: {
          select: {
            id:
              true,

            name:
              true,
          },
        },

        awayTeam: {
          select: {
            id:
              true,

            name:
              true,
          },
        },

        season: {
          select: {
            id:
              true,

            year:
              true,

            league: {
              select: {
                id:
                  true,

                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  const totalFinishedMatches =
    allMatches.length;

  const matches =
    options.limit
      ? allMatches.slice(
          0,
          options.limit,
        )
      : allMatches;

  const rows:
    TrainingMatchRow[] =
      [];

  let skippedMatchCount =
    0;

  let missingSnapshotMatchCount =
    0;

  let lowQualityMatchCount =
    0;

  let emptyVectorMatchCount =
    0;

  const vectorFeatureNames =
    new Set<string>();

  for (
    const match
    of matches
  ) {
    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      skippedMatchCount +=
        1;

      continue;
    }

    const calculationRunId =
      createHistoricalSnapshotRunId(
        match.id,
      );

    /*
     * Önce bu historical run gerçekten var mı
     * kontrol ediyoruz.
     */
    const snapshotExists =
      await prisma.matchFeatureValue.findFirst({
        where: {
          matchId:
            match.id,

          calculationRunId,
        },

        select: {
          id:
            true,
        },
      });

    if (
      !snapshotExists
    ) {
      missingSnapshotMatchCount +=
        1;

      skippedMatchCount +=
        1;

      continue;
    }

    /*
     * EĞİTİM VE TAHMİN ARTIK AYNI MOTORU
     * KULLANIYOR.
     */
    const predictionVector =
      await buildMatchFeatureVector({
        matchId:
          match.id,

        calculationRunId,
      });

    if (
      predictionVector
        .features.length ===
      0
    ) {
      emptyVectorMatchCount +=
        1;

      skippedMatchCount +=
        1;

      continue;
    }

    /*
     * İstenirse maç seviyesinde minimum
     * ortalama veri kalitesi uygula.
     */
    if (
      minimumDataQualityScore >
        0 &&
      predictionVector
        .quality.average <
        minimumDataQualityScore
    ) {
      lowQualityMatchCount +=
        1;

      skippedMatchCount +=
        1;

      continue;
    }

    const completeFeatures =
      convertPredictionVector(
        predictionVector.vector,
      );

    const features =
      filterFeatureVector({
        features:
          completeFeatures,

        requestedFeatureKeys:
          options.featureKeys,
      });

    if (
      Object.keys(
        features,
      ).length ===
      0
    ) {
      skippedMatchCount +=
        1;

      continue;
    }

    for (
      const featureName
      of Object.keys(
        features,
      )
    ) {
      vectorFeatureNames.add(
        featureName,
      );
    }

    rows.push({
      matchId:
        match.id,

      matchApiId:
        match.apiId,

      seasonId:
        match.season.id,

      seasonYear:
        match.season.year,

      leagueId:
        match.season.league.id,

      leagueApiId:
        match.season.league.apiId,

      leagueName:
        match.season.league.name,

      kickoffAt:
        match.kickoffAt,

      homeTeamId:
        match.homeTeam.id,

      homeTeamName:
        match.homeTeam.name,

      awayTeamId:
        match.awayTeam.id,

      awayTeamName:
        match.awayTeam.name,

      homeScore:
        match.homeScore,

      awayScore:
        match.awayScore,

      actualOutcome:
        determineOutcome(
          match.homeScore,
          match.awayScore,
        ),

      features,

      /*
       * Burada artık sayım Prediction Feature
       * Vector tarafından üretiliyor.
       */
      availableFeatureCount:
        Object.keys(
          features,
        ).length,

      missingFeatureCount:
        predictionVector
          .quality
          .missingFeatureCount,

      averageDataQualityScore:
        predictionVector
          .quality
          .average,

      /*
       * Prediction Vector yalnızca ilgili
       * historical calculationRunId üzerinden
       * okunuyor.
       *
       * Snapshot üretim katmanında
       * effectiveCalculatedAt <= kickoffAt
       * zorunluluğu zaten mevcut.
       */
      containsPostMatchCalculatedFeatures:
        false,
    });
  }

  const warnings:
    string[] = [];

  if (
    missingSnapshotMatchCount >
    0
  ) {
    warnings.push(
      [
        missingSnapshotMatchCount,
        "maç için historical snapshot bulunamadı.",
      ].join(" "),
    );
  }

  if (
    emptyVectorMatchCount >
    0
  ) {
    warnings.push(
      [
        emptyVectorMatchCount,
        "historical snapshot bulundu ancak Prediction Feature Vector boştu.",
      ].join(" "),
    );
  }

  if (
    lowQualityMatchCount >
    0
  ) {
    warnings.push(
      [
        lowQualityMatchCount,
        "maç minimum data quality filtresinin altında kaldığı için eğitimden çıkarıldı.",
      ].join(" "),
    );
  }

  if (
    rows.length <
    200
  ) {
    warnings.push(
      [
        "Toplanan maç sayısı düşük:",
        rows.length,
        "Güvenilir optimizasyon için en az 200-300 maç önerilir.",
      ].join(" "),
    );
  }

  return {
    leagueApiId:
      options.leagueApiId,

    seasonYear:
      options.seasonYear,

    rows,

    totalFinishedMatches,

    collectedMatchCount:
      rows.length,

    skippedMatchCount,

    /*
     * Artık bunlar base FeatureDefinition key'leri
     * değil, gerçek model-vector sütunlarıdır.
     *
     * Ör:
     * home_squad_strength
     * away_squad_strength
     * diff_squad_strength
     * h2h_home_win_rate
     */
    featureKeys:
      [...vectorFeatureNames].sort(
        (
          left,
          right,
        ) =>
          left.localeCompare(
            right,
          ),
      ),

    warnings,
  };
}
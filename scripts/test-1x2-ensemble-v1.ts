import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculate1x2Probabilities,
} from "@/modules/probability-engine";

type Outcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

type Probabilities = {
  home: number;
  draw: number;
  away: number;
};

type EnsembleConfig = {
  name: string;

  currentWeight: number;
  poissonWeight: number;
};

type ModelAggregate = {
  name: string;

  matches: number;

  correct: number;

  homeActual: number;
  drawActual: number;
  awayActual: number;

  homePredicted: number;
  drawPredicted: number;
  awayPredicted: number;

  homeCorrect: number;
  drawCorrect: number;
  awayCorrect: number;

  brierTotal: number;
  logLossTotal: number;

  probabilityHomeTotal: number;
  probabilityDrawTotal: number;
  probabilityAwayTotal: number;

  confidenceTotal: number;
};

const SEASON_YEAR =
  2024;

const TRAINING_PERCENTAGE =
  70;

const MIN_PROBABILITY =
  1e-15;

const ENSEMBLES:
  EnsembleConfig[] = [
  {
    name:
      "CURRENT_ONLY",

    currentWeight:
      1,

    poissonWeight:
      0,
  },

  {
    name:
      "CURRENT_90_POISSON_10",

    currentWeight:
      0.9,

    poissonWeight:
      0.1,
  },

  {
    name:
      "CURRENT_80_POISSON_20",

    currentWeight:
      0.8,

    poissonWeight:
      0.2,
  },

  {
    name:
      "CURRENT_70_POISSON_30",

    currentWeight:
      0.7,

    poissonWeight:
      0.3,
  },

  {
    name:
      "CURRENT_60_POISSON_40",

    currentWeight:
      0.6,

    poissonWeight:
      0.4,
  },

  {
    name:
      "CURRENT_50_POISSON_50",

    currentWeight:
      0.5,

    poissonWeight:
      0.5,
  },

  {
    name:
      "CURRENT_40_POISSON_60",

    currentWeight:
      0.4,

    poissonWeight:
      0.6,
  },

  {
    name:
      "CURRENT_30_POISSON_70",

    currentWeight:
      0.3,

    poissonWeight:
      0.7,
  },

  {
    name:
      "CURRENT_20_POISSON_80",

    currentWeight:
      0.2,

    poissonWeight:
      0.8,
  },

  {
    name:
      "POISSON_ONLY",

    currentWeight:
      0,

    poissonWeight:
      1,
  },
];

function round(
  value: number,
  decimals = 4,
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

function percentage(
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
    (
      numerator /
      denominator
    ) *
      100,
    2,
  );
}

function determineActualOutcome(
  homeScore: number,
  awayScore: number,
): Outcome {
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

function determinePredictedOutcome(
  probabilities:
    Probabilities,
): Outcome {
  if (
    probabilities.home >=
      probabilities.draw &&
    probabilities.home >=
      probabilities.away
  ) {
    return "HOME";
  }

  if (
    probabilities.draw >=
      probabilities.home &&
    probabilities.draw >=
      probabilities.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

function normalizeProbabilities(
  probabilities:
    Probabilities,
): Probabilities {
  const safeHome =
    Number.isFinite(
      probabilities.home,
    )
      ? Math.max(
          probabilities.home,
          0,
        )
      : 0;

  const safeDraw =
    Number.isFinite(
      probabilities.draw,
    )
      ? Math.max(
          probabilities.draw,
          0,
        )
      : 0;

  const safeAway =
    Number.isFinite(
      probabilities.away,
    )
      ? Math.max(
          probabilities.away,
          0,
        )
      : 0;

  const total =
    safeHome +
    safeDraw +
    safeAway;

  if (
    total <=
    0
  ) {
    return {
      home:
        33.3333,

      draw:
        33.3333,

      away:
        33.3334,
    };
  }

  return {
    home:
      (
        safeHome /
        total
      ) *
      100,

    draw:
      (
        safeDraw /
        total
      ) *
      100,

    away:
      (
        safeAway /
        total
      ) *
      100,
  };
}

function blendProbabilities(
  options: {
    current:
      Probabilities;

    poisson:
      Probabilities;

    currentWeight:
      number;

    poissonWeight:
      number;
  },
): Probabilities {
  const current =
    normalizeProbabilities(
      options.current,
    );

  const poisson =
    normalizeProbabilities(
      options.poisson,
    );

  const weightTotal =
    options.currentWeight +
    options.poissonWeight;

  if (
    weightTotal <=
    0
  ) {
    throw new Error(
      "Ensemble ağırlık toplamı sıfır olamaz.",
    );
  }

  return normalizeProbabilities({
    home:
      (
        current.home *
          options.currentWeight +
        poisson.home *
          options.poissonWeight
      ) /
      weightTotal,

    draw:
      (
        current.draw *
          options.currentWeight +
        poisson.draw *
          options.poissonWeight
      ) /
      weightTotal,

    away:
      (
        current.away *
          options.currentWeight +
        poisson.away *
          options.poissonWeight
      ) /
      weightTotal,
  });
}

function probabilityForOutcome(
  probabilities:
    Probabilities,

  outcome:
    Outcome,
): number {
  switch (
    outcome
  ) {
    case "HOME":
      return (
        probabilities.home /
        100
      );

    case "DRAW":
      return (
        probabilities.draw /
        100
      );

    case "AWAY":
      return (
        probabilities.away /
        100
      );
  }
}

function calculateBrier(
  actualOutcome:
    Outcome,

  probabilities:
    Probabilities,
): number {
  const normalized =
    normalizeProbabilities(
      probabilities,
    );

  const home =
    normalized.home /
    100;

  const draw =
    normalized.draw /
    100;

  const away =
    normalized.away /
    100;

  const actualHome =
    actualOutcome ===
    "HOME"
      ? 1
      : 0;

  const actualDraw =
    actualOutcome ===
    "DRAW"
      ? 1
      : 0;

  const actualAway =
    actualOutcome ===
    "AWAY"
      ? 1
      : 0;

  return (
    (
      home -
      actualHome
    ) **
      2 +
    (
      draw -
      actualDraw
    ) **
      2 +
    (
      away -
      actualAway
    ) **
      2
  );
}

function calculateLogLoss(
  actualOutcome:
    Outcome,

  probabilities:
    Probabilities,
): number {
  const normalized =
    normalizeProbabilities(
      probabilities,
    );

  const probability =
    probabilityForOutcome(
      normalized,
      actualOutcome,
    );

  return (
    -Math.log(
      Math.max(
        probability,
        MIN_PROBABILITY,
      ),
    )
  );
}

function calculateConfidence(
  probabilities:
    Probabilities,
): number {
  return Math.max(
    probabilities.home,
    probabilities.draw,
    probabilities.away,
  );
}

function createAggregate(
  name: string,
): ModelAggregate {
  return {
    name,

    matches:
      0,

    correct:
      0,

    homeActual:
      0,

    drawActual:
      0,

    awayActual:
      0,

    homePredicted:
      0,

    drawPredicted:
      0,

    awayPredicted:
      0,

    homeCorrect:
      0,

    drawCorrect:
      0,

    awayCorrect:
      0,

    brierTotal:
      0,

    logLossTotal:
      0,

    probabilityHomeTotal:
      0,

    probabilityDrawTotal:
      0,

    probabilityAwayTotal:
      0,

    confidenceTotal:
      0,
  };
}

function updateAggregate(
  aggregate:
    ModelAggregate,

  actualOutcome:
    Outcome,

  probabilities:
    Probabilities,
): void {
  const normalized =
    normalizeProbabilities(
      probabilities,
    );

  const predictedOutcome =
    determinePredictedOutcome(
      normalized,
    );

  aggregate.matches +=
    1;

  if (
    actualOutcome ===
    "HOME"
  ) {
    aggregate.homeActual +=
      1;
  } else if (
    actualOutcome ===
    "DRAW"
  ) {
    aggregate.drawActual +=
      1;
  } else {
    aggregate.awayActual +=
      1;
  }

  if (
    predictedOutcome ===
    "HOME"
  ) {
    aggregate.homePredicted +=
      1;
  } else if (
    predictedOutcome ===
    "DRAW"
  ) {
    aggregate.drawPredicted +=
      1;
  } else {
    aggregate.awayPredicted +=
      1;
  }

  if (
    predictedOutcome ===
    actualOutcome
  ) {
    aggregate.correct +=
      1;
  }

  if (
    actualOutcome ===
      "HOME" &&
    predictedOutcome ===
      "HOME"
  ) {
    aggregate.homeCorrect +=
      1;
  }

  if (
    actualOutcome ===
      "DRAW" &&
    predictedOutcome ===
      "DRAW"
  ) {
    aggregate.drawCorrect +=
      1;
  }

  if (
    actualOutcome ===
      "AWAY" &&
    predictedOutcome ===
      "AWAY"
  ) {
    aggregate.awayCorrect +=
      1;
  }

  aggregate.brierTotal +=
    calculateBrier(
      actualOutcome,
      normalized,
    );

  aggregate.logLossTotal +=
    calculateLogLoss(
      actualOutcome,
      normalized,
    );

  aggregate
    .probabilityHomeTotal +=
    normalized.home;

  aggregate
    .probabilityDrawTotal +=
    normalized.draw;

  aggregate
    .probabilityAwayTotal +=
    normalized.away;

  aggregate
    .confidenceTotal +=
    calculateConfidence(
      normalized,
    );
}

function createResultRow(
  aggregate:
    ModelAggregate,
) {
  const matches =
    aggregate.matches;

  return {
    model:
      aggregate.name,

    matches,

    accuracy:
      percentage(
        aggregate.correct,
        matches,
      ),

    homeRecall:
      percentage(
        aggregate.homeCorrect,
        aggregate.homeActual,
      ),

    drawRecall:
      percentage(
        aggregate.drawCorrect,
        aggregate.drawActual,
      ),

    awayRecall:
      percentage(
        aggregate.awayCorrect,
        aggregate.awayActual,
      ),

    drawPrecision:
      percentage(
        aggregate.drawCorrect,
        aggregate.drawPredicted,
      ),

    actualHome:
      aggregate.homeActual,

    predictedHome:
      aggregate.homePredicted,

    actualDraw:
      aggregate.drawActual,

    predictedDraw:
      aggregate.drawPredicted,

    drawCorrect:
      aggregate.drawCorrect,

    actualAway:
      aggregate.awayActual,

    predictedAway:
      aggregate.awayPredicted,

    brier:
      matches >
      0
        ? round(
            aggregate.brierTotal /
              matches,
            6,
          )
        : null,

    logLoss:
      matches >
      0
        ? round(
            aggregate.logLossTotal /
              matches,
            6,
          )
        : null,

    avgHomeProbability:
      matches >
      0
        ? round(
            aggregate
              .probabilityHomeTotal /
              matches,
            2,
          )
        : null,

    avgDrawProbability:
      matches >
      0
        ? round(
            aggregate
              .probabilityDrawTotal /
              matches,
            2,
          )
        : null,

    avgAwayProbability:
      matches >
      0
        ? round(
            aggregate
              .probabilityAwayTotal /
              matches,
            2,
          )
        : null,

    averageConfidence:
      matches >
      0
        ? round(
            aggregate
              .confidenceTotal /
              matches,
            2,
          )
        : null,
  };
}

function calculateRankingScore(
  row:
    ReturnType<
      typeof createResultRow
    >,
): number {
  const accuracy =
    Number(
      row.accuracy ??
      0,
    );

  const homeRecall =
    Number(
      row.homeRecall ??
      0,
    );

  const drawRecall =
    Number(
      row.drawRecall ??
      0,
    );

  const awayRecall =
    Number(
      row.awayRecall ??
      0,
    );

  const drawPrecision =
    Number(
      row.drawPrecision ??
      0,
    );

  const brier =
    Number(
      row.brier ??
      1,
    );

  const logLoss =
    Number(
      row.logLoss ??
      2,
    );

  /*
   * Accuracy hâlâ ana metrik.
   *
   * DRAW recall/precision önemli fakat
   * modeli sadece beraberlik demeye
   * zorlamaması için kontrollü ağırlıkta.
   *
   * Brier ve Log Loss doğrudan
   * olasılık kalitesini cezalandırır.
   */
  return round(
    accuracy *
      0.45 +
      homeRecall *
        0.08 +
      drawRecall *
        0.14 +
      drawPrecision *
        0.10 +
      awayRecall *
        0.08 -
      brier *
        5 -
      logLoss *
        3,
    4,
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "1X2 ENSEMBLE V1 — CHRONOLOGICAL HOLDOUT",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      SEASON_YEAR,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    "Training %":
      TRAINING_PERCENTAGE,

    Ensemble:
      ENSEMBLES.length,
  });

  const competitionApiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

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
            SEASON_YEAR,

          league: {
            apiId: {
              in:
                competitionApiIds,
            },
          },
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        homeScore:
          true,

        awayScore:
          true,

        homeTeam: {
          select: {
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },

        season: {
          select: {
            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },
      },

      orderBy: [
        {
          kickoffAt:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    });

  if (
    allMatches.length <
    1000
  ) {
    throw new Error(
      `Historical maç sayısı yetersiz: ${allMatches.length}`,
    );
  }

  const splitIndex =
    Math.floor(
      allMatches.length *
        (
          TRAINING_PERCENTAGE /
          100
        ),
    );

  const trainingMatches =
    allMatches.slice(
      0,
      splitIndex,
    );

  const validationMatches =
    allMatches.slice(
      splitIndex,
    );

  if (
    validationMatches.length ===
    0
  ) {
    throw new Error(
      "Validation seti boş.",
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DATA SPLIT",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "All matches":
      allMatches.length,

    "Training matches":
      trainingMatches.length,

    "Validation matches":
      validationMatches.length,

    "Split date":
      validationMatches[
        0
      ]
        .kickoffAt
        .toISOString(),
  });

  /*
   * Buradaki training bölümü Ensemble
   * tarafından yeniden eğitilmiyor.
   *
   * Ama chronological holdout sınırını
   * production/backtest disiplinimizle
   * aynı tutmak için korunuyor.
   */
  const aggregates =
    new Map<
      string,
      ModelAggregate
    >();

  for (
    const ensemble
    of ENSEMBLES
  ) {
    aggregates.set(
      ensemble.name,
      createAggregate(
        ensemble.name,
      ),
    );
  }

  let processed =
    0;

  let failed =
    0;

  const failedMatches:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    let index = 0;
    index <
    validationMatches.length;
    index +=
      1
  ) {
    const match =
      validationMatches[
        index
      ];

    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    try {
      /*
       * İki motor birbirinden bağımsız
       * hesaplanır.
       *
       * calculateGoalProbabilities()
       * maç kickoff tarihinden ÖNCEKİ
       * sonuçları kullanır.
       */
      const [
        currentResult,
        poissonResult,
      ] =
        await Promise.all([
          calculate1x2Probabilities(
            match.id,
          ),

          calculateGoalProbabilities(
            match.id,
          ),
        ]);

      const currentProbabilities =
        normalizeProbabilities({
          home:
            currentResult
              .probabilities
              .home,

          draw:
            currentResult
              .probabilities
              .draw,

          away:
            currentResult
              .probabilities
              .away,
        });

      const poissonProbabilities =
        normalizeProbabilities({
          home:
            poissonResult
              .outcomeProbabilities
              .home,

          draw:
            poissonResult
              .outcomeProbabilities
              .draw,

          away:
            poissonResult
              .outcomeProbabilities
              .away,
        });

      const actualOutcome =
        determineActualOutcome(
          match.homeScore,
          match.awayScore,
        );

      for (
        const ensemble
        of ENSEMBLES
      ) {
        const probabilities =
          blendProbabilities({
            current:
              currentProbabilities,

            poisson:
              poissonProbabilities,

            currentWeight:
              ensemble
                .currentWeight,

            poissonWeight:
              ensemble
                .poissonWeight,
          });

        const aggregate =
          aggregates.get(
            ensemble.name,
          );

        if (
          !aggregate
        ) {
          throw new Error(
            `${ensemble.name} aggregate bulunamadı.`,
          );
        }

        updateAggregate(
          aggregate,
          actualOutcome,
          probabilities,
        );
      }

      processed +=
        1;

      if (
        processed %
          50 ===
        0
      ) {
        console.log(
          [
            `VALIDATION ${processed}/${validationMatches.length}`,
            `${match.homeTeam.name} - ${match.awayTeam.name}`,
          ].join(
            " • ",
          ),
        );
      }
    } catch (
      error: unknown
    ) {
      failed +=
        1;

      failedMatches.push({
        matchId:
          match.id,

        league:
          match
            .season
            .league
            .name,

        match:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });

      console.error(
        [
          `FAILED [${index + 1}/${validationMatches.length}]`,
          `${match.homeTeam.name} - ${match.awayTeam.name}`,
        ].join(
          " • ",
        ),
      );
    }
  }

  const resultRows =
    ENSEMBLES.map(
      (
        ensemble,
      ) => {
        const aggregate =
          aggregates.get(
            ensemble.name,
          );

        if (
          !aggregate
        ) {
          throw new Error(
            `${ensemble.name} sonucu bulunamadı.`,
          );
        }

        const result =
          createResultRow(
            aggregate,
          );

        return {
          ...result,

          currentWeight:
            ensemble
              .currentWeight,

          poissonWeight:
            ensemble
              .poissonWeight,

          rankingScore:
            calculateRankingScore(
              result,
            ),
        };
      },
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALIDATION SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Validation matches":
      validationMatches.length,

    Processed:
      processed,

    Failed:
      failed,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "MODEL COMPARISON",
  );

  console.log(
    "==============================================",
  );

  console.table(
    resultRows.map(
      (
        row,
      ) => ({
        model:
          row.model,

        current:
          row.currentWeight,

        poisson:
          row.poissonWeight,

        accuracy:
          row.accuracy,

        homeRecall:
          row.homeRecall,

        drawRecall:
          row.drawRecall,

        drawPrecision:
          row.drawPrecision,

        awayRecall:
          row.awayRecall,

        drawPredicted:
          row.predictedDraw,

        drawCorrect:
          row.drawCorrect,

        brier:
          row.brier,

        logLoss:
          row.logLoss,

        confidence:
          row.averageConfidence,

        score:
          row.rankingScore,
      }),
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PREDICTION DISTRIBUTION",
  );

  console.log(
    "==============================================",
  );

  console.table(
    resultRows.map(
      (
        row,
      ) => ({
        model:
          row.model,

        actualHome:
          row.actualHome,

        predictedHome:
          row.predictedHome,

        actualDraw:
          row.actualDraw,

        predictedDraw:
          row.predictedDraw,

        actualAway:
          row.actualAway,

        predictedAway:
          row.predictedAway,

        avgHomeProbability:
          row.avgHomeProbability,

        avgDrawProbability:
          row.avgDrawProbability,

        avgAwayProbability:
          row.avgAwayProbability,
      }),
    ),
  );

  const ranked =
    [
      ...resultRows,
    ].sort(
      (
        first,
        second,
      ) =>
        second.rankingScore -
        first.rankingScore,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ENSEMBLE RANKING",
  );

  console.log(
    "==============================================",
  );

  console.table(
    ranked.map(
      (
        row,
        index,
      ) => ({
        rank:
          index +
          1,

        model:
          row.model,

        current:
          row.currentWeight,

        poisson:
          row.poissonWeight,

        accuracy:
          row.accuracy,

        drawRecall:
          row.drawRecall,

        drawPrecision:
          row.drawPrecision,

        homeRecall:
          row.homeRecall,

        awayRecall:
          row.awayRecall,

        brier:
          row.brier,

        logLoss:
          row.logLoss,

        score:
          row.rankingScore,
      }),
    ),
  );

  /*
   * Sadece ranking score'a güvenmiyoruz.
   *
   * Production adayı ayrıca temel kalite
   * eşiklerini geçmek zorunda.
   */
  const productionCandidates =
    ranked.filter(
      (
        row,
      ) =>
        row.accuracy >=
          48 &&
        row.homeRecall >=
          60 &&
        row.awayRecall >=
          25 &&
        row.drawRecall >=
          5 &&
        row.drawPrecision >=
          25 &&
        Number(
          row.brier,
        ) <=
          0.63 &&
        Number(
          row.logLoss,
        ) <=
          1.05,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  if (
    productionCandidates.length ===
    0
  ) {
    console.log(
      "Production adayı bulunamadı.",
    );
  } else {
    console.table(
      productionCandidates.map(
        (
          row,
          index,
        ) => ({
          rank:
            index +
            1,

          model:
            row.model,

          currentWeight:
            row.currentWeight,

          poissonWeight:
            row.poissonWeight,

          accuracy:
            row.accuracy,

          homeRecall:
            row.homeRecall,

          drawRecall:
            row.drawRecall,

          drawPrecision:
            row.drawPrecision,

          awayRecall:
            row.awayRecall,

          brier:
            row.brier,

          logLoss:
            row.logLoss,

          score:
            row.rankingScore,
        }),
      ),
    );
  }

  if (
    failedMatches.length >
    0
  ) {
    console.log("");
    console.log(
      "==============================================",
    );

    console.log(
      "FIRST FAILED MATCHES",
    );

    console.log(
      "==============================================",
    );

    console.table(
      failedMatches.slice(
        0,
        20,
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "1X2 ENSEMBLE V1 TESTİ TAMAMLANDI.",
  );

  console.log(
    "==============================================",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "1X2 Ensemble V1 testi başarısız.",
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
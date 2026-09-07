import "dotenv/config";

import {
  MatchStatus,
} from "@/generated/prisma/client";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

function printSection(
  title: string,
): void {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    title,
  );

  console.log(
    "==============================================",
  );
}

function probabilityTotal(
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
): number {
  return (
    probabilities.home +
    probabilities.draw +
    probabilities.away
  );
}

async function main(): Promise<void> {
  printSection(
    "PREDICTION ENGINE V2 TEST",
  );

  const match =
    await prisma.match.findFirst({
      where: {
        status:
          MatchStatus.SCHEDULED,

        kickoffAt: {
          gte:
            new Date(),
        },

        season: {
          year:
            ACTIVE_SEASON_YEAR,

          league: {
            apiId: {
              in:
                [
                  ...ACTIVE_COMPETITION_API_IDS,
                ],
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      select: {
        id:
          true,

        kickoffAt:
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
                name:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !match
  ) {
    throw new Error(
      "Yaklaşan test maçı bulunamadı.",
    );
  }

  console.table({
    Maç:
      `${match.homeTeam.name} - ${match.awayTeam.name}`,

    Lig:
      match.season.league.name,

    Tarih:
      match.kickoffAt.toISOString(),

    Sezon:
      ACTIVE_SEASON_YEAR,
  });

  const prediction =
    await generateMatchPrediction({
      matchId:
        match.id,
    });

  printSection(
    "PROBABILITY COMPARISON",
  );

  console.table([
    {
      Aşama:
        "RAW",

      Home:
        prediction
          .rawProbabilities
          .home,

      Draw:
        prediction
          .rawProbabilities
          .draw,

      Away:
        prediction
          .rawProbabilities
          .away,

      Toplam:
        probabilityTotal(
          prediction
            .rawProbabilities,
        ),
    },

    {
      Aşama:
        "CALIBRATED",

      Home:
        prediction
          .calibratedProbabilities
          .home,

      Draw:
        prediction
          .calibratedProbabilities
          .draw,

      Away:
        prediction
          .calibratedProbabilities
          .away,

      Toplam:
        probabilityTotal(
          prediction
            .calibratedProbabilities,
        ),
    },

    {
      Aşama:
        "RATING ADJUSTED",

      Home:
        prediction
          .finalProbabilities
          .home,

      Draw:
        prediction
          .finalProbabilities
          .draw,

      Away:
        prediction
          .finalProbabilities
          .away,

      Toplam:
        probabilityTotal(
          prediction
            .finalProbabilities,
        ),
    },
  ]);

  printSection(
    "RATING INPUT",
  );

  console.table({
    "Rating modeli":
      prediction
        .rating
        .modelVersion,

    "Home overall":
      prediction
        .rating
        .homeOverall ??
      "N/A",

    "Away overall":
      prediction
        .rating
        .awayOverall ??
      "N/A",

    "Rating farkı":
      prediction
        .rating
        .ratingDifference ??
      "N/A",

    "Rating güveni":
      prediction
        .rating
        .confidenceScore,

    Edge:
      prediction
        .rating
        .edge,
  });

  printSection(
    "RATING ADJUSTMENT",
  );

  console.table({
    Durum:
      prediction
        .ratingAdjustment
        .status,

    "Teorik shift":
      prediction
        .ratingAdjustment
        .theoreticalShift,

    "Home değişim":
      prediction
        .ratingAdjustment
        .appliedHomeShift,

    "Draw değişim":
      prediction
        .ratingAdjustment
        .appliedDrawShift,

    "Away değişim":
      prediction
        .ratingAdjustment
        .appliedAwayShift,

    Açıklama:
      prediction
        .ratingAdjustment
        .message,
  });

  printSection(
    "FINAL PREDICTION",
  );

  console.table({
    Tahmin:
      prediction
        .predictedOutcome,

    Olasılık:
      prediction
        .predictedProbability,

    "Fair odds":
      prediction
        .finalFairOdds[
          prediction
            .predictedOutcome
            .toLowerCase() as
            | "home"
            | "draw"
            | "away"
        ],

    "Probability güveni":
      prediction
        .probabilityConfidenceScore,

    "Calibration güveni":
      prediction
        .calibrationReliabilityScore,

    "Rating güveni":
      prediction
        .ratingConfidenceScore,

    "Birleşik güven":
      prediction
        .combinedConfidenceScore,

    "Güven seviyesi":
      prediction
        .combinedConfidenceLevel,
  });

  const finalTotal =
    probabilityTotal(
      prediction
        .finalProbabilities,
    );

  if (
    Math.abs(
      finalTotal -
        100,
    ) >
    0.05
  ) {
    throw new Error(
      `Final olasılık toplamı 100 değil: ${finalTotal}`,
    );
  }

  if (
    prediction
      .model
      .ratingModelVersion !==
    "bet-model-v0.2"
  ) {
    throw new Error(
      "Prediction Engine bet-model-v0.2 Rating Engine kullanmıyor.",
    );
  }

  if (
    prediction
      .predictedProbability <=
      0 ||
    prediction
      .predictedProbability >
      100
  ) {
    throw new Error(
      "Final tahmin olasılığı geçersiz.",
    );
  }

  console.log("");
  console.log(
    "PREDICTION ENGINE V2 TESTİ BAŞARILI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Prediction Engine V2 testi başarısız.",
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
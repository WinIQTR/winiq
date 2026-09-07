import "dotenv/config";

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

function getConfidenceMeaning(
  level:
    string,
): string {
  switch (
    level
  ) {
    case "VERY_HIGH":
      return "Çok güçlü veri + güçlü model ayrışması";

    case "HIGH":
      return "Güçlü veri / güçlü tahmin";

    case "MEDIUM":
      return "Kullanılabilir ancak kontrollü";

    case "LOW":
      return "Veri veya model ayrışması sınırlı";

    default:
      return "Veri güveni çok düşük";
  }
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "POISSON CONFIDENCE V1 TEST",
  );

  console.log(
    "==============================================",
  );

  const rawMatchId =
    process.env
      .PREDICTION_TEST_MATCH_ID
      ?.trim();

  let selectedMatchId:
    number | null =
      null;

  if (
    rawMatchId
  ) {
    const parsed =
      Number.parseInt(
        rawMatchId,
        10,
      );

    if (
      Number.isInteger(
        parsed,
      ) &&
      parsed >
        0
    ) {
      selectedMatchId =
        parsed;
    }
  }

  if (
    selectedMatchId ===
    null
  ) {
    const upcoming =
      await prisma
        .match
        .findFirst({
          where: {
            status:
              "SCHEDULED",

            kickoffAt: {
              gte:
                new Date(),
            },

            season: {
              year:
                ACTIVE_SEASON_YEAR,

              league: {
                apiId: {
                  in: [
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
          },
        });

    selectedMatchId =
      upcoming
        ?.id ??
      null;
  }

  if (
    selectedMatchId ===
    null
  ) {
    throw new Error(
      "Confidence testi için maç bulunamadı.",
    );
  }

  const match =
    await prisma
      .match
      .findUnique({
        where: {
          id:
            selectedMatchId,
        },

        select: {
          id:
            true,

          kickoffAt:
            true,

          status:
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
              year:
                true,

              league: {
                select: {
                  name:
                    true,

                  apiId:
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
      `${selectedMatchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  console.log("");
  console.log(
    "MATCH",
  );

  console.table({
    ID:
      match.id,

    Maç:
      `${match.homeTeam.name} - ${match.awayTeam.name}`,

    Lig:
      match
        .season
        .league
        .name,

    Sezon:
      match
        .season
        .year,

    Tarih:
      match
        .kickoffAt
        .toISOString(),

    Status:
      match.status,

    Skor:
      match.homeScore !==
        null &&
      match.awayScore !==
        null
        ? `${match.homeScore}-${match.awayScore}`
        : "-",
  });

  const prediction =
    await generateMatchPrediction({
      matchId:
        match.id,
    });

  const confidence =
    prediction
      .poissonConfidence;

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "POISSON PREDICTION",
  );

  console.log(
    "==============================================",
  );

  console.table({
    HOME:
      prediction
        .finalProbabilities
        .home,

    DRAW:
      prediction
        .finalProbabilities
        .draw,

    AWAY:
      prediction
        .finalProbabilities
        .away,

    "Final prediction":
      prediction
        .predictedOutcome,

    "Final probability":
      prediction
        .predictedProbability,

    "DRAW override":
      prediction
        .drawDecision
        .applied,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DATA QUALITY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "League matches":
      confidence
        .dataQuality
        .leagueMatches,

    "Home venue matches":
      confidence
        .dataQuality
        .homeVenueMatches,

    "Away venue matches":
      confidence
        .dataQuality
        .awayVenueMatches,

    "Minimum venue":
      confidence
        .dataQuality
        .minimumVenueMatches,

    "Average venue":
      confidence
        .dataQuality
        .averageVenueMatches,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CONFIDENCE COMPONENTS",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "League sample":
      confidence
        .components
        .leagueSampleScore,

    "Home venue sample":
      confidence
        .components
        .homeVenueSampleScore,

    "Away venue sample":
      confidence
        .components
        .awayVenueSampleScore,

    "Venue sample":
      confidence
        .components
        .venueSampleScore,

    "Data quality":
      confidence
        .dataQualityScore,

    Separation:
      confidence
        .separationScore,

    "Probability strength":
      confidence
        .probabilityStrengthScore,

    "Warning penalty":
      confidence
        .warningPenalty,

    "DRAW penalty":
      confidence
        .drawOverridePenalty,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "FINAL CONFIDENCE",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Score:
      confidence.score,

    Level:
      confidence.level,

    Meaning:
      getConfidenceMeaning(
        confidence.level,
      ),

    "Prediction gap":
      confidence
        .probabilityGap,

    "Predicted probability":
      confidence
        .predictedProbability,

    "Combined confidence":
      prediction
        .combinedConfidenceScore,

    "Combined level":
      prediction
        .combinedConfidenceLevel,
  });

  console.log("");
  console.log(
    "REASONS",
  );

  for (
    const reason
    of confidence.reasons
  ) {
    console.log(
      `- ${reason}`,
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEGACY VS PRODUCTION CONFIDENCE",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Legacy Probability":
      prediction
        .probabilityConfidenceScore,

    "Calibration reliability":
      prediction
        .calibrationReliabilityScore,

    "Rating confidence":
      prediction
        .ratingConfidenceScore,

    "Production Poisson":
      prediction
        .combinedConfidenceScore,

    "Production level":
      prediction
        .combinedConfidenceLevel,
  });

  console.log("");
  console.log(
    "POISSON CONFIDENCE V1 TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Poisson Confidence V1 testi başarısız.",
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
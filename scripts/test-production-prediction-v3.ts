import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

type Outcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

function formatOutcome(
  outcome: Outcome,
): string {
  return outcome;
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "PRODUCTION PREDICTION V3 TEST",
  );
  console.log(
    "==============================================",
  );

  const rawMatchId =
    process.env
      .PREDICTION_TEST_MATCH_ID
      ?.trim();

  let matchId:
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
      !Number.isInteger(
        parsed,
      ) ||
      parsed <= 0
    ) {
      throw new Error(
        "PREDICTION_TEST_MATCH_ID geçerli bir pozitif tam sayı olmalıdır.",
      );
    }

    matchId =
      parsed;
  }

  const matchSelect = {
    id: true,
    kickoffAt: true,
    status: true,
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
    season: {
      select: {
        year: true,
        league: {
          select: {
            apiId: true,
            name: true,
          },
        },
      },
    },
  } as const;

  let selectedMatch =
    matchId
      ? await prisma
          .match
          .findUnique({
            where: {
              id:
                matchId,
            },
            select:
              matchSelect,
          })
      : null;

  if (
    !selectedMatch
  ) {
    selectedMatch =
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
          select:
            matchSelect,
        });
  }

  if (
    !selectedMatch
  ) {
    const databaseSummary =
      await prisma
        .match
        .aggregate({
          where: {
            kickoffAt: {
              gte:
                new Date(),
            },
          },
          _count: {
            _all: true,
          },
          _min: {
            kickoffAt: true,
          },
        });

    throw new Error(
      [
        "Test için uygun yaklaşan maç bulunamadı.",
        `Veritabanındaki gelecek maç sayısı: ${databaseSummary._count._all}.`,
        `İlk gelecek maç: ${databaseSummary._min.kickoffAt?.toISOString() ?? "yok"}.`,
        "Kontrol edilen koşullar: SCHEDULED status ve aktif organizasyon.",
      ].join(" "),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("MATCH");
  console.log(
    "==============================================",
  );

  console.table({
    "Database ID":
      selectedMatch.id,
    Maç:
      `${selectedMatch.homeTeam.name} - ${selectedMatch.awayTeam.name}`,
    Lig:
      selectedMatch.season.league.name,
    "Lig API":
      selectedMatch.season.league.apiId,
    Sezon:
      selectedMatch.season.year,
    Tarih:
      selectedMatch.kickoffAt.toISOString(),
    Status:
      selectedMatch.status,
  });

  const result =
    await generateMatchPrediction({
      matchId:
        selectedMatch.id,
    });

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("MODEL");
  console.log(
    "==============================================",
  );

  console.table({
    Production:
      result.model.productionModelName,
    Status:
      result.model.status,
    "Poisson model":
      `${result.model.goalProbabilityModelName} ${result.model.goalProbabilityModelVersion}`,
    "DRAW model":
      result.model.drawDecisionModelVersion,
    "Legacy probability":
      `${result.model.probabilityModelName} ${result.model.probabilityModelVersion}`,
    "Rating model":
      result.model.ratingModelVersion,
  });

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "PROBABILITY COMPARISON",
  );
  console.log(
    "==============================================",
  );

  console.table([
    {
      stage:
        "RAW LEGACY",
      home:
        result.rawProbabilities.home,
      draw:
        result.rawProbabilities.draw,
      away:
        result.rawProbabilities.away,
    },
    {
      stage:
        "CALIBRATED LEGACY",
      home:
        result.calibratedProbabilities.home,
      draw:
        result.calibratedProbabilities.draw,
      away:
        result.calibratedProbabilities.away,
    },
    {
      stage:
        "RATING LEGACY",
      home:
        result.ratingAdjustedProbabilities.home,
      draw:
        result.ratingAdjustedProbabilities.draw,
      away:
        result.ratingAdjustedProbabilities.away,
    },
    {
      stage:
        "20% ML / 80% POISSON FINAL",
      home:
        result.finalProbabilities.home,
      draw:
        result.finalProbabilities.draw,
      away:
        result.finalProbabilities.away,
    },
  ]);

  console.log("");
  console.log(
    "==============================================",
  );
  console.log("DRAW DECISION");
  console.log(
    "==============================================",
  );

  console.table({
    Status:
      result.drawDecision.status,
    Applied:
      result.drawDecision.applied,
    "Poisson baseline":
      formatOutcome(
        result.drawDecision.baselineOutcome,
      ),
    "Final outcome":
      formatOutcome(
        result.drawDecision.selectedOutcome,
      ),
    "DRAW probability":
      result.drawDecision.drawProbability,
    "Strongest non-DRAW":
      result.drawDecision.strongestNonDrawProbability,
    "DRAW gap":
      result.drawDecision.drawGap,
    "Minimum DRAW":
      result.drawDecision.configuration.minimumDrawProbability,
    "Maximum gap":
      result.drawDecision.configuration.maximumDrawGap,
  });

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "FINAL PRODUCTION PREDICTION",
  );
  console.log(
    "==============================================",
  );

  const predictedOutcomeKey =
    result.predictedOutcome
      .toLowerCase() as
        | "home"
        | "draw"
        | "away";

  console.table({
    Tahmin:
      result.predictedOutcome,
    Olasılık:
      result.predictedProbability,
    "Fair odds":
      result.finalFairOdds[
        predictedOutcomeKey
      ],
    "Poisson baseline":
      result.poissonPredictedOutcome,
    "Poisson baseline probability":
      result.poissonPredictedProbability,
    "DRAW override":
      result.drawDecision.applied
        ? "YES"
        : "NO",
    "Combined confidence":
      result.combinedConfidenceScore,
    "Confidence level":
      result.combinedConfidenceLevel,
  });

  console.log("");
  console.log("WARNINGS");

  if (
    result.warnings.length === 0
  ) {
    console.log("- Uyarı yok.");
  } else {
    for (
      const warning
      of result.warnings
    ) {
      console.log(
        `- ${warning}`,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "PRODUCTION PREDICTION V3 TESTİ TAMAMLANDI.",
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
        "Production Prediction V3 testi başarısız.",
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

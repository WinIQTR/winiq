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
  ACTIVE_CALCULATION_RUN_ID,
  generateMatchFeatures,
} from "@/modules/feature-engine";

import {
  calculateMatchRating,
} from "@/modules/rating-engine";

import type {
  TeamRating,
} from "@/modules/rating-engine";

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

function createTeamRow(
  team:
    TeamRating,
): Record<
  string,
  string | number
> {
  return {
    Takım:
      team.teamName,

    Overall:
      team.overall ??
      "N/A",

    Form:
      team.form ??
      "N/A",

    Attack:
      team.attack ??
      "N/A",

    Defense:
      team.defense ??
      "N/A",

    Venue:
      team.venue ??
      "N/A",

    xG:
      team.xg ??
      "N/A",

    "Shot Threat":
      team.shotThreat ??
      "N/A",

    Fitness:
      team.fitness ??
      "N/A",

    Confidence:
      team.confidenceScore,

    Model:
      team.modelVersion,
  };
}

async function main(): Promise<void> {
  printSection(
    "RATING ENGINE V2 TEST",
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

    "Calculation run":
      ACTIVE_CALCULATION_RUN_ID,
  });

  /*
   * Rating hesabından önce aktif calculation
   * run için feature değerlerini güncelliyoruz.
   */
  await generateMatchFeatures({
    matchId:
      match.id,

    calculationRunId:
      ACTIVE_CALCULATION_RUN_ID,

    snapshotTime:
      match.kickoffAt,

    effectiveCalculatedAt:
      match.kickoffAt,
  });

  const rating =
    await calculateMatchRating(
      match.id,
    );

  printSection(
    "TEAM RATINGS",
  );

  console.table([
    createTeamRow(
      rating.home,
    ),

    createTeamRow(
      rating.away,
    ),
  ]);

  printSection(
    "CATEGORY DETAILS — HOME",
  );

  console.table(
    rating.home.categories.map(
      (
        category,
      ) => ({
        Kategori:
          category.category,

        Score:
          category.score ??
          "N/A",

        Confidence:
          category.confidenceScore,

        Coverage:
          category.coveragePercentage,

        Kullanılan:
          `${category.usedFeatureCount}/${category.configuredFeatureCount}`,

        Eksik:
          category.missingFeatureCount,
      }),
    ),
  );

  printSection(
    "CATEGORY DETAILS — AWAY",
  );

  console.table(
    rating.away.categories.map(
      (
        category,
      ) => ({
        Kategori:
          category.category,

        Score:
          category.score ??
          "N/A",

        Confidence:
          category.confidenceScore,

        Coverage:
          category.coveragePercentage,

        Kullanılan:
          `${category.usedFeatureCount}/${category.configuredFeatureCount}`,

        Eksik:
          category.missingFeatureCount,
      }),
    ),
  );

  printSection(
    "MATCH RATING RESULT",
  );

  console.table({
    "Home overall":
      rating.home.overall ??
      "N/A",

    "Away overall":
      rating.away.overall ??
      "N/A",

    "Rating farkı":
      rating.ratingDifference ??
      "N/A",

    "Ortak güven":
      rating.combinedConfidenceScore,

    Edge:
      rating.edge,

    Model:
      rating.home.modelVersion,
  });

  if (
    rating.home.modelVersion !==
      "bet-model-v0.2" ||
    rating.away.modelVersion !==
      "bet-model-v0.2"
  ) {
    throw new Error(
      "Rating Engine aktif bet-model-v0.2 modelini kullanmıyor.",
    );
  }

  if (
    rating.home.overall ===
      null ||
    rating.away.overall ===
      null
  ) {
    throw new Error(
      "Takım overall rating değerlerinden biri üretilemedi.",
    );
  }

  if (
    rating.ratingDifference ===
    null
  ) {
    throw new Error(
      "Rating farkı hesaplanamadı.",
    );
  }

  console.log("");
  console.log(
    "RATING ENGINE V2 TESTİ BAŞARILI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Rating Engine V2 testi başarısız.",
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
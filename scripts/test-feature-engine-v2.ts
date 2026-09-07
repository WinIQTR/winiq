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

const EXPECTED_V2_FEATURE_KEYS = [
  "last_10_points_per_game",
  "last_10_goals_scored_per_game",
  "last_10_goals_conceded_per_game",

  "venue_last_10_points_per_game",
  "venue_last_10_goals_scored_per_game",
  "venue_last_10_goals_conceded_per_game",

  "win_rate",
  "draw_rate",
  "loss_rate",

  "clean_sheet_rate",
  "btts_rate",
  "over_2_5_rate",

  "goal_difference_per_game",
  "form_momentum",
  "fixture_congestion_14_days",
] as const;

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

async function main(): Promise<void> {
  printSection(
    "FEATURE ENGINE V2 TEST",
  );

  console.table({
    "Aktif sezon":
      ACTIVE_SEASON_YEAR,

    "Aktif organizasyon":
      ACTIVE_COMPETITION_API_IDS.length,

    "Calculation run":
      ACTIVE_CALCULATION_RUN_ID,

    "Beklenen V2 feature":
      EXPECTED_V2_FEATURE_KEYS.length,
  });

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
                [...ACTIVE_COMPETITION_API_IDS],
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
      "Aktif organizasyonlarda yaklaşan maç bulunamadı.",
    );
  }

  console.log("");
  console.log(
    `Test maçı: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Lig: ${match.season.league.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  const result =
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

  printSection(
    "HOME FEATURES",
  );

  console.log(
    result.home.teamName,
  );

  console.table(
    result.home.values.map(
      (
        feature,
      ) => ({
        key:
          feature.key,

        raw:
          feature.rawValue,

        normalized:
          feature.normalizedValue,

        quality:
          feature.dataQualityScore,
      }),
    ),
  );

  printSection(
    "AWAY FEATURES",
  );

  console.log(
    result.away.teamName,
  );

  console.table(
    result.away.values.map(
      (
        feature,
      ) => ({
        key:
          feature.key,

        raw:
          feature.rawValue,

        normalized:
          feature.normalizedValue,

        quality:
          feature.dataQualityScore,
      }),
    ),
  );

  const homeFeatureKeys =
    new Set(
      result.home.values.map(
        (
          feature,
        ) =>
          feature.key,
      ),
    );

  const awayFeatureKeys =
    new Set(
      result.away.values.map(
        (
          feature,
        ) =>
          feature.key,
      ),
    );

  const missingHomeFeatures =
    EXPECTED_V2_FEATURE_KEYS.filter(
      (
        key,
      ) =>
        !homeFeatureKeys.has(
          key,
        ),
    );

  const missingAwayFeatures =
    EXPECTED_V2_FEATURE_KEYS.filter(
      (
        key,
      ) =>
        !awayFeatureKeys.has(
          key,
        ),
    );

  const homeV2Features =
    result.home.values.filter(
      (
        feature,
      ) =>
        (
          EXPECTED_V2_FEATURE_KEYS as readonly string[]
        ).includes(
          feature.key,
        ),
    );

  const awayV2Features =
    result.away.values.filter(
      (
        feature,
      ) =>
        (
          EXPECTED_V2_FEATURE_KEYS as readonly string[]
        ).includes(
          feature.key,
        ),
    );

  const homeAvailableCount =
    homeV2Features.filter(
      (
        feature,
      ) =>
        feature.rawValue !==
        null,
    ).length;

  const awayAvailableCount =
    awayV2Features.filter(
      (
        feature,
      ) =>
        feature.rawValue !==
        null,
    ).length;

  printSection(
    "FEATURE ENGINE V2 RESULT",
  );

  console.table({
    "Home feature toplam":
      result.home.values.length,

    "Away feature toplam":
      result.away.values.length,

    "Home V2 mevcut":
      `${homeAvailableCount}/${EXPECTED_V2_FEATURE_KEYS.length}`,

    "Away V2 mevcut":
      `${awayAvailableCount}/${EXPECTED_V2_FEATURE_KEYS.length}`,

    "Home yeni kayıt":
      result.home.createdCount,

    "Home güncelleme":
      result.home.updatedCount,

    "Home eksik değer":
      result.home.missingCount,

    "Away yeni kayıt":
      result.away.createdCount,

    "Away güncelleme":
      result.away.updatedCount,

    "Away eksik değer":
      result.away.missingCount,
  });

  if (
    missingHomeFeatures.length >
    0
  ) {
    console.error("");
    console.error(
      `Home tarafında üretilmeyen feature: ${missingHomeFeatures.join(", ")}`,
    );
  }

  if (
    missingAwayFeatures.length >
    0
  ) {
    console.error("");
    console.error(
      `Away tarafında üretilmeyen feature: ${missingAwayFeatures.join(", ")}`,
    );
  }

  if (
    missingHomeFeatures.length >
      0 ||
    missingAwayFeatures.length >
      0
  ) {
    throw new Error(
      "Feature Engine V2 feature kapsamı eksik.",
    );
  }

  console.log("");
  console.log(
    "FEATURE ENGINE V2 TESTİ BAŞARILI.",
  );

  console.log(
    "15 yeni form feature'ı gerçek maç için üretildi ve veritabanına kaydedildi.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Feature Engine V2 testi başarısız.",
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
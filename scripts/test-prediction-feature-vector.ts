import {
  prisma,
} from "@/lib/prisma";

import {
  HISTORICAL_SNAPSHOT_RUN_PREFIX,
} from "@/modules/feature-engine";

import {
  buildMatchFeatureVector,
} from "@/modules/prediction-feature-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "PREDICTION FEATURE VECTOR TEST",
  );
  console.log(
    "========================================",
  );

  /*
   * Squad feature üretilmiş bir historical
   * maç seçiyoruz.
   */
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            2024,

          league: {
            apiId:
              39,
          },
        },

        featureValues: {
          some: {
            feature: {
              key:
                "squad_strength",
            },
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,

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

      orderBy: {
        kickoffAt:
          "desc",
      },
    });

  if (!match) {
    console.log(
      "Feature vector testi için uygun maç bulunamadı.",
    );

    return;
  }

  const runId =
    `${HISTORICAL_SNAPSHOT_RUN_PREFIX}-match-${match.id}`;

  console.log("");
  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );
  console.log(
    `Run: ${runId}`,
  );

  const result =
    await buildMatchFeatureVector({
      matchId:
        match.id,

      calculationRunId:
        runId,
    });

  console.log("");
  console.log(
    "VECTOR SUMMARY",
  );

  console.table({
    "Feature sayısı":
      result.quality
        .featureCount,

    "Eksik feature":
      result.quality
        .missingFeatureCount,

    "Ortalama kalite":
      result.quality
        .average,

    "Minimum kalite":
      result.quality
        .minimum,

    "Vector alanı":
      Object.keys(
        result.vector,
      ).length,

    Uyarı:
      result.warnings.length,
  });

  console.log("");
  console.log(
    "TEAM FEATURES",
  );

  console.table(
    result.features
      .filter(
        (feature) =>
          feature.source !==
          "H2H",
      )
      .map(
        (feature) => ({
          key:
            feature.key,

          home:
            feature.homeValue,

          away:
            feature.awayValue,

          diff:
            feature.difference,

          quality:
            feature.combinedQuality,

          source:
            feature.source,
        }),
      ),
  );

  console.log("");
  console.log(
    "H2H / MATCH FEATURES",
  );

  console.table(
    result.features
      .filter(
        (feature) =>
          feature.source ===
          "H2H",
      )
      .map(
        (feature) => ({
          key:
            feature.key,

          value:
            feature.homeValue,

          quality:
            feature.combinedQuality,
        }),
      ),
  );

  console.log("");
  console.log(
    "ÖRNEK MODEL VECTOR",
  );

  console.table({
    home_squad_strength:
      result.vector[
        "home_squad_strength"
      ],

    away_squad_strength:
      result.vector[
        "away_squad_strength"
      ],

    diff_squad_strength:
      result.vector[
        "diff_squad_strength"
      ],

    home_attack_strength:
      result.vector[
        "home_attack_strength"
      ],

    away_attack_strength:
      result.vector[
        "away_attack_strength"
      ],

    diff_attack_strength:
      result.vector[
        "diff_attack_strength"
      ],

    home_goalkeeper_strength:
      result.vector[
        "home_goalkeeper_strength"
      ],

    away_goalkeeper_strength:
      result.vector[
        "away_goalkeeper_strength"
      ],

    diff_goalkeeper_strength:
      result.vector[
        "diff_goalkeeper_strength"
      ],
  });

  if (
    result.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "UYARILAR",
    );

    console.table(
      result.warnings.map(
        (warning) => ({
          uyarı:
            warning,
        }),
      ),
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
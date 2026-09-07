import "dotenv/config";

import {
  FeatureStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

type FeatureWeightConfiguration = {
  key: string;
  rawWeight: number;
};

const MODEL_NAME =
  "BET Model V2";

const MODEL_VERSION =
  "bet-model-v0.2";

const MODEL_DESCRIPTION =
  [
    "Feature Engine V2 modeli.",
    "Son 5 ve son 10 form,",
    "saha bazlı performans,",
    "gol profili, xG, şut tehdidi,",
    "dinlenme ve maç yoğunluğu özelliklerini kullanır.",
  ].join(
    " ",
  );

/*
 * Buradaki değerler göreceli başlangıç
 * önemleridir. Script bunları otomatik
 * olarak toplamı 1 olacak şekilde normalize eder.
 *
 * Learning Engine ve backtest sonuçlarına göre
 * daha sonra güncellenecektir.
 */
const FEATURE_WEIGHT_CONFIGURATION:
  readonly FeatureWeightConfiguration[] = [
  /*
   * FORM
   */
  {
    key:
      "last_5_points_per_game",

    rawWeight:
      14,
  },

  {
    key:
      "last_10_points_per_game",

    rawWeight:
      16,
  },

  {
    key:
      "form_momentum",

    rawWeight:
      6,
  },

  {
    key:
      "win_rate",

    rawWeight:
      7,
  },

  {
    key:
      "loss_rate",

    rawWeight:
      5,
  },

  {
    key:
      "goal_difference_per_game",

    rawWeight:
      9,
  },

  /*
   * ATTACK / DEFENCE
   */
  {
    key:
      "goals_scored_per_game",

    rawWeight:
      9,
  },

  {
    key:
      "goals_conceded_per_game",

    rawWeight:
      9,
  },

  {
    key:
      "last_10_goals_scored_per_game",

    rawWeight:
      7,
  },

  {
    key:
      "last_10_goals_conceded_per_game",

    rawWeight:
      7,
  },

  {
    key:
      "clean_sheet_rate",

    rawWeight:
      5,
  },

  /*
   * VENUE
   */
  {
    key:
      "venue_last_5_points_per_game",

    rawWeight:
      8,
  },

  {
    key:
      "venue_last_10_points_per_game",

    rawWeight:
      9,
  },

  {
    key:
      "venue_goals_scored_per_game",

    rawWeight:
      5,
  },

  {
    key:
      "venue_goals_conceded_per_game",

    rawWeight:
      5,
  },

  {
    key:
      "venue_last_10_goals_scored_per_game",

    rawWeight:
      5,
  },

  {
    key:
      "venue_last_10_goals_conceded_per_game",

    rawWeight:
      5,
  },

  /*
   * xG
   */
  {
    key:
      "expected_goals_per_game",

    rawWeight:
      8,
  },

  {
    key:
      "expected_goals_against_per_game",

    rawWeight:
      8,
  },

  {
    key:
      "expected_goals_difference",

    rawWeight:
      12,
  },

  {
    key:
      "last5_expected_goals",

    rawWeight:
      7,
  },

  {
    key:
      "last5_expected_goals_against",

    rawWeight:
      7,
  },

  {
    key:
      "last5_expected_goals_difference",

    rawWeight:
      9,
  },

  /*
   * SHOT THREAT
   */
  {
    key:
      "shots_per_game",

    rawWeight:
      4,
  },

  {
    key:
      "shots_on_target_per_game",

    rawWeight:
      6,
  },

  {
    key:
      "shot_accuracy",

    rawWeight:
      5,
  },

  {
    key:
      "attacking_pressure",

    rawWeight:
      6,
  },

  {
    key:
      "last5_shots_on_target_per_game",

    rawWeight:
      5,
  },

  {
    key:
      "last5_attacking_pressure",

    rawWeight:
      5,
  },

  /*
   * FITNESS
   */
  {
    key:
      "rest_days",

    rawWeight:
      4,
  },

  {
    key:
      "fixture_congestion_14_days",

    rawWeight:
      4,
  },
] as const;

function round(
  value: number,
  decimals = 6,
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

function validateConfiguration():
  void {
  const seenKeys =
    new Set<string>();

  for (
    const configuration
    of FEATURE_WEIGHT_CONFIGURATION
  ) {
    if (
      !configuration.key.trim()
    ) {
      throw new Error(
        "Model feature key boş olamaz.",
      );
    }

    if (
      seenKeys.has(
        configuration.key,
      )
    ) {
      throw new Error(
        `Model feature listesinde tekrar eden key: ${configuration.key}`,
      );
    }

    if (
      !Number.isFinite(
        configuration.rawWeight,
      ) ||
      configuration.rawWeight <=
        0
    ) {
      throw new Error(
        `${configuration.key} için rawWeight pozitif olmalıdır.`,
      );
    }

    seenKeys.add(
      configuration.key,
    );
  }
}

async function main(): Promise<void> {
  validateConfiguration();

  printSection(
    "FEATURE MODEL V2 UPGRADE",
  );

  console.table({
    "Model adı":
      MODEL_NAME,

    "Model versiyonu":
      MODEL_VERSION,

    "Feature sayısı":
      FEATURE_WEIGHT_CONFIGURATION.length,
  });

  const configuredKeys =
    FEATURE_WEIGHT_CONFIGURATION.map(
      (
        configuration,
      ) =>
        configuration.key,
    );

  const definitions =
    await prisma.featureDefinition.findMany({
      where: {
        key: {
          in:
            configuredKeys,
        },

        status:
          FeatureStatus.ACTIVE,
      },

      select: {
        id:
          true,

        key:
          true,

        name:
          true,

        minimumValue:
          true,

        maximumValue:
          true,

        higherIsBetter:
          true,

        status:
          true,
      },

      orderBy: {
        key:
          "asc",
      },
    });

  const definitionByKey =
    new Map(
      definitions.map(
        (
          definition,
        ) => [
          definition.key,
          definition,
        ],
      ),
    );

  const missingDefinitions =
    configuredKeys.filter(
      (
        key,
      ) =>
        !definitionByKey.has(
          key,
        ),
    );

  if (
    missingDefinitions.length >
    0
  ) {
    throw new Error(
      [
        "Aktif feature tanımları eksik.",
        "Önce sync-feature-definitions.ts çalıştırılmalıdır.",
        `Eksik: ${missingDefinitions.join(", ")}`,
      ].join(
        " ",
      ),
    );
  }

  const invalidDefinitions =
    definitions.filter(
      (
        definition,
      ) =>
        definition.minimumValue ===
          null ||
        definition.maximumValue ===
          null ||
        definition.higherIsBetter ===
          null,
    );

  if (
    invalidDefinitions.length >
    0
  ) {
    throw new Error(
      [
        "Bazı feature tanımları normalize edilemez.",
        "minimumValue, maximumValue ve higherIsBetter zorunludur.",
        `Geçersiz: ${invalidDefinitions
          .map(
            (
              definition,
            ) =>
              definition.key,
          )
          .join(", ")}`,
      ].join(
        " ",
      ),
    );
  }

  const totalRawWeight =
    FEATURE_WEIGHT_CONFIGURATION.reduce(
      (
        total,
        configuration,
      ) =>
        total +
        configuration.rawWeight,

      0,
    );

  const normalizedConfigurations =
    FEATURE_WEIGHT_CONFIGURATION.map(
      (
        configuration,
      ) => ({
        ...configuration,

        weight:
          round(
            configuration.rawWeight /
              totalRawWeight,
          ),
      }),
    );

  /*
   * Yuvarlamadan sonra toplam tam 1 olmayabilir.
   * Farkı ilk feature'a ekleyerek toplamı kesinleştiriyoruz.
   */
  const normalizedTotal =
    normalizedConfigurations.reduce(
      (
        total,
        configuration,
      ) =>
        total +
        configuration.weight,

      0,
    );

  const roundingDifference =
    round(
      1 -
        normalizedTotal,
    );

  if (
    normalizedConfigurations.length >
      0 &&
    roundingDifference !==
      0
  ) {
    normalizedConfigurations[0] = {
      ...normalizedConfigurations[0],

      weight:
        round(
          normalizedConfigurations[0]
            .weight +
            roundingDifference,
        ),
    };
  }

  const modelVersion =
    await prisma.$transaction(
      async (
        transaction,
      ) => {
        /*
         * Eski modelleri pasif yap.
         */
        await transaction.modelVersion.updateMany({
          where: {
            isActive:
              true,

            version: {
              not:
                MODEL_VERSION,
            },
          },

          data: {
            isActive:
              false,
          },
        });

        const model =
          await transaction.modelVersion.upsert({
            where: {
              version:
                MODEL_VERSION,
            },

            update: {
              name:
                MODEL_NAME,

              description:
                MODEL_DESCRIPTION,

              isActive:
                true,
            },

            create: {
              name:
                MODEL_NAME,

              version:
                MODEL_VERSION,

              description:
                MODEL_DESCRIPTION,

              isActive:
                true,
            },
          });

        /*
         * Script tekrar çalıştırılırsa modelden
         * çıkarılmış eski ağırlıkları temizle.
         */
        await transaction.modelFeatureWeight.deleteMany({
          where: {
            modelVersionId:
              model.id,

            feature: {
              key: {
                notIn:
                  configuredKeys,
              },
            },
          },
        });

        for (
          const configuration
          of normalizedConfigurations
        ) {
          const definition =
            definitionByKey.get(
              configuration.key,
            );

          if (
            !definition
          ) {
            throw new Error(
              `Feature tanımı bulunamadı: ${configuration.key}`,
            );
          }

          await transaction.modelFeatureWeight.upsert({
            where: {
              modelVersionId_featureId: {
                modelVersionId:
                  model.id,

                featureId:
                  definition.id,
              },
            },

            update: {
              weight:
                configuration.weight,

              learned:
                false,
            },

            create: {
              modelVersionId:
                model.id,

              featureId:
                definition.id,

              weight:
                configuration.weight,

              learned:
                false,
            },
          });
        }

        return model;
      },
    );

  printSection(
    "MODEL FEATURE WEIGHTS",
  );

  console.table(
    normalizedConfigurations.map(
      (
        configuration,
      ) => ({
        feature:
          configuration.key,

        rawWeight:
          configuration.rawWeight,

        normalizedWeight:
          configuration.weight,
      }),
    ),
  );

  const savedModel =
    await prisma.modelVersion.findUnique({
      where: {
        id:
          modelVersion.id,
      },

      include: {
        featureWeights: {
          include: {
            feature:
              true,
          },

          orderBy: {
            feature: {
              key:
                "asc",
            },
          },
        },
      },
    });

  if (
    !savedModel
  ) {
    throw new Error(
      "Kaydedilen model tekrar yüklenemedi.",
    );
  }

  const savedWeightTotal =
    savedModel.featureWeights.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.weight,

      0,
    );

  printSection(
    "UPGRADE RESULT",
  );

  console.table({
    "Model ID":
      savedModel.id,

    "Model adı":
      savedModel.name,

    Versiyon:
      savedModel.version,

    Aktif:
      savedModel.isActive,

    "Feature sayısı":
      savedModel.featureWeights.length,

    "Ağırlık toplamı":
      round(
        savedWeightTotal,
      ),
  });

  if (
    savedModel.featureWeights.length !==
    FEATURE_WEIGHT_CONFIGURATION.length
  ) {
    throw new Error(
      [
        "Kaydedilen model feature sayısı hatalı.",
        `Beklenen=${FEATURE_WEIGHT_CONFIGURATION.length}`,
        `Bulunan=${savedModel.featureWeights.length}`,
      ].join(
        " ",
      ),
    );
  }

  if (
    Math.abs(
      savedWeightTotal -
        1,
    ) >
    0.0001
  ) {
    throw new Error(
      `Model ağırlık toplamı 1 değil: ${savedWeightTotal}`,
    );
  }

  console.log("");
  console.log(
    "BET MODEL V0.2 BAŞARIYLA AKTİF EDİLDİ.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Feature model V2 yükseltmesi başarısız.",
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
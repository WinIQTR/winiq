import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  registerAllFeatures,
} from "@/modules/feature-registry";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "FEATURE REGISTRY SYNC",
  );

  console.log(
    "========================================",
  );

  console.log("");

  const definitions =
    registerAllFeatures();

  console.log(
    `Registry feature sayısı: ${definitions.length}`,
  );

  console.log("");

  let createdCount =
    0;

  let updatedCount =
    0;

  for (
    const definition
    of definitions
  ) {
    const existing =
      await prisma.featureDefinition.findUnique({
        where: {
          key:
            definition.key,
        },

        select: {
          id: true,
        },
      });

    const saved =
      await prisma.featureDefinition.upsert({
        where: {
          key:
            definition.key,
        },

        update: {
          name:
            definition.name,

          description:
            definition.description,

          scope:
            definition.scope,

          category:
            definition.category,

          valueType:
            definition.valueType,

          status:
            definition.status,

          unit:
            definition.unit ??
            null,

          minimumValue:
            definition.minimumValue ??
            null,

          maximumValue:
            definition.maximumValue ??
            null,

          higherIsBetter:
            definition.higherIsBetter ??
            null,

          availableBeforeMatch:
            definition.availableBeforeMatch,

          requiredDataSource:
            definition.requiredDataSource ??
            null,

          calculationVersion:
            definition.calculationVersion,
        },

        create: {
          key:
            definition.key,

          name:
            definition.name,

          description:
            definition.description,

          scope:
            definition.scope,

          category:
            definition.category,

          valueType:
            definition.valueType,

          status:
            definition.status,

          unit:
            definition.unit ??
            null,

          minimumValue:
            definition.minimumValue ??
            null,

          maximumValue:
            definition.maximumValue ??
            null,

          higherIsBetter:
            definition.higherIsBetter ??
            null,

          availableBeforeMatch:
            definition.availableBeforeMatch,

          requiredDataSource:
            definition.requiredDataSource ??
            null,

          calculationVersion:
            definition.calculationVersion,
        },
      });

    if (
      existing
    ) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }

    console.log(
      `${existing ? "UPDATE" : "CREATE"} • ${saved.key}`,
    );
  }

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "SYNC RESULT",
  );

  console.log(
    "========================================",
  );

  console.table({
    "Registry feature":
      definitions.length,

    "Yeni feature":
      createdCount,

    "Güncellenen feature":
      updatedCount,
  });

  console.log("");

  const databaseDefinitions =
    await prisma.featureDefinition.findMany({
      where: {
        key: {
          in:
            definitions.map(
              (definition) =>
                definition.key,
            ),
        },
      },

      select: {
        key: true,
        category: true,
        scope: true,
        status: true,
        calculationVersion: true,
      },

      orderBy: {
        key:
          "asc",
      },
    });

  console.log(
    "DATABASE",
  );

  console.table(
    databaseDefinitions,
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Feature Registry sync başarısız.",
      );

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
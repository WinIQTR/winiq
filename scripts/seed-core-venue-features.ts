import "dotenv/config";

import {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

const definitions = [
  {
    key:
      "venue_last_5_points_per_game",

    name:
      "Venue Last 5 Points Per Game",

    description:
      "Ev sahibi için iç sahadaki, deplasman takımı için deplasmandaki son 5 maç puan ortalaması.",

    scope:
      FeatureScope.TEAM,

    category:
      FeatureCategory.HOME_AWAY,

    valueType:
      FeatureValueType.NUMBER,

    status:
      FeatureStatus.ACTIVE,

    unit:
      "points_per_game",

    minimumValue:
      0,

    maximumValue:
      3,

    higherIsBetter:
      true,

    availableBeforeMatch:
      true,

    requiredDataSource:
      "INTERNAL_MATCH_HISTORY",

    calculationVersion:
      "venue-form-v0.3",
  },

  {
    key:
      "venue_goals_scored_per_game",

    name:
      "Venue Goals Scored Per Game",

    description:
      "Ev sahibi için iç sahadaki, deplasman takımı için deplasmandaki son 5 maç gol ortalaması.",

    scope:
      FeatureScope.TEAM,

    category:
      FeatureCategory.HOME_AWAY,

    valueType:
      FeatureValueType.NUMBER,

    status:
      FeatureStatus.ACTIVE,

    unit:
      "goals_per_game",

    minimumValue:
      0,

    maximumValue:
      5,

    higherIsBetter:
      true,

    availableBeforeMatch:
      true,

    requiredDataSource:
      "INTERNAL_MATCH_HISTORY",

    calculationVersion:
      "venue-form-v0.3",
  },

  {
    key:
      "venue_goals_conceded_per_game",

    name:
      "Venue Goals Conceded Per Game",

    description:
      "Ev sahibi için iç sahadaki, deplasman takımı için deplasmandaki son 5 maç yenilen gol ortalaması.",

    scope:
      FeatureScope.TEAM,

    category:
      FeatureCategory.HOME_AWAY,

    valueType:
      FeatureValueType.NUMBER,

    status:
      FeatureStatus.ACTIVE,

    unit:
      "goals_per_game",

    minimumValue:
      0,

    maximumValue:
      5,

    higherIsBetter:
      false,

    availableBeforeMatch:
      true,

    requiredDataSource:
      "INTERNAL_MATCH_HISTORY",

    calculationVersion:
      "venue-form-v0.3",
  },
] as const;

async function main(): Promise<void> {
  console.log(
    "\nCORE VENUE FEATURE SEED\n",
  );

  for (const definition of definitions) {
    const saved =
      await prisma.featureDefinition.upsert({
        where: {
          key:
            definition.key,
        },

        update: {
          ...definition,
        },

        create: {
          ...definition,
        },
      });

    console.log({
      id:
        saved.id,

      key:
        saved.key,

      status:
        saved.status,
    });
  }

  console.log(
    "\nVenue feature tanımları hazır.\n",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Venue feature seed başarısız:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
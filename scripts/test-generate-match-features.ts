import "dotenv/config";

import { MatchStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { generateMatchFeatures } from "../src/modules/feature-engine";
import { ACTIVE_CALCULATION_RUN_ID } from "../src/modules/feature-engine/generate-match-features";

async function main(): Promise<void> {
  /*
   * Test için 2024 Premier League sezonunun
   * son tamamlanan maçlarından biri seçilir.
   */
  const match = await prisma.match.findFirst({
    where: {
      status: MatchStatus.FINISHED,
      season: {
        year: 2024,
        league: {
          apiId: 39,
        },
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: {
      kickoffAt: "desc",
    },
  });

  if (!match) {
    throw new Error(
      "Test edilecek Premier League maçı bulunamadı.",
    );
  }

  console.log("\nFEATURE ÜRETİLECEK MAÇ\n");

  console.log({
    matchId: match.id,
    apiId: match.apiId,
    kickoffAt: match.kickoffAt,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
  });

  const result = await generateMatchFeatures(match.id);

  console.log("\nMATCH FEATURE GENERATOR SONUCU\n");

  console.log(
    JSON.stringify(result, null, 2),
  );

  const storedValueCount =
  await prisma.matchFeatureValue.count({
    where: {
      matchId: match.id,
      calculationRunId:
        ACTIVE_CALCULATION_RUN_ID,
    },
  });

  console.log(
  `\nBu maç için ${ACTIVE_CALCULATION_RUN_ID} sürümündeki feature kayıt sayısı: ${storedValueCount}`,
);
}

main()
  .catch((error: unknown) => {
    console.error("Match Feature Generator testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
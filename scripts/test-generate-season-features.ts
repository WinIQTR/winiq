import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { generateSeasonFeatures } from "../src/modules/feature-engine";

async function main(): Promise<void> {
  console.log("\nSEZON FEATURE ÜRETİMİ BAŞLIYOR\n");

  const result = await generateSeasonFeatures({
    leagueApiId: 39,
    seasonYear: 2024,
  });

  console.log("\nSEZON FEATURE ÜRETİM SONUCU\n");
  console.log(JSON.stringify(result, null, 2));

  const totalFeatureValues =
    await prisma.matchFeatureValue.count({
      where: {
        match: {
          season: {
            year: 2024,
            league: {
              apiId: 39,
            },
          },
        },
      },
    });

  console.log(
    `\nPremier League 2024 toplam feature kayıt sayısı: ${totalFeatureValues}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Sezon feature testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { loadActiveFeatureModel } from "../src/modules/feature-engine";

async function main(): Promise<void> {
  const model = await loadActiveFeatureModel();

  console.log("\nAKTİF FEATURE MODELİ\n");

  console.log({
    id: model.id,
    name: model.name,
    version: model.version,
    featureCount: model.features.length,
  });

  console.log("\nMODEL FEATURE'LARI\n");

  for (const feature of model.features) {
    console.log({
      key: feature.key,
      minimumValue: feature.minimumValue,
      maximumValue: feature.maximumValue,
      higherIsBetter: feature.higherIsBetter,
      weight: feature.weight,
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Aktif model testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
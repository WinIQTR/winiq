import "dotenv/config";

import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  console.log("DataSource nesnesi:", typeof prisma.dataSource);

  const sources = await prisma.dataSource.findMany({
    orderBy: {
      priority: "asc",
    },
  });

  console.log(`DataSource kayıt sayısı: ${sources.length}`);
  console.log(
    sources.map((source) => ({
      code: source.code,
      name: source.name,
    })),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Prisma Client testi başarısız:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
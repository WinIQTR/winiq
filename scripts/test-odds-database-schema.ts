import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ODDS DATABASE SCHEMA TEST",
  );

  console.log(
    "==============================================",
  );

  const [
    bookmakerCount,
    snapshotCount,
    marketCount,
    selectionCount,
  ] =
    await Promise.all([
      prisma.bookmaker.count(),

      prisma.oddsSnapshot.count(),

      prisma.oddsMarket.count(),

      prisma.oddsSelection.count(),
    ]);

  console.table({
    Bookmaker:
      bookmakerCount,

    Snapshot:
      snapshotCount,

    Market:
      marketCount,

    Selection:
      selectionCount,
  });

  console.log("");
  console.log(
    "ODDS DATABASE ŞEMASI BAŞARILI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Odds Database testi başarısız.",
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
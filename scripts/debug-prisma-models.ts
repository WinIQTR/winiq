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
    "PRISMA MODEL DEBUG",
  );

  console.log(
    "==============================================",
  );

  console.log("");

  const modelKeys =
    Object.keys(
      prisma,
    )
      .filter(
        (
          key,
        ) =>
          !key.startsWith(
            "$",
          ) &&
          !key.startsWith(
            "_",
          ),
      )
      .sort();

  console.table(
    modelKeys.map(
      (
        key,
      ) => ({
        model:
          key,
      }),
    ),
  );

  console.log("");
  console.log(
    "ODDS MODELLERİ",
  );

  console.table({
    bookmaker:
      "bookmaker" in prisma,

    oddsSnapshot:
      "oddsSnapshot" in prisma,

    oddsMarket:
      "oddsMarket" in prisma,

    oddsSelection:
      "oddsSelection" in prisma,
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Prisma model debug başarısız.",
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
import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  importFixturesFromApiFootball,
} from "@/modules/importer/football/api-football/import-fixtures";

import {
  prisma,
} from "@/lib/prisma";

const DEFAULT_SEASON_YEAR =
  2026;

function getSeasonYear(): number {
  const rawValue =
    process.env
      .API_FOOTBALL_SEASON
      ?.trim();

  if (!rawValue) {
    return DEFAULT_SEASON_YEAR;
  }

  const parsed =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    throw new Error(
      "API_FOOTBALL_SEASON geçerli bir sezon yılı olmalıdır.",
    );
  }

  return parsed;
}

function isDailyLimitError(
  message: string,
): boolean {
  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "request limit for the day",
    ) ||
    normalized.includes(
      "reached the request limit",
    ) ||
    normalized.includes(
      "daily request limit",
    ) ||
    normalized.includes(
      "limit for the day",
    )
  );
}

async function main(): Promise<void> {
  const seasonYear =
    getSeasonYear();

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TARGET COMPETITIONS FIXTURE IMPORT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Sezon: ${seasonYear}`,
  );

  console.log(
    `Organizasyon: ${ACTIVE_COMPETITIONS.length}`,
  );

  const rows: Array<{
    priority: number;
    apiId: number;
    competition: string;

    received: number;
    created: number;
    updated: number;
    skipped: number;

    finished: number;
    scheduled: number;
    live: number;
    postponed: number;
    cancelled: number;

    status:
      | "OK"
      | "HATA"
      | "ATLANDI";

    error:
      string | null;
  }> = [];

  let dailyLimitReached =
    false;

  for (
    let index = 0;
    index <
    ACTIVE_COMPETITIONS.length;
    index += 1
  ) {
    const competition =
      ACTIVE_COMPETITIONS[
        index
      ];

    console.log("");
    console.log(
      "----------------------------------------",
    );

    console.log(
      `[${index + 1}/${ACTIVE_COMPETITIONS.length}] ${competition.name}`,
    );

    console.log(
      `API ID: ${competition.apiId}`,
    );

    if (
      dailyLimitReached
    ) {
      console.log(
        "ATLANDI • Günlük API limiti dolu.",
      );

      rows.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        received:
          0,

        created:
          0,

        updated:
          0,

        skipped:
          0,

        finished:
          0,

        scheduled:
          0,

        live:
          0,

        postponed:
          0,

        cancelled:
          0,

        status:
          "ATLANDI",

        error:
          "API günlük limiti dolu.",
      });

      continue;
    }

    try {
      const result =
        await importFixturesFromApiFootball(
          competition.apiId,
          seasonYear,
        );

      console.log(
        `API fixture: ${result.fixturesReceived}`,
      );

      console.log(
        [
          `Yeni: ${result.fixturesCreated}`,
          `Güncellenen: ${result.fixturesUpdated}`,
          `Atlanan: ${result.fixturesSkipped}`,
        ].join(" • "),
      );

      console.log(
        [
          `Finished: ${result.finishedFixtures}`,
          `Scheduled: ${result.scheduledFixtures}`,
          `Live: ${result.liveFixtures}`,
        ].join(" • "),
      );

      if (result.staleFixturesCancelled > 0) {
        console.log(
          `Takvimden kaldırılan eski fikstür: ${result.staleFixturesCancelled}`,
        );
      }

      rows.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        received:
          result.fixturesReceived,

        created:
          result.fixturesCreated,

        updated:
          result.fixturesUpdated,

        skipped:
          result.fixturesSkipped,

        finished:
          result.finishedFixtures,

        scheduled:
          result.scheduledFixtures,

        live:
          result.liveFixtures,

        postponed:
          result.postponedFixtures,

        cancelled:
          result.cancelledFixtures,

        status:
          "OK",

        error:
          result.skippedReasons.length >
          0
            ? result.skippedReasons
                .slice(
                  0,
                  3,
                )
                .join(" | ")
            : null,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      console.log(
        `HATA • ${message}`,
      );

      if (
        isDailyLimitError(
          message,
        )
      ) {
        dailyLimitReached =
          true;

        console.log("");
        console.log(
          "API-Football günlük limiti doldu.",
        );

        console.log(
          "Sonraki organizasyonlara istek gönderilmeyecek.",
        );
      }

      rows.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        received:
          0,

        created:
          0,

        updated:
          0,

        skipped:
          0,

        finished:
          0,

        scheduled:
          0,

        live:
          0,

        postponed:
          0,

        cancelled:
          0,

        status:
          "HATA",

        error:
          message,
      });
    }
  }

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "FIXTURE IMPORT RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    rows.map(
      (
        row,
      ) => ({
        priority:
          row.priority,

        apiId:
          row.apiId,

        competition:
          row.competition,

        received:
          row.received,

        new:
          row.created,

        updated:
          row.updated,

        skipped:
          row.skipped,

        finished:
          row.finished,

        scheduled:
          row.scheduled,

        status:
          row.status,
      }),
    ),
  );

  console.log("");

  console.table({
    "Toplam organizasyon":
      ACTIVE_COMPETITIONS.length,

    "Başarılı":
      rows.filter(
        (
          row,
        ) =>
          row.status ===
          "OK",
      ).length,

    "Hatalı":
      rows.filter(
        (
          row,
        ) =>
          row.status ===
          "HATA",
      ).length,

    "Atlanan":
      rows.filter(
        (
          row,
        ) =>
          row.status ===
          "ATLANDI",
      ).length,

    "API fixture":
      rows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.received,
        0,
      ),

    "Yeni match":
      rows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.created,
        0,
      ),

    "Güncellenen match":
      rows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.updated,
        0,
      ),

    "Atlanan fixture":
      rows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.skipped,
        0,
      ),

    "API limiti":
      dailyLimitReached
        ? "DOLDU"
        : "OK",
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Target fixture import başarısız.",
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

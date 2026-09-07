import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  importLeagueFromApiFootball,
} from "@/modules/importer/football/api-football/import-league";

import {
  importTeamsFromApiFootball,
} from "@/modules/importer/football/api-football/import-teams";

const DEFAULT_SEASON_YEAR =
  2024;

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

type CompetitionBootstrapRow = {
  priority: number;

  apiId: number;

  competition: string;

  league:
    | "OK"
    | "HATA"
    | "ATLANDI";

  season:
    | "OK"
    | "YOK"
    | "ATLANDI";

  teams: number;

  createdTeams: number;

  updatedTeams: number;

  error: string | null;
};

async function main(): Promise<void> {
  const seasonYear =
    getSeasonYear();

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TARGET COMPETITIONS BOOTSTRAP",
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

  console.log("");

  const results:
    CompetitionBootstrapRow[] =
      [];

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
        "ATLANDI • Günlük API limiti daha önce doldu.",
      );

      results.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        league:
          "ATLANDI",

        season:
          "ATLANDI",

        teams:
          0,

        createdTeams:
          0,

        updatedTeams:
          0,

        error:
          "API günlük limiti dolu.",
      });

      continue;
    }

    try {
      /*
       * 1. COUNTRY + LEAGUE + SEASONS
       *
       * Upsert kullandığı için daha önce
       * eklenmiş kayıtlar güvenli şekilde
       * güncellenir.
       */
      const leagueResult =
        await importLeagueFromApiFootball(
          competition.apiId,
        );

      console.log(
        `League OK • ${leagueResult.league.name}`,
      );

      console.log(
        `API sezon sayısı • ${leagueResult.seasonsImported}`,
      );

      /*
       * 2. İstediğimiz sezon API tarafından
       * gerçekten destekleniyor mu?
       */
      const season =
        await prisma.season.findFirst({
          where: {
            year:
              seasonYear,

            league: {
              apiId:
                competition.apiId,
            },
          },

          select: {
            id:
              true,

            year:
              true,

            isCurrent:
              true,
          },
        });

      if (!season) {
        console.log(
          `SEASON YOK • ${seasonYear}`,
        );

        results.push({
          priority:
            competition.priority,

          apiId:
            competition.apiId,

          competition:
            competition.name,

          league:
            "OK",

          season:
            "YOK",

          teams:
            0,

          createdTeams:
            0,

          updatedTeams:
            0,

          error:
            `${seasonYear} sezonu API tarafından dönmedi.`,
        });

        continue;
      }

      console.log(
        `Season OK • ${season.year}`,
      );

      /*
       * 3. TEAMS
       */
      const teamsResult =
        await importTeamsFromApiFootball(
          competition.apiId,
          seasonYear,
        );

      console.log(
        [
          "Teams OK",
          `• toplam ${teamsResult.teamsReceived}`,
          `• yeni ${teamsResult.teamsCreated}`,
          `• güncellenen ${teamsResult.teamsUpdated}`,
        ].join(" "),
      );

      results.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        league:
          "OK",

        season:
          "OK",

        teams:
          teamsResult.teamsReceived,

        createdTeams:
          teamsResult.teamsCreated,

        updatedTeams:
          teamsResult.teamsUpdated,

        error:
          null,
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
          "Sonraki organizasyonlara API isteği gönderilmeyecek.",
        );
      }

      results.push({
        priority:
          competition.priority,

        apiId:
          competition.apiId,

        competition:
          competition.name,

        league:
          "HATA",

        season:
          "ATLANDI",

        teams:
          0,

        createdTeams:
          0,

        updatedTeams:
          0,

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
    "BOOTSTRAP RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results.map(
      (
        result,
      ) => ({
        priority:
          result.priority,

        apiId:
          result.apiId,

        competition:
          result.competition,

        league:
          result.league,

        season:
          result.season,

        teams:
          result.teams,

        new:
          result.createdTeams,

        updated:
          result.updatedTeams,

        error:
          result.error,
      }),
    ),
  );

  const completeCount =
    results.filter(
      (
        result,
      ) =>
        result.league ===
          "OK" &&
        result.season ===
          "OK" &&
        result.teams >
          0,
    ).length;

  const seasonMissingCount =
    results.filter(
      (
        result,
      ) =>
        result.season ===
        "YOK",
    ).length;

  const errorCount =
    results.filter(
      (
        result,
      ) =>
        result.league ===
        "HATA",
    ).length;

  console.log("");

  console.table({
    "Toplam organizasyon":
      ACTIVE_COMPETITIONS.length,

    "Tam hazır":
      completeCount,

    "Sezon bulunamadı":
      seasonMissingCount,

    "Hatalı":
      errorCount,

    "API limiti doldu":
      dailyLimitReached
        ? "EVET"
        : "HAYIR",
  });

  console.log("");

  if (
    completeCount ===
    ACTIVE_COMPETITIONS.length
  ) {
    console.log(
      "Tüm V1 organizasyonları League + Season + Teams aşaması için hazır.",
    );
  } else {
    console.log(
      "Hazır olmayan organizasyonlar yukarıdaki tabloda görülebilir.",
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Competition bootstrap başarısız.",
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
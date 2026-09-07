import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  importPlayersFromApiFootball,
} from "@/modules/importer/football/api-football/import-players";

const LEAGUE_API_ID =
  39;

const SEASON_YEAR =
  ACTIVE_SEASON_YEAR;

async function main(): Promise<void> {
  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "PLAYER IMPORT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Lig: Premier League (${LEAGUE_API_ID})`,
  );

  console.log(
    `Sezon: ${SEASON_YEAR}`,
  );

  console.log("");

  console.log(
    "Takım bazlı oyuncu importu başlatılıyor...",
  );

  console.log("");

  const result =
    await importPlayersFromApiFootball(
      LEAGUE_API_ID,
      SEASON_YEAR,
    );

  console.log(
    "========================================",
  );

  console.log(
    "IMPORT TAMAMLANDI",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    Lig:
      result.league.name,

    Sezon:
      result.season,

    "İşlenen takım":
      result.teamsProcessed,

    "API çağrısı":
      result.apiRequests,

    "API oyuncu satırı":
      result.playerRowsReceived,

    "Benzersiz oyuncu":
      result.uniquePlayers,

    "Yeni oyuncu":
      result.playersCreated,

    "Güncellenen oyuncu":
      result.playersUpdated,

    "Yeni istatistik":
      result.statisticsCreated,

    "Güncellenen istatistik":
      result.statisticsUpdated,

    "Atlanan istatistik":
      result.skippedStatistics,
  });

  if (
    result
      .teamsReachedPageLimit
      .length > 0
  ) {
    console.log("");

    console.log(
      "UYARI — 3 SAYFA SINIRINA ULAŞAN TAKIMLAR",
    );

    console.table(
      result
        .teamsReachedPageLimit
        .map(
          (team) => ({
            takım:
              team,
          }),
        ),
    );
  }

  console.log("");

  console.log(
    "Oyuncu import işlemi tamamlandı.",
  );
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error("");

    console.error(
      "Oyuncu importu başarısız.",
    );

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode = 1;
  },
);
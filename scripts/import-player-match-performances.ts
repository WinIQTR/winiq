import "dotenv/config";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  importPlayerMatchPerformances,
} from "@/modules/importer/football/api-football/import-player-match-performances";

const LEAGUE_API_ID =
  39;

const LEAGUE_NAME =
  "Premier League";

const SEASON_YEAR =
  ACTIVE_SEASON_YEAR;

/*
 * API kullanımını kontrollü tutmak için
 * her çalıştırmada sınırlı sayıda maç işlenir.
 *
 * Ücretli planda bu değer daha sonra
 * 20, 50 veya 100 yapılabilir.
 */
const MAXIMUM_MATCHES =
  10;

const REQUEST_DELAY_MS =
  2000;

async function main(): Promise<void> {
  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "PLAYER MATCH PERFORMANCE IMPORT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Lig: ${LEAGUE_NAME} (${LEAGUE_API_ID})`,
  );

  console.log(
    `Sezon: ${SEASON_YEAR}`,
  );

  console.log(
    `Bu çalıştırmada maksimum maç: ${MAXIMUM_MATCHES}`,
  );

  console.log("");

  const result =
    await importPlayerMatchPerformances({
      leagueApiId:
        LEAGUE_API_ID,

      seasonYear:
        SEASON_YEAR,

      maximumMatches:
        MAXIMUM_MATCHES,

      requestDelayMs:
        REQUEST_DELAY_MS,
    });

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "IMPORT RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "İşlenen maç":
      result.matchesProcessed,

    "Atlanan maç":
      result.matchesSkipped,

    "API oyuncu":
      result.playersReceived,

    "Kaydedilen performans":
      result.performancesSaved,

    "DB'de bulunamayan oyuncu":
      result.playersNotFound,

    "API isteği":
      result.apiRequests,

    "Kalan maç":
      result.remainingMatches,
  });

  console.log("");

  if (
    result.remainingMatches >
    0
  ) {
    console.log(
      `${result.remainingMatches} maç için performans verisi henüz alınmadı.`,
    );

    console.log(
      "Script daha sonra tekrar çalıştırılabilir.",
    );
  } else {
    console.log(
      `Tüm mevcut bitmiş ${LEAGUE_NAME} ${SEASON_YEAR} maçlarının oyuncu performans verileri işlendi.`,
    );
  }
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error("");

    console.error(
      "Player match performance import başarısız.",
    );

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    process.exitCode =
      1;
  },
);
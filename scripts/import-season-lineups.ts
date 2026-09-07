import "dotenv/config";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  importMatchLineupsFromApiFootball,
} from "@/modules/importer/football/api-football/import-lineups";

const LEAGUE_API_ID =
  39;

const LEAGUE_NAME =
  "Premier League";

const SEASON_YEAR =
  ACTIVE_SEASON_YEAR;

/*
 * API limitini kontrollü tutmak için
 * her çalıştırmada küçük paketlerle ilerliyoruz.
 *
 * Ücretli planla daha sonra 50 veya 100
 * maçlık paketlere çıkarabiliriz.
 */
const MAXIMUM_MATCHES =
  20;

const REQUEST_DELAY_MS =
  2000;

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function main(): Promise<void> {
  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "SEASON LINEUP IMPORT",
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

  /*
   * Seçili sezon ve ligdeki bitmiş maçları
   * en eskiden yeniye doğru alıyoruz.
   *
   * Lineup bilgisi genellikle yalnızca
   * oynanmış veya başlamak üzere olan
   * maçlarda bulunur.
   */
  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            SEASON_YEAR,

          league: {
            apiId:
              LEAGUE_API_ID,
          },
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        homeTeamId:
          true,

        awayTeamId:
          true,

        homeTeam: {
          select: {
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },

        lineups: {
          where: {
            status:
              "CONFIRMED",
          },

          select: {
            teamId:
              true,

            players: {
              select: {
                starter:
                  true,
              },
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  /*
   * Bir maçın lineup verisini tamamlanmış
   * kabul etmek için:
   *
   * - Ev sahibi confirmed lineup olmalı
   * - Deplasman confirmed lineup olmalı
   * - Her iki takımda da 11 starter olmalı
   */
  const pendingMatches =
    matches.filter(
      (
        match,
      ) => {
        const homeLineup =
          match.lineups.find(
            (
              lineup,
            ) =>
              lineup.teamId ===
              match.homeTeamId,
          );

        const awayLineup =
          match.lineups.find(
            (
              lineup,
            ) =>
              lineup.teamId ===
              match.awayTeamId,
          );

        const homeStarterCount =
          homeLineup
            ?.players
            .filter(
              (
                player,
              ) =>
                player.starter,
            )
            .length ??
          0;

        const awayStarterCount =
          awayLineup
            ?.players
            .filter(
              (
                player,
              ) =>
                player.starter,
            )
            .length ??
          0;

        return !(
          homeLineup &&
          awayLineup &&
          homeStarterCount ===
            11 &&
          awayStarterCount ===
            11
        );
      },
    );

  const selectedMatches =
    pendingMatches.slice(
      0,
      MAXIMUM_MATCHES,
    );

  console.log(
    `Toplam bitmiş sezon maçı: ${matches.length}`,
  );

  console.log(
    `Lineup eksik maç: ${pendingMatches.length}`,
  );

  console.log(
    `Bu tur işlenecek: ${selectedMatches.length}`,
  );

  console.log("");

  if (
    selectedMatches.length ===
    0
  ) {
    if (
      matches.length ===
      0
    ) {
      console.log(
        `${LEAGUE_NAME} ${SEASON_YEAR} sezonunda henüz bitmiş maç bulunamadı.`,
      );

      console.log(
        "Bu durum sezon başlamadıysa normaldir.",
      );

      console.log(
        "Lineup importu, bitmiş maçlar oluştukça tekrar çalıştırılabilir.",
      );
    } else {
      console.log(
        "Lineup verisi eksik maç bulunmadı.",
      );

      console.log(
        `${LEAGUE_NAME} ${SEASON_YEAR} lineup coverage tamamlanmış görünüyor.`,
      );
    }

    return;
  }

  let processedMatches =
    0;

  let successfulMatches =
    0;

  let failedMatches =
    0;

  let incompleteMatches =
    0;

  let totalLineups =
    0;

  let totalPlayers =
    0;

  let totalStarters =
    0;

  let totalSubstitutes =
    0;

  let playersCreated =
    0;

  let playersUpdated =
    0;

  let apiRequests =
    0;

  for (
    let index = 0;
    index <
    selectedMatches.length;
    index += 1
  ) {
    const match =
      selectedMatches[
        index
      ];

    processedMatches +=
      1;

    console.log(
      `[${index + 1}/${selectedMatches.length}] ${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    try {
      const result =
        await importMatchLineupsFromApiFootball(
          match.id,
        );

      apiRequests +=
        1;

      totalLineups +=
        result.lineupsSaved;

      totalPlayers +=
        result.playersSaved;

      totalStarters +=
        result.startersSaved;

      totalSubstitutes +=
        result.substitutesSaved;

      playersCreated +=
        result.playersCreated;

      playersUpdated +=
        result.playersUpdated;

      /*
       * Eksiksiz bir maç için API'den:
       *
       * - 2 takım
       * - 2 lineup
       * - 22 starter
       *
       * bekliyoruz.
       */
      if (
        result.teamsReceived ===
          2 &&
        result.lineupsSaved ===
          2 &&
        result.startersSaved ===
          22
      ) {
        successfulMatches +=
          1;

        console.log(
          `  OK • ${result.startersSaved} ilk 11 • ${result.substitutesSaved} yedek`,
        );
      } else {
        incompleteMatches +=
          1;

        console.log(
          [
            "  EKSİK",
            `API takım=${result.teamsReceived}`,
            `lineup=${result.lineupsSaved}`,
            `starter=${result.startersSaved}`,
          ].join(
            " • ",
          ),
        );
      }
    } catch (
      error: unknown
    ) {
      failedMatches +=
        1;

      /*
       * Hata alınsa bile API isteği gönderilmiş
       * olabileceği için request sayısına ekliyoruz.
       */
      apiRequests +=
        1;

      console.error(
        "  HATA:",

        error instanceof Error
          ? error.message
          : error,
      );
    }

    /*
     * Son maçtan sonra beklemeye gerek yok.
     */
    if (
      index <
      selectedMatches.length -
        1
    ) {
      await sleep(
        REQUEST_DELAY_MS,
      );
    }
  }

  /*
   * İşlem sonrasında gerçek veritabanı
   * lineup coverage durumunu yeniden hesaplıyoruz.
   */
  const finishedLineups =
    await prisma.lineup.findMany({
      where: {
        status:
          "CONFIRMED",

        match: {
          status:
            "FINISHED",

          season: {
            year:
              SEASON_YEAR,

            league: {
              apiId:
                LEAGUE_API_ID,
            },
          },
        },
      },

      select: {
        matchId:
          true,

        teamId:
          true,

        players: {
          select: {
            starter:
              true,
          },
        },
      },
    });

  const completeMatchIds =
    new Set<number>();

  const lineupsByMatch =
    new Map<
      number,
      typeof finishedLineups
    >();

  for (
    const lineup
    of finishedLineups
  ) {
    const current =
      lineupsByMatch.get(
        lineup.matchId,
      ) ??
      [];

    current.push(
      lineup,
    );

    lineupsByMatch.set(
      lineup.matchId,
      current,
    );
  }

  for (
    const [
      matchId,
      lineups,
    ]
    of lineupsByMatch
  ) {
    if (
      lineups.length !==
      2
    ) {
      continue;
    }

    const complete =
      lineups.every(
        (
          lineup,
        ) =>
          lineup.players.filter(
            (
              player,
            ) =>
              player.starter,
          ).length ===
          11,
      );

    if (
      complete
    ) {
      completeMatchIds.add(
        matchId,
      );
    }
  }

  const remainingMatches =
    Math.max(
      matches.length -
        completeMatchIds.size,
      0,
    );

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
      processedMatches,

    "Başarılı maç":
      successfulMatches,

    "Eksik lineup":
      incompleteMatches,

    "Hatalı maç":
      failedMatches,

    "Lineup kayıt":
      totalLineups,

    "Oyuncu kayıt":
      totalPlayers,

    "İlk 11":
      totalStarters,

    Yedek:
      totalSubstitutes,

    "Yeni oyuncu":
      playersCreated,

    "Güncellenen oyuncu":
      playersUpdated,

    "API isteği":
      apiRequests,

    "Tam lineup maç":
      completeMatchIds.size,

    "Kalan maç":
      remainingMatches,
  });

  console.log("");

  if (
    remainingMatches >
    0
  ) {
    console.log(
      `${remainingMatches} maç için lineup verisi henüz tamamlanmadı.`,
    );

    console.log(
      "Script daha sonra tekrar çalıştırılabilir.",
    );
  } else {
    console.log(
      `${LEAGUE_NAME} ${SEASON_YEAR} lineup coverage tamamlandı.`,
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
        "Season lineup import başarısız.",
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
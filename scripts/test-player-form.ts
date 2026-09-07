import {
  prisma,
} from "@/lib/prisma";

import {
  calculatePlayerForm,
} from "@/modules/player-form-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "PLAYER FORM ENGINE TEST",
  );

  console.log(
    "========================================",
  );

  /*
   * Önce tüm oyuncuların ratingli maç
   * sayılarını hesaplıyoruz.
   */
  const groups =
    await prisma.playerMatchPerformance.groupBy({
      by: [
        "playerId",
      ],

      where: {
        rating: {
          not: null,
        },
      },

      _count: {
        playerId: true,
      },

      orderBy: {
        _count: {
          playerId:
            "desc",
        },
      },

      take: 15,
    });

  if (
    groups.length === 0
  ) {
    console.log(
      "Ratingli oyuncu performansı bulunamadı.",
    );

    return;
  }

  const playerIds =
    groups.map(
      (group) =>
        group.playerId,
    );

  const players =
    await prisma.player.findMany({
      where: {
        id: {
          in:
            playerIds,
        },
      },

      select: {
        id: true,
        name: true,
        position: true,

        team: {
          select: {
            name: true,
          },
        },
      },
    });

  const playerById =
    new Map(
      players.map(
        (player) => [
          player.id,
          player,
        ],
      ),
    );

  console.log("");
  console.log(
    "EN FAZLA RATINGLI MAÇA SAHİP OYUNCULAR",
  );

  console.log("");

  console.table(
    groups.map(
      (
        group,
        index,
      ) => {
        const player =
          playerById.get(
            group.playerId,
          );

        return {
          sıra:
            index + 1,

          oyuncu:
            player?.name ??
            `ID ${group.playerId}`,

          takım:
            player?.team?.name ??
            "—",

          pozisyon:
            player?.position ??
            "—",

          "ratingli maç":
            group._count
              .playerId,
        };
      },
    ),
  );

  /*
   * Öncelik:
   *
   * 1) 5+ ratingli maç
   * 2) 3+ ratingli maç
   * 3) en fazla ratingli maçı olan oyuncu
   */
  const selected =
    groups.find(
      (group) =>
        group._count
          .playerId >= 5,
    ) ??
    groups.find(
      (group) =>
        group._count
          .playerId >= 3,
    ) ??
    groups[0];

  const selectedPlayer =
    playerById.get(
      selected.playerId,
    );

  console.log("");
  console.log(
    "TEST İÇİN SEÇİLEN OYUNCU",
  );

  console.table({
    Oyuncu:
      selectedPlayer?.name ??
      selected.playerId,

    Takım:
      selectedPlayer?.team
        ?.name ??
      "—",

    "Ratingli maç":
      selected._count
        .playerId,
  });

  /*
   * Seçilen oyuncunun en son ratingli
   * performansını buluyoruz.
   */
  const latestPerformance =
    await prisma.playerMatchPerformance.findFirst({
      where: {
        playerId:
          selected.playerId,

        rating: {
          not: null,
        },
      },

      select: {
        match: {
          select: {
            kickoffAt: true,
          },
        },
      },

      orderBy: {
        match: {
          kickoffAt:
            "desc",
        },
      },
    });

  if (!latestPerformance) {
    console.log(
      "Oyuncunun ratingli performansı bulunamadı.",
    );

    return;
  }

  /*
   * En son performansın bir gün sonrasını
   * referans alıyoruz.
   *
   * Böylece eldeki tüm geçmiş performanslar
   * form hesabına dahil oluyor.
   */
  const beforeDate =
    new Date(
      latestPerformance.match
        .kickoffAt.getTime() +
        24 *
          60 *
          60 *
          1000,
    );

  const form =
    await calculatePlayerForm({
      playerId:
        selected.playerId,

      beforeDate,
    });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "OYUNCU FORM SONUCU",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    Oyuncu:
      form.player.name,

    Takım:
      form.player.teamName ??
      "—",

    Pozisyon:
      form.player.position,

    "Ratingli maç":
      form.samples
        .totalRatedMatches,

    "Son maç":
      form.samples.last1,

    "Son 3":
      form.samples.last3,

    "Son 5":
      form.samples.last5,

    "Son 10":
      form.samples.last10,

    "Önceki 3":
      form.samples.previous3,

    "Ağırlıklı rating":
      form.samples
        .weightedRecentRating,

    "Form skoru":
      form.formScore,

    Trend:
      form.trend.type,

    Değişim:
      form.trend.change,

    "Veri kalitesi":
      `${form.dataQualityScore}/100`,

    "Son 5 dakika":
      form.production
        .last5Minutes,

    "Son 5 ilk 11":
      form.production
        .last5Starts,

    "Son 5 gol":
      form.production
        .last5Goals,

    "Son 5 asist":
      form.production
        .last5Assists,
  });

  console.log("");
  console.log(
    "SON MAÇLAR",
  );

  console.log("");

  console.table(
    form.recentMatches.map(
      (
        match,
        index,
      ) => ({
        sıra:
          index + 1,

        tarih:
          match.kickoffAt
            .toISOString()
            .slice(
              0,
              10,
            ),

        rakip:
          match.opponent,

        saha:
          match.homeAway,

        rating:
          match.rating,

        dakika:
          match.minutes,

        ilk11:
          match.starter
            ? "EVET"
            : "HAYIR",

        gol:
          match.goals,

        asist:
          match.assists,
      }),
    ),
  );

  console.log("");
  console.log(
    "FORM YORUMU",
  );

  console.log("");

  console.log(
    form.trend.description,
  );

  if (
    form.warnings.length > 0
  ) {
    console.log("");
    console.log(
      "UYARILAR",
    );

    console.log("");

    console.table(
      form.warnings.map(
        (warning) => ({
          uyarı:
            warning,
        }),
      ),
    );
  }
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
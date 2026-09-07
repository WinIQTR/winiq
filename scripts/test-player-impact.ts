import {
  prisma,
} from "@/lib/prisma";

import {
  calculatePlayerImpact,
} from "@/modules/player-impact-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "PLAYER IMPACT ENGINE TEST",
  );

  console.log(
    "========================================",
  );

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

      take: 20,
    });

  if (
    groups.length === 0
  ) {
    console.log(
      "Oyuncu performansı bulunamadı.",
    );

    return;
  }

  const selected =
    groups[0];

  const player =
    await prisma.player.findUnique({
      where: {
        id:
          selected.playerId,
      },

      select: {
        id: true,
        name: true,
        teamId: true,

        team: {
          select: {
            name: true,
          },
        },
      },
    });

  if (
    !player ||
    !player.teamId
  ) {
    console.log(
      "Oyuncu veya takım bilgisi bulunamadı.",
    );

    return;
  }

  const season =
    await prisma.season.findFirst({
      where: {
        year:
          2024,

        league: {
          apiId:
            39,
        },
      },

      select: {
        id: true,
      },
    });

  if (!season) {
    console.log(
      "2024 sezonu bulunamadı.",
    );

    return;
  }

  const latestPerformance =
    await prisma.playerMatchPerformance.findFirst({
      where: {
        playerId:
          player.id,

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
    return;
  }

  const beforeDate =
    new Date(
      latestPerformance.match
        .kickoffAt.getTime() +
        24 *
          60 *
          60 *
          1000,
    );

  const impact =
    await calculatePlayerImpact({
      playerId:
        player.id,

      seasonId:
        season.id,

      teamId:
        player.teamId,

      beforeDate,
    });

  console.log("");
  console.log(
    "OYUNCU",
  );

  console.table({
    Oyuncu:
      impact.player.name,

    Takım:
      impact.player.teamName ??
      "—",

    Pozisyon:
      impact.player.position,

    "Veri kalitesi":
      `${impact.dataQualityScore}/100`,
  });

  console.log("");
  console.log(
    "IMPACT SCORES",
  );

  console.table({
    Form:
      impact.scores.form,

    Quality:
      impact.scores.quality,

    Fitness:
      impact.scores.fitness,

    Importance:
      impact.scores.importance,

    "Tactical Fit":
      impact.scores.tacticalFit,

    "Market Value":
      impact.scores.marketValue,

    OVERALL:
      impact.scores.overall,
  });

  console.log("");
  console.log(
    "KAYNAK VERİLER",
  );

  console.table({
    "Recent Rating":
      impact.components
        .recentRating,

    "Season Rating":
      impact.components
        .seasonRating,

    Maç:
      impact.components
        .appearances,

    "İlk 11":
      impact.components
        .starts,

    Dakika:
      impact.components
        .minutes,

    Gol:
      impact.components
        .goals,

    Asist:
      impact.components
        .assists,

    "Market Value":
      impact.components
        .marketValue,
  });

  if (
    impact.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "UYARILAR",
    );

    console.table(
      impact.warnings.map(
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
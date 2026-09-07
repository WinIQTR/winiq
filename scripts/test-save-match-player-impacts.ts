import {
  prisma,
} from "@/lib/prisma";

import {
  PLAYER_IMPACT_MODEL_VERSION,
  saveMatchPlayerImpacts,
} from "@/modules/player-impact-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MATCH PLAYER IMPACT SAVE TEST",
  );

  console.log(
    "========================================",
  );

  /*
   * Confirmed lineup bulunan ve mümkün
   * olduğunca ileri tarihli Premier League
   * 2024 maçını test ediyoruz.
   */
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            2024,

          league: {
            apiId:
              39,
          },
        },

        lineups: {
          some: {
            status:
              "CONFIRMED",

            isConfirmed:
              true,
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },
    });

  if (!match) {
    console.log(
      "Confirmed lineup bulunan maç bulunamadı.",
    );

    return;
  }

  console.log("");

  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  console.log("");

  const result =
    await saveMatchPlayerImpacts(
      match.id,
    );

  console.log(
    "KAYIT SONUCU",
  );

  console.log("");

  console.table({
    Maç:
      `${result.homeTeam} - ${result.awayTeam}`,

    "Lineup modu":
      result.lineupMode,

    "Bulunan oyuncu":
      result.playersFound,

    "Kaydedilen impact":
      result.impactsSaved,

    "Atlanan oyuncu":
      result.skippedPlayers,

    "Ev toplam":
      result.homeImpacts,

    "Ev ilk 11":
      result.homeStarters,

    "Ev yedek":
      result.homeBench,

    "Dep toplam":
      result.awayImpacts,

    "Dep ilk 11":
      result.awayStarters,

    "Dep yedek":
      result.awayBench,
  });

  /*
   * Aynı maç için kaydedilen PlayerImpactScore
   * kayıtlarını okuyup kalite puanını da
   * kontrol ediyoruz.
   */
  const impacts =
    await prisma.playerImpactScore.findMany({
      where: {
        matchId:
          match.id,

        modelVersion:
          PLAYER_IMPACT_MODEL_VERSION,

        teamId: {
          in: [
            match.homeTeamId,
            match.awayTeamId,
          ],
        },
      },

      select: {
        playerId: true,
        teamId: true,

        formScore: true,
        qualityScore: true,
        fitnessScore: true,
        importanceScore: true,

        overallImpactScore: true,

        dataQualityScore: true,

        calculatedAt: true,

        player: {
          select: {
            name: true,
            position: true,
          },
        },

        team: {
          select: {
            name: true,
          },
        },
      },

      orderBy: [
        {
          teamId:
            "asc",
        },

        {
          overallImpactScore:
            "desc",
        },
      ],
    });

  console.log("");
  console.log(
    "PLAYER IMPACT SCORES",
  );
  console.log("");

  console.table(
    impacts.map(
      (impact) => ({
        oyuncu:
          impact.player.name,

        takım:
          impact.team.name,

        pozisyon:
          impact.player.position,

        form:
          impact.formScore,

        kalite:
          impact.qualityScore,

        fitness:
          impact.fitnessScore,

        önem:
          impact.importanceScore,

        impact:
          impact.overallImpactScore,

        "veri kalitesi":
          impact.dataQualityScore,

        hesaplama:
          impact.calculatedAt
            .toISOString(),
      }),
    ),
  );

  /*
   * Takım bazında ortalama veri kalitesini
   * ayrıca gösteriyoruz.
   */
  const homeImpacts =
    impacts.filter(
      (impact) =>
        impact.teamId ===
        match.homeTeamId,
    );

  const awayImpacts =
    impacts.filter(
      (impact) =>
        impact.teamId ===
        match.awayTeamId,
    );

  const averageQuality = (
    values:
      typeof impacts,
  ): number => {
    if (
      values.length === 0
    ) {
      return 0;
    }

    return Math.round(
      (
        values.reduce(
          (
            total,
            impact,
          ) =>
            total +
            impact.dataQualityScore,
          0,
        ) /
        values.length
      ) *
        100,
    ) / 100;
  };

  console.log("");
  console.log(
    "DATA QUALITY SUMMARY",
  );
  console.log("");

  console.table([
    {
      takım:
        match.homeTeam.name,

      oyuncu:
        homeImpacts.length,

      "ortalama kalite":
        averageQuality(
          homeImpacts,
        ),
    },

    {
      takım:
        match.awayTeam.name,

      oyuncu:
        awayImpacts.length,

      "ortalama kalite":
        averageQuality(
          awayImpacts,
        ),
    },
  ]);
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
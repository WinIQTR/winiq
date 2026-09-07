import {
  prisma,
} from "@/lib/prisma";

import {
  saveSquadStrength,
} from "@/modules/squad-strength-engine";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "SQUAD STRENGTH ENGINE TEST",
  );

  console.log(
    "========================================",
  );

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
      "Test için uygun maç bulunamadı.",
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

  const [
    home,
    away,
  ] =
    await Promise.all([
      saveSquadStrength({
        matchId:
          match.id,

        teamId:
          match.homeTeamId,
      }),

      saveSquadStrength({
        matchId:
          match.id,

        teamId:
          match.awayTeamId,
      }),
    ]);

  console.log(
    "TAKIM GÜÇ KARŞILAŞTIRMASI",
  );

  console.log("");

  console.table([
    {
      Takım:
        home.strength.team.name,

      "İlk 11":
        home.strength.scores
          .startingEleven,

      Bench:
        home.strength.scores
          .bench,

      Kaleci:
        home.strength.scores
          .goalkeeper,

      Defans:
        home.strength.scores
          .defence,

      "Orta Saha":
        home.strength.scores
          .midfield,

      Hücum:
        home.strength.scores
          .attack,

      Derinlik:
        home.strength.scores
          .squadDepth,

      Overall:
        home.strength.scores
          .overallSquad,

      Güven:
        home.strength
          .dataQualityScore,
    },

    {
      Takım:
        away.strength.team.name,

      "İlk 11":
        away.strength.scores
          .startingEleven,

      Bench:
        away.strength.scores
          .bench,

      Kaleci:
        away.strength.scores
          .goalkeeper,

      Defans:
        away.strength.scores
          .defence,

      "Orta Saha":
        away.strength.scores
          .midfield,

      Hücum:
        away.strength.scores
          .attack,

      Derinlik:
        away.strength.scores
          .squadDepth,

      Overall:
        away.strength.scores
          .overallSquad,

      Güven:
        away.strength
          .dataQualityScore,
    },
  ]);

  console.log("");

  const difference =
    Math.round(
      (
        home.strength.scores
          .overallSquad -
        away.strength.scores
          .overallSquad
      ) *
        100,
    ) /
    100;

  console.log(
    `Squad Strength farkı: ${difference > 0 ? "+" : ""}${difference}`,
  );

  console.log("");

  if (
    home.strength.warnings.length >
      0 ||
    away.strength.warnings.length >
      0
  ) {
    console.log(
      "UYARILAR",
    );

    console.table([
      ...home.strength.warnings.map(
        (warning) => ({
          takım:
            home.strength.team.name,

          uyarı:
            warning,
        }),
      ),

      ...away.strength.warnings.map(
        (warning) => ({
          takım:
            away.strength.team.name,

          uyarı:
            warning,
        }),
      ),
    ]);
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
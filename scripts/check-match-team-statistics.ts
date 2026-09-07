import {
  prisma,
} from "@/lib/prisma";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "MATCH TEAM STATISTICS CHECK",
  );
  console.log(
    "========================================",
  );

  const rows =
    await prisma.matchTeamStatistic.findMany({
      select: {
        matchId: true,
        teamId: true,

        expectedGoals: true,
        expectedGoalsAgainst: true,

        shots: true,
        shotsOnTarget: true,
        possession: true,
        corners: true,
        fouls: true,
        offsides: true,
        yellowCards: true,
        redCards: true,

        source: true,

        match: {
          select: {
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
        },

        team: {
          select: {
            name: true,
          },
        },
      },

      orderBy: [
        {
          match: {
            kickoffAt:
              "asc",
          },
        },

        {
          teamId:
            "asc",
        },
      ],
    });

  const total =
    rows.length;

  const withExpectedGoals =
    rows.filter(
      (row) =>
        row.expectedGoals !==
        null,
    ).length;

  const withShots =
    rows.filter(
      (row) =>
        row.shots !==
        null,
    ).length;

  const withShotsOnTarget =
    rows.filter(
      (row) =>
        row.shotsOnTarget !==
        null,
    ).length;

  const withPossession =
    rows.filter(
      (row) =>
        row.possession !==
        null,
    ).length;

  const withCorners =
    rows.filter(
      (row) =>
        row.corners !==
        null,
    ).length;

  console.log("");
  console.log(
    "COVERAGE",
  );

  console.table({
    "Toplam takım-maç kaydı":
      total,

    "xG mevcut":
      withExpectedGoals,

    "Shots mevcut":
      withShots,

    "Shots on target mevcut":
      withShotsOnTarget,

    "Possession mevcut":
      withPossession,

    "Corners mevcut":
      withCorners,
  });

  console.log("");
  console.log(
    "İLK KAYITLAR",
  );

  console.table(
    rows
      .slice(
        0,
        20,
      )
      .map(
        (row) => ({
          tarih:
            row.match.kickoffAt
              .toISOString()
              .slice(
                0,
                10,
              ),

          maç:
            `${row.match.homeTeam.name} - ${row.match.awayTeam.name}`,

          takım:
            row.team.name,

          xG:
            row.expectedGoals,

          xGA:
            row.expectedGoalsAgainst,

          şut:
            row.shots,

          isabetli:
            row.shotsOnTarget,

          possession:
            row.possession,

          korner:
            row.corners,

          faul:
            row.fouls,

          ofsayt:
            row.offsides,

          sarı:
            row.yellowCards,

          kırmızı:
            row.redCards,

          kaynak:
            row.source,
        }),
      ),
  );
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

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
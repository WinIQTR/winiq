import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "HISTORICAL DATA COVERAGE AUDIT",
  );
  console.log(
    "========================================",
  );

  const matches =
    await prisma.match.findMany({
      where: {
        season: {
          year: 2024,

          league: {
            apiId: 39,
          },
        },
      },

      select: {
        id: true,
        kickoffAt: true,

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

        playerPerformances: {
          select: {
            id: true,
          },
        },

        lineups: {
          where: {
            status: "CONFIRMED",
          },

          select: {
            teamId: true,

            players: {
              select: {
                starter: true,
              },
            },
          },
        },

        playerImpactScores: {
          select: {
            id: true,
          },
        },

        featureValues: {
          select: {
            feature: {
              select: {
                key: true,
              },
            },
          },
        },
      },

      orderBy: {
        kickoffAt: "asc",
      },
    });

  let performanceReady = 0;
  let lineupReady = 0;
  let impactReady = 0;
  let squadFeatureReady = 0;
  let fullyReady = 0;

  const rows =
    matches.map(
      (match) => {
        const performanceCount =
          match.playerPerformances.length;

        const confirmedLineups =
          match.lineups;

        const starterCount =
          confirmedLineups.reduce(
            (
              total,
              lineup,
            ) =>
              total +
              lineup.players.filter(
                (player) =>
                  player.starter,
              ).length,
            0,
          );

        const lineupPlayerCount =
          confirmedLineups.reduce(
            (
              total,
              lineup,
            ) =>
              total +
              lineup.players.length,
            0,
          );

        const hasPerformance =
          performanceCount > 0;

        const hasCompleteLineup =
          confirmedLineups.length ===
            2 &&
          starterCount === 22;

        const impactCount =
          match.playerImpactScores.length;

        const hasImpact =
          impactCount > 0;

        const squadFeatureKeys =
          new Set(
            match.featureValues
              .map(
                (value) =>
                  value.feature.key,
              )
              .filter(
                (key) =>
                  [
                    "squad_strength",
                    "starting_eleven_strength",
                    "bench_strength",
                    "goalkeeper_strength",
                    "defence_strength",
                    "midfield_strength",
                    "attack_strength",
                    "squad_depth",
                    "lineup_certainty",
                  ].includes(key),
              ),
          );

        const hasSquadFeatures =
          squadFeatureKeys.size > 0;

        if (hasPerformance) {
          performanceReady++;
        }

        if (hasCompleteLineup) {
          lineupReady++;
        }

        if (hasImpact) {
          impactReady++;
        }

        if (hasSquadFeatures) {
          squadFeatureReady++;
        }

        const ready =
          hasPerformance &&
          hasCompleteLineup;

        if (ready) {
          fullyReady++;
        }

        return {
          tarih:
            match.kickoffAt
              .toISOString()
              .slice(0, 10),

          maç:
            `${match.homeTeam.name} - ${match.awayTeam.name}`,

          performance:
            performanceCount,

          lineup:
            `${confirmedLineups.length}/2`,

          oyuncu:
            lineupPlayerCount,

          ilk11:
            starterCount,

          impact:
            impactCount,

          squadFeature:
            squadFeatureKeys.size,

          hazır:
            ready
              ? "EVET"
              : "HAYIR",
        };
      },
    );

  console.log("");
  console.log(
    "COVERAGE SUMMARY",
  );

  console.table({
    "Toplam maç":
      matches.length,

    "Performance hazır":
      performanceReady,

    "Confirmed lineup hazır":
      lineupReady,

    "Impact mevcut":
      impactReady,

    "Squad feature mevcut":
      squadFeatureReady,

    "Performance + lineup hazır":
      fullyReady,
  });

  console.log("");
  console.log(
    "İLK 40 MAÇ",
  );

  console.table(
    rows.slice(
      0,
      40,
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

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
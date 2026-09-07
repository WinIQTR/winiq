import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateValueBets,
} from "@/modules/value-bet-engine";

function formatSignedPercentage(
  value: number,
): string {
  const prefix =
    value > 0
      ? "+"
      : "";

  return `${prefix}%${value.toFixed(
    2,
  )}`;
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALUE BET ENGINE V1.1 — BATCH VALIDATION",
  );

  console.log(
    "==============================================",
  );

  const now =
    new Date();

  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gt:
            now,
        },

        oddsSnapshots: {
          some: {},
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      select: {
        id:
          true,

        kickoffAt:
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

        season: {
          select: {
            league: {
              select: {
                name:
                  true,
              },
            },
          },
        },
      },
    });

  console.table({
    "Odds verili gelecek maç":
      matches.length,

    "Test başlangıcı":
      now.toISOString(),
  });

  if (
    matches.length ===
    0
  ) {
    console.log("");
    console.log(
      "Odds verisi bulunan başlamamış maç yok.",
    );

    console.log(
      "Önce güncel fikstür ve odds importu yapılmalıdır.",
    );

    return;
  }

  const summaryRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const [
      index,
      match,
    ]
    of matches.entries()
  ) {
    console.log("");
    console.log(
      `[${index + 1}/${matches.length}] ${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    try {
      const result =
        await calculateValueBets(
          match.id,
        );

      const strongestValue =
        result.valueBets[0] ??
        null;

      const strongestPublishable =
        result.publishableValueBets[0] ??
        null;

      console.log("");

      console.table({
        Maç:
          `${result.match.homeTeam} - ${result.match.awayTeam}`,

        Lig:
          result.match.leagueName,

        Tarih:
          result.match.kickoffAt.toISOString(),

        Karşılaştırma:
          result.comparisonCount,

        "Matematiksel Value":
          result.valueBetCount,

        Yayınlanabilir:
          result.publishableValueBetCount,

        İnceleme:
          result.reviewValueBetCount,

        Engellenen:
          result.blockedValueBetCount,

        "Kritik uyarı":
          result.criticalWarningCount,
      });

      console.log("");
      console.log(
        "VALUE BET COMPARISONS",
      );

      if (
        result.valueBets.length ===
        0
      ) {
        console.log(
          "Bu maçta matematiksel Value Bet bulunamadı.",
        );
      } else {
        console.table(
          result.valueBets.map(
            (
              valueBet,
              valueIndex,
            ) => ({
              rank:
                valueIndex +
                1,

              market:
                valueBet.market,

              selection:
                valueBet.selection,

              model:
                `%${valueBet.modelProbability.toFixed(
                  2,
                )}`,

              medianMarket:
                `%${valueBet.medianMarketProbability.toFixed(
                  2,
                )}`,

              averageMarket:
                `%${valueBet.averageMarketProbability.toFixed(
                  2,
                )}`,

              edge:
                formatSignedPercentage(
                  valueBet.marketEdge,
                ),

              fairOdds:
                valueBet.modelFairOdds?.toFixed(
                  2,
                ) ??
                "—",

              bestOdds:
                valueBet.bestOdds.toFixed(
                  2,
                ),

              medianOdds:
                valueBet.medianOdds.toFixed(
                  2,
                ),

              bookmaker:
                valueBet.bestBookmakerName,

              bookmakers:
                `${valueBet.validBookmakerCount}/${valueBet.bookmakerCount}`,

              EV:
                formatSignedPercentage(
                  valueBet.expectedValue,
                ),

              quarterKelly:
                `%${valueBet.quarterKellyPercentage.toFixed(
                  2,
                )}`,

              stake:
                `%${valueBet.recommendedStakePercentage.toFixed(
                  2,
                )}`,

              sourceAge:
  `${valueBet.sourceOddsAgeMinutes.toFixed(
    0,
  )}/${valueBet.allowedSourceOddsAgeMinutes.toFixed(
    0,
  )} dk`,

captureAge:
  `${valueBet.captureAgeMinutes.toFixed(
    0,
  )} dk`,

              status:
                valueBet.publishStatus,
            }),
          ),
        );
      }

      if (
        result.valueBets.length >
        0
      ) {
        console.log("");
        console.log(
          "PUBLISH DECISIONS",
        );

        for (
          const valueBet
          of result.valueBets
        ) {
          console.log("");
          console.log(
            `${valueBet.market} • ${valueBet.selection}`,
          );

          console.log(
            `Durum: ${valueBet.publishStatus}`,
          );

          for (
            const reason
            of valueBet.publishReasons
          ) {
            console.log(
              `- ${reason}`,
            );
          }
        }
      }

      summaryRows.push({
        matchId:
          result.match.id,

        match:
          `${result.match.homeTeam} - ${result.match.awayTeam}`,

        league:
          result.match.leagueName,

        kickoffAt:
          result.match.kickoffAt.toISOString(),

        comparisons:
          result.comparisonCount,

        mathematicalValue:
          result.valueBetCount,

        publishable:
          result.publishableValueBetCount,

        review:
          result.reviewValueBetCount,

        blocked:
          result.blockedValueBetCount,

        criticalWarnings:
          result.criticalWarningCount,

        strongestMarket:
          strongestValue?.market ??
          "—",

        strongestSelection:
          strongestValue?.selection ??
          "—",

        strongestStatus:
          strongestValue?.publishStatus ??
          "—",

        publishableMarket:
          strongestPublishable?.market ??
          "—",

        publishableSelection:
          strongestPublishable?.selection ??
          "—",
      });
    } catch (
      error: unknown
    ) {
      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      summaryRows.push({
        matchId:
          match.id,

        match:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        league:
          match.season.league.name,

        kickoffAt:
          match.kickoffAt.toISOString(),

        comparisons:
          0,

        mathematicalValue:
          0,

        publishable:
          0,

        review:
          0,

        blocked:
          0,

        criticalWarnings:
          0,

        strongestMarket:
          "ERROR",

        strongestSelection:
          "ERROR",

        strongestStatus:
          "ERROR",

        publishableMarket:
          "ERROR",

        publishableSelection:
          "ERROR",
      });
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ENGINE V1.1 SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table(
    summaryRows,
  );

  const totalMathematicalValue =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.mathematicalValue ??
          0,
        ),
      0,
    );

  const totalPublishable =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.publishable ??
          0,
        ),
      0,
    );

  const totalReview =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.review ??
          0,
        ),
      0,
    );

  const totalBlocked =
    summaryRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.blocked ??
          0,
        ),
      0,
    );

  console.log("");

  console.table({
    "Toplam maç":
      summaryRows.length,

    "Matematiksel Value":
      totalMathematicalValue,

    Yayınlanabilir:
      totalPublishable,

    İnceleme:
      totalReview,

    Engellenen:
      totalBlocked,
  });

  console.log("");

  if (
    totalPublishable ===
    0
  ) {
    console.log(
      [
        "SONUÇ:",
        "Value hesaplaması çalışıyor;",
        "ancak mevcut maçlar veri kalitesi veya yayın güvenliği nedeniyle kullanıcıya önerilmiyor.",
      ].join(
        " ",
      ),
    );
  } else {
    console.log(
      [
        "SONUÇ:",
        `${totalPublishable} seçim yayın güvenlik kontrollerini geçti.`,
      ].join(
        " ",
      ),
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
        "Value Bet V1.1 batch testi başarısız.",
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
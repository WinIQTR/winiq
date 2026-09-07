
import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateValueBets,
} from "@/modules/value-bet-engine";

function getValueLabel(
  valueLevel:
    string,
): string {
  switch (
    valueLevel
  ) {
    case "STRONG":
      return "GÜÇLÜ VALUE";

    case "GOOD":
      return "İYİ VALUE";

    case "WATCH":
      return "TAKİP";

    default:
      return "VALUE YOK";
  }
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALUE BET ENGINE V1 TEST",
  );

  console.log(
    "==============================================",
  );

  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "SCHEDULED",

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
      },
    });

  if (
    !match
  ) {
    throw new Error(
      "Odds verisi bulunan yaklaşan maç bulunamadı.",
    );
  }

  const result =
    await calculateValueBets(
      match.id,
    );

  console.table({
    Maç:
      `${result.match.homeTeam} - ${result.match.awayTeam}`,

    Lig:
      result.match.leagueName,

    Tarih:
      result.match.kickoffAt.toISOString(),

    "Market karşılaştırması":
      result.comparisonCount,

    "Value Bet":
      result.valueBetCount,

    "Minimum bookmaker":
      result.options.minimumBookmakerCount,

    "Minimum model olasılığı":
      result.options.minimumModelProbability,

    "Minimum edge":
      result.options.minimumMarketEdge,

    "Minimum EV":
      result.options.minimumExpectedValue,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ALL MARKET COMPARISONS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    result.comparisons.map(
      (
        comparison,
      ) => ({
        market:
          comparison.market,

        selection:
          comparison.selection,

        model:
          comparison.modelProbability.toFixed(
            2,
          ),

        marketProbability:
          comparison.averageMarketProbability.toFixed(
            2,
          ),

        edge:
          comparison.marketEdge.toFixed(
            2,
          ),

        fairOdds:
          comparison.modelFairOdds?.toFixed(
            2,
          ) ??
          "—",

        bestOdds:
          comparison.bestOdds.toFixed(
            2,
          ),

        bookmaker:
          comparison.bestBookmakerName,

        bookmakerCount:
          comparison.bookmakerCount,

        EV:
          comparison.expectedValue.toFixed(
            2,
          ),

        quarterKelly:
          comparison.quarterKellyPercentage.toFixed(
            2,
          ),

        stake:
          comparison.recommendedStakePercentage.toFixed(
            2,
          ),

        score:
          comparison.valueScore.toFixed(
            2,
          ),

        value:
          getValueLabel(
            comparison.valueLevel,
          ),

        accepted:
          comparison.isValueBet
            ? "YES"
            : "NO",
      }),
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ACCEPTED VALUE BETS",
  );

  console.log(
    "==============================================",
  );

  if (
    result.valueBets.length ===
    0
  ) {
    console.log(
      "Bu maçta filtreleri geçen Value Bet bulunamadı.",
    );
  } else {
    console.table(
      result.valueBets.map(
        (
          valueBet,
          index,
        ) => ({
          rank:
            index +
            1,

          market:
            valueBet.market,

          selection:
            valueBet.selection,

          model:
            `%${valueBet.modelProbability.toFixed(
              1,
            )}`,

          marketProbability:
            `%${valueBet.averageMarketProbability.toFixed(
              1,
            )}`,

          edge:
            `+%${valueBet.marketEdge.toFixed(
              1,
            )}`,

          odds:
            valueBet.bestOdds.toFixed(
              2,
            ),

          fair:
            valueBet.modelFairOdds?.toFixed(
              2,
            ) ??
            "—",

          EV:
            `+%${valueBet.expectedValue.toFixed(
              1,
            )}`,

          Kelly:
            `%${valueBet.recommendedStakePercentage.toFixed(
              2,
            )}`,

          bookmaker:
            valueBet.bestBookmakerName,

          level:
            getValueLabel(
              valueBet.valueLevel,
            ),
        }),
      ),
    );
  }

  if (
    result.warnings.length >
    0
  ) {
    console.log("");
    console.log(
      "WARNINGS",
    );

    for (
      const warning
      of result.warnings
    ) {
      console.log(
        `- ${warning}`,
      );
    }
  }

  console.log("");
  console.log(
    "VALUE BET ENGINE V1 TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Value Bet Engine testi başarısız.",
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
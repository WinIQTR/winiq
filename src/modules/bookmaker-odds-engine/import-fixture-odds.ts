import {
  prisma,
} from "@/lib/prisma";

import {
  fetchFixtureOdds,
} from "./fetch-fixture-odds";

import {
  normalizeApiMarket,
} from "./normalize-api-market";

import type {
  ImportedOddsSummary,
} from "./types";

const PREFERRED_BOOKMAKER_IDS =
  new Set([
    8,  // Bet365
    4,  // Pinnacle
    32, // Betano
    7,  // William Hill
    1,  // 10Bet
    16, // Unibet
    3,  // Betfair
    2,  // Marathonbet
    11, // 1xBet
  ]);

const BOOKMAKER_PRIORITY =
  new Map<number, number>([
    [4, 1],
    [8, 2],
    [32, 3],
    [7, 4],
    [16, 5],
    [3, 6],
    [1, 7],
    [2, 8],
    [11, 9],
  ]);

export async function importFixtureOdds(
  options: {
    matchId: number;
    apiKey: string;
    baseUrl: string;
  },
): Promise<ImportedOddsSummary> {
  const match =
    await prisma.match.findUnique({
      where: {
        id:
          options.matchId,
      },

      select: {
        id:
          true,

        apiId:
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
      },
    });

  if (
    !match
  ) {
    throw new Error(
      `Maç bulunamadı: ${options.matchId}`,
    );
  }

  const apiResult =
    await fetchFixtureOdds({
      apiKey:
        options.apiKey,

      baseUrl:
        options.baseUrl,

      fixtureApiId:
        match.apiId,
    });

  const oddsItem =
    apiResult.response[0] ??
    null;

  if (
    !oddsItem
  ) {
    return {
      matchId:
        match.id,

      fixtureApiId:
        match.apiId,

      homeTeam:
        match.homeTeam.name,

      awayTeam:
        match.awayTeam.name,

      bookmakerCount:
        0,

      snapshotCount:
        0,

      marketCount:
        0,

      selectionCount:
        0,

      skippedBookmakerCount:
        0,

      skippedMarketCount:
        0,
    };
  }

  const sourceUpdatedAt =
    new Date(
      oddsItem.update,
    );

  if (
    Number.isNaN(
      sourceUpdatedAt.getTime(),
    )
  ) {
    throw new Error(
      `Geçersiz odds update tarihi: ${oddsItem.update}`,
    );
  }

  let bookmakerCount =
    0;

  let snapshotCount =
    0;

  let marketCount =
    0;

  let selectionCount =
    0;

  let skippedBookmakerCount =
    0;

  let skippedMarketCount =
    0;

  for (
    const apiBookmaker
    of oddsItem.bookmakers
  ) {
    if (
      !PREFERRED_BOOKMAKER_IDS.has(
        apiBookmaker.id,
      )
    ) {
      skippedBookmakerCount +=
        1;

      continue;
    }

    const normalizedMarkets =
      apiBookmaker.bets
        .map(
          normalizeApiMarket,
        )
        .filter(
          (
            market,
          ): market is NonNullable<
            typeof market
          > =>
            market !==
            null,
        );

    skippedMarketCount +=
      apiBookmaker.bets.length -
      normalizedMarkets.length;

    if (
      normalizedMarkets.length ===
      0
    ) {
      continue;
    }

    const bookmaker =
      await prisma.bookmaker.upsert({
        where: {
          apiId:
            apiBookmaker.id,
        },

        update: {
          name:
            apiBookmaker.name,

          isActive:
            true,

          priority:
            BOOKMAKER_PRIORITY.get(
              apiBookmaker.id,
            ) ??
            100,
        },

        create: {
          apiId:
            apiBookmaker.id,

          name:
            apiBookmaker.name,

          isActive:
            true,

          priority:
            BOOKMAKER_PRIORITY.get(
              apiBookmaker.id,
            ) ??
            100,
        },
      });

    bookmakerCount +=
      1;

    const snapshot =
      await prisma.oddsSnapshot.upsert({
        where: {
          match_bookmaker_source_update_unique: {
            matchId:
              match.id,

            bookmakerId:
              bookmaker.id,

            sourceUpdatedAt,
          },
        },

        update: {
          capturedAt:
            new Date(),
        },

        create: {
          matchId:
            match.id,

          bookmakerId:
            bookmaker.id,

          source:
            "API_FOOTBALL",

          sourceUpdatedAt,

          capturedAt:
            new Date(),
        },
      });

    snapshotCount +=
      1;

    for (
      const normalizedMarket
      of normalizedMarkets
    ) {
      const market =
        await prisma.oddsMarket.upsert({
          where: {
            snapshot_api_bet_unique: {
              snapshotId:
                snapshot.id,

              apiBetId:
                normalizedMarket.apiBetId,
            },
          },

          update: {
            marketKey:
              normalizedMarket.marketKey,

            marketName:
              normalizedMarket.marketName,

            marketFamily:
              normalizedMarket.marketFamily,
          },

          create: {
            snapshotId:
              snapshot.id,

            apiBetId:
              normalizedMarket.apiBetId,

            marketKey:
              normalizedMarket.marketKey,

            marketName:
              normalizedMarket.marketName,

            marketFamily:
              normalizedMarket.marketFamily,
          },
        });

      marketCount +=
        1;

      for (
        const selection
        of normalizedMarket.selections
      ) {
        await prisma.oddsSelection.upsert({
          where: {
            market_selection_unique: {
              marketId:
                market.id,

              selectionKey:
                selection.selectionKey,
            },
          },

          update: {
            selectionName:
              selection.selectionName,

            decimalOdds:
              selection.decimalOdds,

            impliedProbability:
              selection.impliedProbability,

            normalizedProbability:
              selection.normalizedProbability,

            line:
              selection.line,
          },

          create: {
            marketId:
              market.id,

            selectionKey:
              selection.selectionKey,

            selectionName:
              selection.selectionName,

            decimalOdds:
              selection.decimalOdds,

            impliedProbability:
              selection.impliedProbability,

            normalizedProbability:
              selection.normalizedProbability,

            line:
              selection.line,
          },
        });

        selectionCount +=
          1;
      }
    }
  }

  return {
    matchId:
      match.id,

    fixtureApiId:
      match.apiId,

    homeTeam:
      match.homeTeam.name,

    awayTeam:
      match.awayTeam.name,

    bookmakerCount,

    snapshotCount,

    marketCount,

    selectionCount,

    skippedBookmakerCount,

    skippedMarketCount,
  };
}
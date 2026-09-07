import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "../src/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "../src/config/season";

import {
  prisma,
} from "../src/lib/prisma";

type ApiOddsValue = {
  value: string;
  odd: string;
};

type ApiOddsBet = {
  id: number;
  name: string;
  values: ApiOddsValue[];
};

type ApiOddsBookmaker = {
  id: number;
  name: string;
  bets: ApiOddsBet[];
};

type ApiOddsItem = {
  league: {
    id: number;
    name: string;
    country: string | null;
    season: number;
  };

  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
  };

  update: string;

  bookmakers: ApiOddsBookmaker[];
};

type ApiFootballOddsResponse = {
  get: string;

  parameters:
    Record<
      string,
      string
    >;

  errors:
    Record<
      string,
      string
    >;

  results: number;

  paging: {
    current: number;
    total: number;
  };

  response: ApiOddsItem[];
};

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (
    !value
  ) {
    throw new Error(
      `${name} ortam değişkeni tanımlı değil.`,
    );
  }

  return value;
}

function printSection(
  title: string,
): void {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    title,
  );

  console.log(
    "==============================================",
  );
}

function parseOdd(
  value: string,
): number | null {
  const parsed =
    Number.parseFloat(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <=
      1
  ) {
    return null;
  }

  return parsed;
}

async function fetchFixtureOdds(
  options: {
    apiKey: string;
    baseUrl: string;
    fixtureApiId: number;
  },
): Promise<ApiFootballOddsResponse> {
  const url =
    new URL(
      "/odds",
      options.baseUrl,
    );

  url.searchParams.set(
    "fixture",
    String(
      options.fixtureApiId,
    ),
  );

  url.searchParams.set(
    "page",
    "1",
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "x-apisports-key":
            options.apiKey,
        },
      },
    );

  const responseText =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      [
        "API-Football odds isteği başarısız.",
        `HTTP ${response.status}.`,
        responseText,
      ].join(
        " ",
      ),
    );
  }

  let parsed:
    ApiFootballOddsResponse;

  try {
    parsed =
      JSON.parse(
        responseText,
      ) as ApiFootballOddsResponse;
  } catch {
    throw new Error(
      "API-Football odds yanıtı geçerli JSON değil.",
    );
  }

  return parsed;
}

async function main():
  Promise<void> {
  printSection(
    "API-FOOTBALL ODDS TEST",
  );

  const apiKey =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_KEY",
    );

  const baseUrl =
    getRequiredEnvironmentVariable(
      "API_FOOTBALL_BASE_URL",
    );

  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            new Date(),
        },

        season: {
          year:
            ACTIVE_SEASON_YEAR,

          league: {
            apiId: {
              in: [
                ...ACTIVE_COMPETITION_API_IDS,
              ],
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      select: {
        id:
          true,

        apiId:
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
            year:
              true,

            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !match
  ) {
    throw new Error(
      "Odds testi için yaklaşan maç bulunamadı.",
    );
  }

  console.table({
    "Veritabanı maç ID":
      match.id,

    "API fixture ID":
      match.apiId,

    Maç:
      `${match.homeTeam.name} - ${match.awayTeam.name}`,

    Lig:
      match.season.league.name,

    "Lig API ID":
      match.season.league.apiId,

    Sezon:
      match.season.year,

    Tarih:
      match.kickoffAt.toISOString(),
  });

  printSection(
    "API REQUEST",
  );

  console.log(
    `/odds?fixture=${match.apiId}`,
  );

  const result =
    await fetchFixtureOdds({
      apiKey,
      baseUrl,

      fixtureApiId:
        match.apiId,
    });

  if (
    Object.keys(
      result.errors ??
        {},
    ).length >
    0
  ) {
    throw new Error(
      `API hata döndürdü: ${JSON.stringify(
        result.errors,
      )}`,
    );
  }

  printSection(
    "ODDS RESPONSE SUMMARY",
  );

  const firstItem =
    result.response[0] ??
    null;

  const bookmakerCount =
    firstItem
      ?.bookmakers
      .length ??
    0;

  const betCount =
    firstItem
      ?.bookmakers
      .reduce(
        (
          total,
          bookmaker,
        ) =>
          total +
          bookmaker.bets.length,
        0,
      ) ??
    0;

  const valueCount =
    firstItem
      ?.bookmakers
      .reduce(
        (
          bookmakerTotal,
          bookmaker,
        ) =>
          bookmakerTotal +
          bookmaker.bets.reduce(
            (
              betTotal,
              bet,
            ) =>
              betTotal +
              bet.values.length,
            0,
          ),
        0,
      ) ??
    0;

  console.table({
    Results:
      result.results,

    "Sayfa":
      `${result.paging.current}/${result.paging.total}`,

    "Bookmaker sayısı":
      bookmakerCount,

    "Bet market sayısı":
      betCount,

    "Oran seçeneği":
      valueCount,

    "Son güncelleme":
      firstItem?.update ??
      "—",
  });

  if (
    result.response.length ===
    0
  ) {
    console.log("");
    console.log(
      "Bu maç için henüz bookmaker oranı bulunamadı.",
    );

    console.log(
      "Bu durum API planı, lig kapsamı veya maçın oranlarının henüz açılmamış olmasıyla ilgili olabilir.",
    );

    return;
  }

  printSection(
    "BOOKMAKERS",
  );

  console.table(
    firstItem?.bookmakers.map(
      (
        bookmaker,
      ) => ({
        id:
          bookmaker.id,

        bookmaker:
          bookmaker.name,

        markets:
          bookmaker.bets.length,

        selections:
          bookmaker.bets.reduce(
            (
              total,
              bet,
            ) =>
              total +
              bet.values.length,
            0,
          ),
      }),
    ) ??
    [],
  );

  const bookmaker =
    firstItem?.bookmakers[0] ??
    null;

  if (
    !bookmaker
  ) {
    console.log(
      "Bookmaker kaydı bulunamadı.",
    );

    return;
  }

  printSection(
    `FIRST BOOKMAKER — ${bookmaker.name}`,
  );

  const marketRows =
    bookmaker.bets
      .flatMap(
        (
          bet,
        ) =>
          bet.values.map(
            (
              value,
            ) => ({
              betId:
                bet.id,

              market:
                bet.name,

              selection:
                value.value,

              odd:
                parseOdd(
                  value.odd,
                ) ??
                value.odd,
            }),
          ),
      )
      .slice(
        0,
        50,
      );

  console.table(
    marketRows,
  );

  const matchWinner =
    bookmaker.bets.find(
      (
        bet,
      ) => {
        const normalizedName =
          bet.name
            .trim()
            .toLowerCase();

        return (
          normalizedName ===
            "match winner" ||
          normalizedName ===
            "1x2"
        );
      },
    ) ??
    null;

  printSection(
    "MATCH WINNER CHECK",
  );

  if (
    !matchWinner
  ) {
    console.log(
      "İlk bookmaker içinde Match Winner marketi bulunamadı.",
    );
  } else {
    console.table(
      matchWinner.values.map(
        (
          value,
        ) => ({
          selection:
            value.value,

          odd:
            parseOdd(
              value.odd,
            ) ??
            value.odd,

          impliedProbability:
            parseOdd(
              value.odd,
            )
              ? Number(
                  (
                    100 /
                    (
                      parseOdd(
                        value.odd,
                      ) as number
                    )
                  ).toFixed(
                    2,
                  ),
                )
              : null,
        }),
      ),
    );
  }

  console.log("");
  console.log(
    "API-FOOTBALL ODDS TESTİ TAMAMLANDI.",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "API-Football odds testi başarısız.",
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
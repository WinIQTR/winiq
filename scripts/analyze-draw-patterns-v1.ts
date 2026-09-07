import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

type DatasetName =
  | "TRAIN"
  | "VALIDATION"
  | "TEST";

type DrawAnalysisRow = {
  dataset:
    DatasetName;

  matchId:
    number;

  kickoffAt:
    Date;

  leagueApiId:
    number;

  leagueName:
    string;

  homeTeam:
    string;

  awayTeam:
    string;

  homeScore:
    number;

  awayScore:
    number;

  actualOutcome:
    MatchOutcome;

  isDraw:
    boolean;

  poissonOutcome:
    MatchOutcome;

  homeProbability:
    number;

  drawProbability:
    number;

  awayProbability:
    number;

  strongestNonDrawProbability:
    number;

  drawVsNonDrawGap:
    number;

  homeAwayProbabilityGap:
    number;

  expectedHomeGoals:
    number;

  expectedAwayGoals:
    number;

  expectedGoalsTotal:
    number;

  expectedGoalsGap:
    number;

  dataQualityLeagueMatches:
    number;

  dataQualityHomeVenue:
    number;

  dataQualityAwayVenue:
    number;
};

type RangeDefinition = {
  label:
    string;

  minimum:
    number;

  maximum:
    number;
};

const SEASON_YEAR =
  2024;

const TRAIN_RATIO =
  0.6;

const VALIDATION_RATIO =
  0.2;

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator ===
    0
  ) {
    return 0;
  }

  return round(
    (
      numerator /
      denominator
    ) *
      100,
    2,
  );
}

function average(
  values: number[],
): number {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return round(
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
      values.length,
    4,
  );
}

function actualOutcomeFromScore(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (
    homeScore >
    awayScore
  ) {
    return "HOME";
  }

  if (
    homeScore <
    awayScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

function getTopPrediction(
  probabilities:
    OutcomeProbabilities,
): MatchOutcome {
  const candidates:
    Array<{
      outcome:
        MatchOutcome;

      probability:
        number;
    }> = [
    {
      outcome:
        "HOME",

      probability:
        probabilities.home,
    },

    {
      outcome:
        "DRAW",

      probability:
        probabilities.draw,
    },

    {
      outcome:
        "AWAY",

      probability:
        probabilities.away,
    },
  ];

  candidates.sort(
    (
      left,
      right,
    ) =>
      right.probability -
      left.probability,
  );

  return candidates[0].outcome;
}

function resolveDataset(
  index: number,
  total: number,
): DatasetName {
  const trainEnd =
    Math.floor(
      total *
        TRAIN_RATIO,
    );

  const validationEnd =
    Math.floor(
      total *
        (
          TRAIN_RATIO +
          VALIDATION_RATIO
        ),
    );

  if (
    index <
    trainEnd
  ) {
    return "TRAIN";
  }

  if (
    index <
    validationEnd
  ) {
    return "VALIDATION";
  }

  return "TEST";
}

function summarizeRows(
  name: string,
  rows:
    DrawAnalysisRow[],
): Record<
  string,
  unknown
> {
  const draws =
    rows.filter(
      (
        row,
      ) =>
        row.isDraw,
    ).length;

  return {
    group:
      name,

    matches:
      rows.length,

    draws,

    drawRate:
      percentage(
        draws,
        rows.length,
      ),

    avgDrawProbability:
      average(
        rows.map(
          (
            row,
          ) =>
            row.drawProbability,
        ),
      ),

    avgDrawGap:
      average(
        rows.map(
          (
            row,
          ) =>
            row.drawVsNonDrawGap,
        ),
      ),

    avgHomeAwayGap:
      average(
        rows.map(
          (
            row,
          ) =>
            row.homeAwayProbabilityGap,
        ),
      ),

    avgExpectedGoals:
      average(
        rows.map(
          (
            row,
          ) =>
            row.expectedGoalsTotal,
        ),
      ),

    avgExpectedGoalsGap:
      average(
        rows.map(
          (
            row,
          ) =>
            row.expectedGoalsGap,
        ),
      ),
  };
}

function analyzeRanges(
  options: {
    rows:
      DrawAnalysisRow[];

    ranges:
      RangeDefinition[];

    getValue:
      (
        row:
          DrawAnalysisRow,
      ) => number;
  },
): Array<
  Record<
    string,
    unknown
  >
> {
  return options.ranges.map(
    (
      range,
    ) => {
      const selected =
        options.rows.filter(
          (
            row,
          ) => {
            const value =
              options.getValue(
                row,
              );

            return (
              value >=
                range.minimum &&
              value <
                range.maximum
            );
          },
        );

      const draws =
        selected.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length;

      return {
        range:
          range.label,

        matches:
          selected.length,

        draws,

        drawRate:
          percentage(
            draws,
            selected.length,
          ),

        avgDrawProbability:
          average(
            selected.map(
              (
                row,
              ) =>
                row.drawProbability,
            ),
          ),

        avgTotalXg:
          average(
            selected.map(
              (
                row,
              ) =>
                row.expectedGoalsTotal,
            ),
          ),

        avgXgGap:
          average(
            selected.map(
              (
                row,
              ) =>
                row.expectedGoalsGap,
            ),
          ),
      };
    },
  );
}

function buildCombinedDrawZones(
  rows:
    DrawAnalysisRow[],
): Array<
  Record<
    string,
    unknown
  >
> {
  const definitions = [
    {
      name:
        "DRAW>=20 GAP<=20",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            20 &&
          row.drawVsNonDrawGap <=
            20,
    },

    {
      name:
        "DRAW>=22 GAP<=18",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            22 &&
          row.drawVsNonDrawGap <=
            18,
    },

    {
      name:
        "DRAW>=24 GAP<=16",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            24 &&
          row.drawVsNonDrawGap <=
            16,
    },

    {
      name:
        "DRAW>=25 GAP<=14",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            25 &&
          row.drawVsNonDrawGap <=
            14,
    },

    {
      name:
        "DRAW>=26 GAP<=12",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            26 &&
          row.drawVsNonDrawGap <=
            12,
    },

    {
      name:
        "DRAW>=24 XG_GAP<=0.40",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            24 &&
          row.expectedGoalsGap <=
            0.4,
    },

    {
      name:
        "DRAW>=24 XG_TOTAL<=2.50",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            24 &&
          row.expectedGoalsTotal <=
            2.5,
    },

    {
      name:
        "DRAW>=24 GAP<=16 XG_GAP<=0.40",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            24 &&
          row.drawVsNonDrawGap <=
            16 &&
          row.expectedGoalsGap <=
            0.4,
    },

    {
      name:
        "DRAW>=24 GAP<=16 XG_TOTAL<=2.50",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            24 &&
          row.drawVsNonDrawGap <=
            16 &&
          row.expectedGoalsTotal <=
            2.5,
    },

    {
      name:
        "DRAW>=25 GAP<=14 XG_GAP<=0.35",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            25 &&
          row.drawVsNonDrawGap <=
            14 &&
          row.expectedGoalsGap <=
            0.35,
    },

    {
      name:
        "DRAW>=25 GAP<=14 XG_TOTAL<=2.40",

      filter:
        (
          row:
            DrawAnalysisRow,
        ) =>
          row.drawProbability >=
            25 &&
          row.drawVsNonDrawGap <=
            14 &&
          row.expectedGoalsTotal <=
            2.4,
    },
  ];

  return definitions.map(
    (
      definition,
    ) => {
      const selected =
        rows.filter(
          definition.filter,
        );

      const draws =
        selected.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length;

      return {
        zone:
          definition.name,

        matches:
          selected.length,

        draws,

        drawRate:
          percentage(
            draws,
            selected.length,
          ),

        avgDrawProbability:
          average(
            selected.map(
              (
                row,
              ) =>
                row.drawProbability,
            ),
          ),

        avgDrawGap:
          average(
            selected.map(
              (
                row,
              ) =>
                row.drawVsNonDrawGap,
            ),
          ),

        avgTotalXg:
          average(
            selected.map(
              (
                row,
              ) =>
                row.expectedGoalsTotal,
            ),
          ),

        avgXgGap:
          average(
            selected.map(
              (
                row,
              ) =>
                row.expectedGoalsGap,
            ),
          ),
      };
    },
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW PATTERN ANALYSIS V1",
  );

  console.log(
    "==============================================",
  );

  console.log("");
  console.log(
    "Production baseline:",
    "Poisson V0.5",
  );

  console.log(
    "Season:",
    SEASON_YEAR,
  );

  const matches =
    await prisma
      .match
      .findMany({
        where: {
          status:
            "FINISHED",

          homeScore: {
            not:
              null,
          },

          awayScore: {
            not:
              null,
          },

          season: {
            year:
              SEASON_YEAR,

            league: {
              apiId: {
                in: [
                  ...ACTIVE_COMPETITION_API_IDS,
                ],
              },
            },
          },
        },

        orderBy: [
          {
            kickoffAt:
              "asc",
          },

          {
            id:
              "asc",
          },
        ],

        select: {
          id:
            true,

          kickoffAt:
            true,

          homeScore:
            true,

          awayScore:
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
    matches.length <
    100
  ) {
    throw new Error(
      `Analiz için yeterli maç bulunamadı: ${matches.length}`,
    );
  }

  const trainCount =
    Math.floor(
      matches.length *
        TRAIN_RATIO,
    );

  const validationCount =
    Math.floor(
      matches.length *
        VALIDATION_RATIO,
    );

  const testCount =
    matches.length -
    trainCount -
    validationCount;

  console.log("");
  console.log(
    "CHRONOLOGICAL DATASET",
  );

  console.table({
    "All matches":
      matches.length,

    TRAIN:
      trainCount,

    VALIDATION:
      validationCount,

    TEST:
      testCount,

    "Train ratio":
      `${TRAIN_RATIO * 100}%`,

    "Validation ratio":
      `${VALIDATION_RATIO * 100}%`,

    "Test ratio":
      `${round(
        (
          testCount /
          matches.length
        ) *
          100,
        2,
      )}%`,
  });

  const rows:
    DrawAnalysisRow[] =
      [];

  const failures:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    let index =
      0;

    index <
    matches.length;

    index +=
      1
  ) {
    const match =
      matches[
        index
      ];

    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    try {
      /*
       * calculateGoalProbabilities V0.4
       * yalnızca bu maçtan ÖNCE oynanmış
       * maçları kullandığı için historical
       * prediction leakage içermez.
       */
      const result =
        await calculateGoalProbabilities(
          match.id,
        );

      const probabilities:
        OutcomeProbabilities = {
        home:
          result
            .outcomeProbabilities
            .home,

        draw:
          result
            .outcomeProbabilities
            .draw,

        away:
          result
            .outcomeProbabilities
            .away,
      };

      const actualOutcome =
        actualOutcomeFromScore(
          match.homeScore,
          match.awayScore,
        );

      const strongestNonDrawProbability =
        Math.max(
          probabilities.home,
          probabilities.away,
        );

      const drawVsNonDrawGap =
        strongestNonDrawProbability -
        probabilities.draw;

      const homeAwayProbabilityGap =
        Math.abs(
          probabilities.home -
          probabilities.away,
        );

      const expectedGoalsTotal =
        result.expectedGoals.home +
        result.expectedGoals.away;

      const expectedGoalsGap =
        Math.abs(
          result.expectedGoals.home -
          result.expectedGoals.away,
        );

      rows.push({
        dataset:
          resolveDataset(
            index,
            matches.length,
          ),

        matchId:
          match.id,

        kickoffAt:
          match.kickoffAt,

        leagueApiId:
          match
            .season
            .league
            .apiId,

        leagueName:
          match
            .season
            .league
            .name,

        homeTeam:
          match
            .homeTeam
            .name,

        awayTeam:
          match
            .awayTeam
            .name,

        homeScore:
          match.homeScore,

        awayScore:
          match.awayScore,

        actualOutcome,

        isDraw:
          actualOutcome ===
          "DRAW",

        poissonOutcome:
          getTopPrediction(
            probabilities,
          ),

        homeProbability:
          probabilities.home,

        drawProbability:
          probabilities.draw,

        awayProbability:
          probabilities.away,

        strongestNonDrawProbability:
          round(
            strongestNonDrawProbability,
          ),

        drawVsNonDrawGap:
          round(
            drawVsNonDrawGap,
          ),

        homeAwayProbabilityGap:
          round(
            homeAwayProbabilityGap,
          ),

        expectedHomeGoals:
          result
            .expectedGoals
            .home,

        expectedAwayGoals:
          result
            .expectedGoals
            .away,

        expectedGoalsTotal:
          round(
            expectedGoalsTotal,
          ),

        expectedGoalsGap:
          round(
            expectedGoalsGap,
          ),

        dataQualityLeagueMatches:
          result
            .dataQuality
            .leagueMatches,

        dataQualityHomeVenue:
          result
            .dataQuality
            .homeVenueMatches,

        dataQualityAwayVenue:
          result
            .dataQuality
            .awayVenueMatches,
      });

      if (
        (
          index +
          1
        ) %
          100 ===
        0
      ) {
        console.log(
          `ANALYSIS ${index + 1}/${matches.length}`,
        );
      }
    } catch (
      error: unknown
    ) {
      failures.push({
        matchId:
          match.id,

        league:
          match
            .season
            .league
            .name,

        match:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }

  const trainRows =
    rows.filter(
      (
        row,
      ) =>
        row.dataset ===
        "TRAIN",
    );

  const validationRows =
    rows.filter(
      (
        row,
      ) =>
        row.dataset ===
        "VALIDATION",
    );

  const testRows =
    rows.filter(
      (
        row,
      ) =>
        row.dataset ===
        "TEST",
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DATASET DRAW RATES",
  );

  console.log(
    "==============================================",
  );

  console.table([
    summarizeRows(
      "ALL",
      rows,
    ),

    summarizeRows(
      "TRAIN",
      trainRows,
    ),

    summarizeRows(
      "VALIDATION",
      validationRows,
    ),

    summarizeRows(
      "TEST",
      testRows,
    ),
  ]);

  /*
   * ==================================================
   * DRAW PROBABILITY
   * ==================================================
   */

  const drawProbabilityRanges:
    RangeDefinition[] = [
    {
      label:
        "<18",

      minimum:
        0,

      maximum:
        18,
    },

    {
      label:
        "18-19.99",

      minimum:
        18,

      maximum:
        20,
    },

    {
      label:
        "20-21.99",

      minimum:
        20,

      maximum:
        22,
    },

    {
      label:
        "22-23.99",

      minimum:
        22,

      maximum:
        24,
    },

    {
      label:
        "24-25.99",

      minimum:
        24,

      maximum:
        26,
    },

    {
      label:
        "26-27.99",

      minimum:
        26,

      maximum:
        28,
    },

    {
      label:
        "28-29.99",

      minimum:
        28,

      maximum:
        30,
    },

    {
      label:
        ">=30",

      minimum:
        30,

      maximum:
        101,
    },
  ];

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — DRAW PROBABILITY BANDS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    analyzeRanges({
      rows:
        trainRows,

      ranges:
        drawProbabilityRanges,

      getValue:
        (
          row,
        ) =>
          row.drawProbability,
    }),
  );

  /*
   * ==================================================
   * DRAW VS NON-DRAW GAP
   * ==================================================
   */

  const drawGapRanges:
    RangeDefinition[] = [
    {
      label:
        "<=2",

      minimum:
        -100,

      maximum:
        2.0001,
    },

    {
      label:
        "2-5",

      minimum:
        2.0001,

      maximum:
        5.0001,
    },

    {
      label:
        "5-10",

      minimum:
        5.0001,

      maximum:
        10.0001,
    },

    {
      label:
        "10-15",

      minimum:
        10.0001,

      maximum:
        15.0001,
    },

    {
      label:
        "15-20",

      minimum:
        15.0001,

      maximum:
        20.0001,
    },

    {
      label:
        "20-30",

      minimum:
        20.0001,

      maximum:
        30.0001,
    },

    {
      label:
        ">=30",

      minimum:
        30.0001,

      maximum:
        101,
    },
  ];

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — DRAW VS NON-DRAW GAP",
  );

  console.log(
    "==============================================",
  );

  console.table(
    analyzeRanges({
      rows:
        trainRows,

      ranges:
        drawGapRanges,

      getValue:
        (
          row,
        ) =>
          row.drawVsNonDrawGap,
    }),
  );

  /*
   * ==================================================
   * EXPECTED GOALS TOTAL
   * ==================================================
   */

  const totalXgRanges:
    RangeDefinition[] = [
    {
      label:
        "<1.75",

      minimum:
        0,

      maximum:
        1.75,
    },

    {
      label:
        "1.75-2.00",

      minimum:
        1.75,

      maximum:
        2,
    },

    {
      label:
        "2.00-2.25",

      minimum:
        2,

      maximum:
        2.25,
    },

    {
      label:
        "2.25-2.50",

      minimum:
        2.25,

      maximum:
        2.5,
    },

    {
      label:
        "2.50-2.75",

      minimum:
        2.5,

      maximum:
        2.75,
    },

    {
      label:
        "2.75-3.00",

      minimum:
        2.75,

      maximum:
        3,
    },

    {
      label:
        "3.00-3.50",

      minimum:
        3,

      maximum:
        3.5,
    },

    {
      label:
        ">=3.50",

      minimum:
        3.5,

      maximum:
        20,
    },
  ];

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — EXPECTED GOALS TOTAL",
  );

  console.log(
    "==============================================",
  );

  console.table(
    analyzeRanges({
      rows:
        trainRows,

      ranges:
        totalXgRanges,

      getValue:
        (
          row,
        ) =>
          row.expectedGoalsTotal,
    }),
  );

  /*
   * ==================================================
   * EXPECTED GOAL DIFFERENCE
   * ==================================================
   */

  const xgGapRanges:
    RangeDefinition[] = [
    {
      label:
        "<0.20",

      minimum:
        0,

      maximum:
        0.2,
    },

    {
      label:
        "0.20-0.40",

      minimum:
        0.2,

      maximum:
        0.4,
    },

    {
      label:
        "0.40-0.60",

      minimum:
        0.4,

      maximum:
        0.6,
    },

    {
      label:
        "0.60-0.80",

      minimum:
        0.6,

      maximum:
        0.8,
    },

    {
      label:
        "0.80-1.00",

      minimum:
        0.8,

      maximum:
        1,
    },

    {
      label:
        ">=1.00",

      minimum:
        1,

      maximum:
        20,
    },
  ];

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — EXPECTED GOALS GAP",
  );

  console.log(
    "==============================================",
  );

  console.table(
    analyzeRanges({
      rows:
        trainRows,

      ranges:
        xgGapRanges,

      getValue:
        (
          row,
        ) =>
          row.expectedGoalsGap,
    }),
  );

  /*
   * ==================================================
   * COMBINED DRAW ZONES
   * ==================================================
   *
   * Kurallar TRAIN üzerinde inceleniyor.
   * Henüz production kuralı DEĞİLLER.
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — COMBINED DRAW ZONES",
  );

  console.log(
    "==============================================",
  );

  const trainZones =
    buildCombinedDrawZones(
      trainRows,
    );

  console.table(
    trainZones,
  );

  /*
   * Aynı sabit bölgeleri VALIDATION üzerinde
   * ölçüyoruz.
   *
   * Validation sonucuna göre daha sonra
   * aday seçebiliriz.
   */
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALIDATION — SAME DRAW ZONES",
  );

  console.log(
    "==============================================",
  );

  const validationZones =
    buildCombinedDrawZones(
      validationRows,
    );

  console.table(
    validationZones,
  );

  /*
   * TEST setine burada yalnızca diagnostic
   * amaçla aynı sabit bölgeleri uyguluyoruz.
   *
   * Bu script hiçbir parametreyi TEST
   * sonucuna göre optimize etmeyecek.
   */
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TEST — SAME DRAW ZONES",
  );

  console.log(
    "==============================================",
  );

  const testZones =
    buildCombinedDrawZones(
      testRows,
    );

  console.table(
    testZones,
  );

  /*
   * ==================================================
   * LEAGUE DRAW PROFILE
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TRAIN — LEAGUE DRAW PROFILE",
  );

  console.log(
    "==============================================",
  );

  const leagueIds =
    [
      ...new Set(
        trainRows.map(
          (
            row,
          ) =>
            row.leagueApiId,
        ),
      ),
    ];

  console.table(
    leagueIds
      .map(
        (
          leagueApiId,
        ) => {
          const leagueRows =
            trainRows.filter(
              (
                row,
              ) =>
                row.leagueApiId ===
                leagueApiId,
            );

          const first =
            leagueRows[
              0
            ];

          return summarizeRows(
            first
              ?.leagueName ??
              String(
                leagueApiId,
              ),

            leagueRows,
          );
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          Number(
            right.drawRate,
          ) -
          Number(
            left.drawRate,
          ),
      ),
  );

  /*
   * ==================================================
   * TRUE DRAW EXAMPLES
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TEST — FIRST 30 ACTUAL DRAWS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    testRows
      .filter(
        (
          row,
        ) =>
          row.isDraw,
      )
      .slice(
        0,
        30,
      )
      .map(
        (
          row,
        ) => ({
          matchId:
            row.matchId,

          league:
            row.leagueName,

          match:
            `${row.homeTeam} - ${row.awayTeam}`,

          score:
            `${row.homeScore}-${row.awayScore}`,

          home:
            row.homeProbability,

          draw:
            row.drawProbability,

          away:
            row.awayProbability,

          drawGap:
            row.drawVsNonDrawGap,

          homeAwayGap:
            row.homeAwayProbabilityGap,

          xg:
            `${row.expectedHomeGoals}-${row.expectedAwayGoals}`,

          totalXg:
            row.expectedGoalsTotal,

          xgGap:
            row.expectedGoalsGap,

          poisson:
            row.poissonOutcome,
        }),
      ),
  );

  /*
   * ==================================================
   * FINAL SUMMARY
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "ANALYSIS SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Matches:
      rows.length,

    Failures:
      failures.length,

    TRAIN:
      trainRows.length,

    VALIDATION:
      validationRows.length,

    TEST:
      testRows.length,

    "TRAIN draw rate":
      percentage(
        trainRows.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length,

        trainRows.length,
      ),

    "VALIDATION draw rate":
      percentage(
        validationRows.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length,

        validationRows.length,
      ),

    "TEST draw rate":
      percentage(
        testRows.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length,

        testRows.length,
      ),
  });

  if (
    failures.length >
    0
  ) {
    console.log("");
    console.log(
      "FAILURES",
    );

    console.table(
      failures.slice(
        0,
        30,
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW PATTERN ANALYSIS V1 TAMAMLANDI",
  );

  console.log(
    "==============================================",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "DRAW Pattern Analysis V1 başarısız.",
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
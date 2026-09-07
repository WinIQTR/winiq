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

type AnalysisRow = {
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

  actualOutcome:
    MatchOutcome;

  isDraw:
    boolean;

  homeProbability:
    number;

  drawProbability:
    number;

  awayProbability:
    number;

  strongestNonDraw:
    number;

  drawGap:
    number;

  homeAwayGap:
    number;

  expectedHomeGoals:
    number;

  expectedAwayGoals:
    number;

  totalXg:
    number;

  xgGap:
    number;
};

type RuleDefinition = {
  name:
    string;

  filter:
    (
      row:
        AnalysisRow,
    ) => boolean;
};

type RuleResult = {
  leagueApiId:
    number;

  leagueName:
    string;

  dataset:
    DatasetName;

  rule:
    string;

  matches:
    number;

  draws:
    number;

  drawRate:
    number;

  uplift:
    number;

  avgDrawProbability:
    number;

  avgDrawGap:
    number;

  avgXgGap:
    number;

  avgTotalXg:
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

function getLeagueBaseDrawRate(
  rows:
    AnalysisRow[],
  leagueApiId:
    number,
  dataset:
    DatasetName,
): number {
  const selected =
    rows.filter(
      (
        row,
      ) =>
        row.leagueApiId ===
          leagueApiId &&
        row.dataset ===
          dataset,
    );

  const draws =
    selected.filter(
      (
        row,
      ) =>
        row.isDraw,
    ).length;

  return percentage(
    draws,
    selected.length,
  );
}

function createRules():
  RuleDefinition[] {
  return [
    {
      name:
        "DRAW>=22",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
          22,
    },

    {
      name:
        "DRAW>=24",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
          24,
    },

    {
      name:
        "DRAW>=26",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
          26,
    },

    {
      name:
        "DRAW>=28",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
          28,
    },

    {
      name:
        "XG_GAP<=0.20",

      filter:
        (
          row,
        ) =>
          row.xgGap <=
          0.2,
    },

    {
      name:
        "XG_GAP 0.20-0.40",

      filter:
        (
          row,
        ) =>
          row.xgGap >
            0.2 &&
          row.xgGap <=
            0.4,
    },

    {
      name:
        "XG_GAP<=0.40",

      filter:
        (
          row,
        ) =>
          row.xgGap <=
          0.4,
    },

    {
      name:
        "TOTAL_XG<=2.25",

      filter:
        (
          row,
        ) =>
          row.totalXg <=
          2.25,
    },

    {
      name:
        "TOTAL_XG<=2.50",

      filter:
        (
          row,
        ) =>
          row.totalXg <=
          2.5,
    },

    {
      name:
        "HOME_AWAY_GAP<=10",

      filter:
        (
          row,
        ) =>
          row.homeAwayGap <=
          10,
    },

    {
      name:
        "HOME_AWAY_GAP<=15",

      filter:
        (
          row,
        ) =>
          row.homeAwayGap <=
          15,
    },

    {
      name:
        "DRAW>=24 + XG_GAP<=0.40",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            24 &&
          row.xgGap <=
            0.4,
    },

    {
      name:
        "DRAW>=24 + TOTAL_XG<=2.50",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            24 &&
          row.totalXg <=
            2.5,
    },

    {
      name:
        "DRAW>=24 + HOME_AWAY_GAP<=15",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            24 &&
          row.homeAwayGap <=
            15,
    },

    {
      name:
        "DRAW>=25 + XG_GAP<=0.40",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            25 &&
          row.xgGap <=
            0.4,
    },

    {
      name:
        "DRAW>=25 + TOTAL_XG<=2.40",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            25 &&
          row.totalXg <=
            2.4,
    },

    {
      name:
        "DRAW>=26 + XG_GAP<=0.35",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            26 &&
          row.xgGap <=
            0.35,
    },

    {
      name:
        "DRAW>=26 + TOTAL_XG<=2.30",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            26 &&
          row.totalXg <=
            2.3,
    },

    {
      name:
        "DRAW>=24 + XG_GAP<=0.40 + TOTAL_XG<=2.50",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            24 &&
          row.xgGap <=
            0.4 &&
          row.totalXg <=
            2.5,
    },

    {
      name:
        "DRAW>=25 + XG_GAP<=0.35 + TOTAL_XG<=2.40",

      filter:
        (
          row,
        ) =>
          row.drawProbability >=
            25 &&
          row.xgGap <=
            0.35 &&
          row.totalXg <=
            2.4,
    },
  ];
}

function evaluateRules(
  options: {
    rows:
      AnalysisRow[];

    leagueApiId:
      number;

    leagueName:
      string;

    dataset:
      DatasetName;

    rules:
      RuleDefinition[];
  },
): RuleResult[] {
  const leagueRows =
    options.rows.filter(
      (
        row,
      ) =>
        row.leagueApiId ===
          options.leagueApiId &&
        row.dataset ===
          options.dataset,
    );

  const baseDrawRate =
    getLeagueBaseDrawRate(
      options.rows,
      options.leagueApiId,
      options.dataset,
    );

  return options.rules.map(
    (
      rule,
    ) => {
      const selected =
        leagueRows.filter(
          rule.filter,
        );

      const draws =
        selected.filter(
          (
            row,
          ) =>
            row.isDraw,
        ).length;

      const drawRate =
        percentage(
          draws,
          selected.length,
        );

      return {
        leagueApiId:
          options.leagueApiId,

        leagueName:
          options.leagueName,

        dataset:
          options.dataset,

        rule:
          rule.name,

        matches:
          selected.length,

        draws,

        drawRate,

        uplift:
          round(
            drawRate -
            baseDrawRate,
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
                row.drawGap,
            ),
          ),

        avgXgGap:
          average(
            selected.map(
              (
                row,
              ) =>
                row.xgGap,
            ),
          ),

        avgTotalXg:
          average(
            selected.map(
              (
                row,
              ) =>
                row.totalXg,
            ),
          ),
      };
    },
  );
}

function buildCandidateRanking(
  options: {
    train:
      RuleResult[];

    validation:
      RuleResult[];

    minimumTrainMatches:
      number;

    minimumValidationMatches:
      number;
  },
): Array<
  Record<
    string,
    unknown
  >
> {
  const candidates:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const trainResult
    of options.train
  ) {
    if (
      trainResult.matches <
      options.minimumTrainMatches
    ) {
      continue;
    }

    const validationResult =
      options.validation.find(
        (
          item,
        ) =>
          item.leagueApiId ===
            trainResult.leagueApiId &&
          item.rule ===
            trainResult.rule,
      );

    if (
      !validationResult ||
      validationResult.matches <
        options.minimumValidationMatches
    ) {
      continue;
    }

    const positiveTrain =
      trainResult.uplift >
      0;

    const positiveValidation =
      validationResult.uplift >
      0;

    const stabilityGap =
      Math.abs(
        trainResult.drawRate -
        validationResult.drawRate,
      );

    /*
     * Basit araştırma ranking'i.
     *
     * Production modeli değildir.
     *
     * VALIDATION uplift'i yüksek,
     * TRAIN uplift'i pozitif ve
     * train-validation farkı düşük
     * adayları yukarı taşır.
     */
    const score =
      round(
        (
          trainResult.uplift *
            0.3
        ) +
          (
            validationResult.uplift *
            0.6
          ) -
          (
            stabilityGap *
            0.1
          ),
        4,
      );

    candidates.push({
      leagueApiId:
        trainResult.leagueApiId,

      league:
        trainResult.leagueName,

      rule:
        trainResult.rule,

      trainMatches:
        trainResult.matches,

      trainDrawRate:
        trainResult.drawRate,

      trainUplift:
        trainResult.uplift,

      validationMatches:
        validationResult.matches,

      validationDrawRate:
        validationResult.drawRate,

      validationUplift:
        validationResult.uplift,

      stabilityGap:
        round(
          stabilityGap,
        ),

      positiveBoth:
        positiveTrain &&
        positiveValidation
          ? "YES"
          : "NO",

      score,
    });
  }

  return candidates.sort(
    (
      first,
      second,
    ) =>
      Number(
        second.score,
      ) -
      Number(
        first.score,
      ),
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEAGUE-AWARE DRAW MODEL V2 ANALYSIS",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Season:
      SEASON_YEAR,

    "Train ratio":
      `${TRAIN_RATIO * 100}%`,

    "Validation ratio":
      `${VALIDATION_RATIO * 100}%`,

    "Test ratio":
      `${round(
        (
          1 -
          TRAIN_RATIO -
          VALIDATION_RATIO
        ) *
          100,
        2,
      )}%`,
  });

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
      `Yeterli historical maç bulunamadı: ${matches.length}`,
    );
  }

  const rows:
    AnalysisRow[] =
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

      const strongestNonDraw =
        Math.max(
          probabilities.home,
          probabilities.away,
        );

      const actualOutcome =
        actualOutcomeFromScore(
          match.homeScore,
          match.awayScore,
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

        actualOutcome,

        isDraw:
          actualOutcome ===
          "DRAW",

        homeProbability:
          probabilities.home,

        drawProbability:
          probabilities.draw,

        awayProbability:
          probabilities.away,

        strongestNonDraw,

        drawGap:
          round(
            strongestNonDraw -
            probabilities.draw,
          ),

        homeAwayGap:
          round(
            Math.abs(
              probabilities.home -
              probabilities.away,
            ),
          ),

        expectedHomeGoals:
          result
            .expectedGoals
            .home,

        expectedAwayGoals:
          result
            .expectedGoals
            .away,

        totalXg:
          round(
            result
              .expectedGoals
              .home +
              result
                .expectedGoals
                .away,
          ),

        xgGap:
          round(
            Math.abs(
              result
                .expectedGoals
                .home -
              result
                .expectedGoals
                .away,
            ),
          ),
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
    "DATASET SUMMARY",
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

    "TRAIN draws":
      trainRows.filter(
        (
          row,
        ) =>
          row.isDraw,
      ).length,

    "VALIDATION draws":
      validationRows.filter(
        (
          row,
        ) =>
          row.isDraw,
      ).length,

    "TEST draws":
      testRows.filter(
        (
          row,
        ) =>
          row.isDraw,
      ).length,
  });

  const rules =
    createRules();

  const leagueMap =
    new Map<
      number,
      string
    >();

  for (
    const row
    of rows
  ) {
    leagueMap.set(
      row.leagueApiId,
      row.leagueName,
    );
  }

  const trainResults:
    RuleResult[] =
      [];

  const validationResults:
    RuleResult[] =
      [];

  const testResults:
    RuleResult[] =
      [];

  for (
    const [
      leagueApiId,
      leagueName,
    ]
    of leagueMap.entries()
  ) {
    trainResults.push(
      ...evaluateRules({
        rows,

        leagueApiId,

        leagueName,

        dataset:
          "TRAIN",

        rules,
      }),
    );

    validationResults.push(
      ...evaluateRules({
        rows,

        leagueApiId,

        leagueName,

        dataset:
          "VALIDATION",

        rules,
      }),
    );

    testResults.push(
      ...evaluateRules({
        rows,

        leagueApiId,

        leagueName,

        dataset:
          "TEST",

        rules,
      }),
    );
  }

  /*
   * ==================================================
   * BASE DRAW RATE
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEAGUE BASE DRAW RATES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    [
      ...leagueMap.entries(),
    ].map(
      (
        [
          leagueApiId,
          leagueName,
        ],
      ) => ({
        apiId:
          leagueApiId,

        league:
          leagueName,

        train:
          getLeagueBaseDrawRate(
            rows,
            leagueApiId,
            "TRAIN",
          ),

        validation:
          getLeagueBaseDrawRate(
            rows,
            leagueApiId,
            "VALIDATION",
          ),

        test:
          getLeagueBaseDrawRate(
            rows,
            leagueApiId,
            "TEST",
          ),
      }),
    ),
  );

  /*
   * ==================================================
   * TRAIN + VALIDATION CANDIDATE SEARCH
   * ==================================================
   */

  const candidateRanking =
    buildCandidateRanking({
      train:
        trainResults,

      validation:
        validationResults,

      minimumTrainMatches:
        25,

      minimumValidationMatches:
        10,
    });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TOP LEAGUE-AWARE DRAW CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    candidateRanking.slice(
      0,
      50,
    ),
  );

  /*
   * ==================================================
   * STABLE POSITIVE CANDIDATES
   * ==================================================
   */

  const stableCandidates =
    candidateRanking.filter(
      (
        candidate,
      ) =>
        candidate.positiveBoth ===
          "YES" &&
        Number(
          candidate.validationUplift,
        ) >=
          3 &&
        Number(
          candidate.trainUplift,
        ) >=
          2 &&
        Number(
          candidate.stabilityGap,
        ) <=
          10,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "STABLE POSITIVE CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  if (
    stableCandidates.length ===
    0
  ) {
    console.log(
      "Stabil pozitif aday bulunamadı.",
    );
  } else {
    console.table(
      stableCandidates.slice(
        0,
        30,
      ),
    );
  }

  /*
   * ==================================================
   * TEST AUDIT
   * ==================================================
   *
   * TEST, aday SEÇMEK için kullanılmıyor.
   *
   * Sadece TRAIN + VALIDATION ile seçilmiş
   * adayların gerçekten bağımsız testte
   * nasıl davrandığını gösteriyoruz.
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "INDEPENDENT TEST AUDIT OF STABLE CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  const testAudit =
    stableCandidates.map(
      (
        candidate,
      ) => {
        const leagueApiId =
          Number(
            candidate.leagueApiId,
          );

        const rule =
          String(
            candidate.rule,
          );

        const testResult =
          testResults.find(
            (
              result,
            ) =>
              result.leagueApiId ===
                leagueApiId &&
              result.rule ===
                rule,
          );

        if (
          !testResult
        ) {
          return {
            league:
              candidate.league,

            rule,

            trainRate:
              candidate.trainDrawRate,

            validationRate:
              candidate.validationDrawRate,

            testMatches:
              0,

            testRate:
              0,

            testUplift:
              0,
          };
        }

        return {
          league:
            candidate.league,

          rule,

          trainMatches:
            candidate.trainMatches,

          trainRate:
            candidate.trainDrawRate,

          trainUplift:
            candidate.trainUplift,

          validationMatches:
            candidate.validationMatches,

          validationRate:
            candidate.validationDrawRate,

          validationUplift:
            candidate.validationUplift,

          testMatches:
            testResult.matches,

          testRate:
            testResult.drawRate,

          testUplift:
            testResult.uplift,
        };
      },
    );

  if (
    testAudit.length ===
    0
  ) {
    console.log(
      "Test audit için stabil aday yok.",
    );
  } else {
    console.table(
      testAudit,
    );
  }

  /*
   * ==================================================
   * ALL VALIDATION POSITIVE RULES
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALIDATION POSITIVE RULES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    validationResults
      .filter(
        (
          result,
        ) =>
          result.matches >=
            10 &&
          result.uplift >
            0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.uplift -
          left.uplift,
      )
      .slice(
        0,
        50,
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

    Rules:
      rules.length,

    Leagues:
      leagueMap.size,

    "Candidate count":
      candidateRanking.length,

    "Stable candidates":
      stableCandidates.length,

    "Independent test audited":
      testAudit.length,
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
    "LEAGUE-AWARE DRAW MODEL V2 ANALYSIS TAMAMLANDI",
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
        "League-Aware DRAW Model V2 analizi başarısız.",
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
import {
  prisma,
} from "@/lib/prisma";

import type {
  GoalExpectation,
  GoalLineProbability,
  GoalProbabilityModelConfig,
  GoalProbabilityResolvedConfig,
  GoalProbabilityResult,
  ScoreProbability,
} from "./types";

const MODEL_NAME =
  "venue-strength-poisson";

const MODEL_VERSION =
  "v0.4-cross-season";

const MAX_GOALS =
  6;

const GOAL_LINES = [
  0.5,
  1.5,
  2.5,
  3.5,
  4.5,
] as const;

/*
 * Optimize edilmiş mevcut değerleri
 * V0.4'te değiştirmiyoruz.
 *
 * Önce yalnızca historical coverage
 * problemini çözüyoruz.
 */
const DEFAULT_SMOOTHING_MATCHES =
  5;

const DEFAULT_RECENCY_DECAY =
  1;

const DEFAULT_DIXON_COLES_RHO =
  0;

/*
 * Takım bazında son 20 uygun venue maçı.
 *
 * Sezon sınırı yoktur.
 * En yeni historical maçlar kullanılır.
 */
const MAX_TEAM_HISTORY =
  20;

/*
 * Lig ortalaması için son 500 bitmiş maç.
 *
 * Böylece çok eski dönemlerin lig
 * ortalamasına gereksiz etkisini azaltıyoruz.
 */
const MAX_LEAGUE_HISTORY =
  500;

const MIN_EXPECTED_GOALS =
  0.15;

const MAX_EXPECTED_GOALS =
  4.5;

type HistoricalMatch = {
  kickoffAt: Date;

  homeTeamId: number;
  awayTeamId: number;

  homeScore: number | null;
  awayScore: number | null;
};

type WeightedAverageResult = {
  matches: number;

  scoredAverage: number;
  concededAverage: number;

  effectiveWeight: number;
};

type TeamVenueProfile = {
  matches: number;

  scoredAverage: number;
  concededAverage: number;

  smoothedScored: number;
  smoothedConceded: number;

  attackStrength: number;
  defenceWeakness: number;
};

type LeagueGoalProfile = {
  matches: number;

  homeGoalsAverage: number;
  awayGoalsAverage: number;
};

function round(
  value: number,
  decimals = 4,
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

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function factorial(
  value: number,
): number {
  if (
    value <=
    1
  ) {
    return 1;
  }

  let result =
    1;

  for (
    let index =
      2;

    index <=
    value;

    index +=
      1
  ) {
    result *=
      index;
  }

  return result;
}

function poissonProbability(
  goals: number,
  lambda: number,
): number {
  return (
    Math.exp(
      -lambda,
    ) *
    lambda ** goals /
    factorial(
      goals,
    )
  );
}

function resolveConfiguration(
  config?:
    GoalProbabilityModelConfig,
): GoalProbabilityResolvedConfig {
  const smoothingMatches =
    config
      ?.smoothingMatches ??
    DEFAULT_SMOOTHING_MATCHES;

  const recencyDecay =
    config
      ?.recencyDecay ??
    DEFAULT_RECENCY_DECAY;

  const dixonColesRho =
    config
      ?.dixonColesRho ??
    DEFAULT_DIXON_COLES_RHO;

  if (
    !Number.isFinite(
      smoothingMatches,
    ) ||
    smoothingMatches <
      0
  ) {
    throw new Error(
      "smoothingMatches negatif olamaz.",
    );
  }

  if (
    !Number.isFinite(
      recencyDecay,
    ) ||
    recencyDecay <=
      0 ||
    recencyDecay >
      1
  ) {
    throw new Error(
      "recencyDecay 0'dan büyük ve 1'den küçük veya eşit olmalıdır.",
    );
  }

  if (
    !Number.isFinite(
      dixonColesRho,
    ) ||
    dixonColesRho <
      -0.5 ||
    dixonColesRho >
      0.5
  ) {
    throw new Error(
      "dixonColesRho -0.5 ile 0.5 arasında olmalıdır.",
    );
  }

  return {
    smoothingMatches,
    recencyDecay,
    dixonColesRho,
  };
}

function calculateWeightedTeamAverage(
  options: {
    matches:
      HistoricalMatch[];

    teamId:
      number;

    recencyDecay:
      number;
  },
): WeightedAverageResult {
  if (
    options.matches.length ===
    0
  ) {
    return {
      matches:
        0,

      scoredAverage:
        0,

      concededAverage:
        0,

      effectiveWeight:
        0,
    };
  }

  let scoredWeighted =
    0;

  let concededWeighted =
    0;

  let totalWeight =
    0;

  let validMatches =
    0;

  for (
    let index =
      0;

    index <
    options.matches.length;

    index +=
      1
  ) {
    const match =
      options.matches[
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

    /*
     * matches DESC sıralı geldiği için
     * index=0 en yeni historical maçtır.
     */
    const weight =
      options.recencyDecay **
      index;

    let scored:
      number;

    let conceded:
      number;

    if (
      match.homeTeamId ===
      options.teamId
    ) {
      scored =
        match.homeScore;

      conceded =
        match.awayScore;
    } else {
      scored =
        match.awayScore;

      conceded =
        match.homeScore;
    }

    scoredWeighted +=
      scored *
      weight;

    concededWeighted +=
      conceded *
      weight;

    totalWeight +=
      weight;

    validMatches +=
      1;
  }

  if (
    totalWeight <=
    0
  ) {
    return {
      matches:
        0,

      scoredAverage:
        0,

      concededAverage:
        0,

      effectiveWeight:
        0,
    };
  }

  return {
    matches:
      validMatches,

    scoredAverage:
      scoredWeighted /
      totalWeight,

    concededAverage:
      concededWeighted /
      totalWeight,

    effectiveWeight:
      totalWeight,
  };
}

function smoothAverage(
  options: {
    observedAverage:
      number;

    observedWeight:
      number;

    leagueAverage:
      number;

    smoothingMatches:
      number;
  },
): number {
  if (
    options.observedWeight <=
    0
  ) {
    return (
      options.leagueAverage
    );
  }

  const denominator =
    options.observedWeight +
    options.smoothingMatches;

  if (
    denominator <=
    0
  ) {
    return (
      options.leagueAverage
    );
  }

  return (
    (
      options.observedAverage *
        options.observedWeight +
      options.leagueAverage *
        options.smoothingMatches
    ) /
    denominator
  );
}

/*
 * ==================================================
 * V0.4 CROSS-SEASON LEAGUE HISTORY
 * ==================================================
 *
 * V0.3:
 *
 *   seasonId = current season
 *
 * V0.4:
 *
 *   same leagueId
 *   + FINISHED
 *   + kickoffAt < prediction kickoff
 *
 * Bu sayede 2026 sezonunun ilk maçında
 * 2024 historical lig verisine ulaşılabilir.
 *
 * 2025 season kaydı boşsa otomatik olarak
 * hiçbir özel işlem yapmadan atlanır.
 */
async function calculateLeagueGoalProfile(
  options: {
    leagueId:
      number;

    beforeDate:
      Date;
  },
): Promise<LeagueGoalProfile> {
  const matches =
    await prisma
      .match
      .findMany({
        where: {
          season: {
            leagueId:
              options.leagueId,
          },

          status:
            "FINISHED",

          /*
           * DATA LEAKAGE KORUMASI
           *
           * Tahmin edilen maçın kickoff
           * zamanından sonraki hiçbir maç
           * historical veri olamaz.
           */
          kickoffAt: {
            lt:
              options.beforeDate,
          },

          homeScore: {
            not:
              null,
          },

          awayScore: {
            not:
              null,
          },
        },

        select: {
          homeScore:
            true,

          awayScore:
            true,
        },

        /*
         * Son 500 lig maçı.
         */
        orderBy: {
          kickoffAt:
            "desc",
        },

        take:
          MAX_LEAGUE_HISTORY,
      });

  if (
    matches.length ===
    0
  ) {
    /*
     * Hiç historical league data
     * bulunamazsa eski güvenli fallback.
     */
    return {
      matches:
        0,

      homeGoalsAverage:
        1.45,

      awayGoalsAverage:
        1.15,
    };
  }

  let homeGoals =
    0;

  let awayGoals =
    0;

  let validMatches =
    0;

  for (
    const match
    of matches
  ) {
    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    homeGoals +=
      match.homeScore;

    awayGoals +=
      match.awayScore;

    validMatches +=
      1;
  }

  if (
    validMatches ===
    0
  ) {
    return {
      matches:
        0,

      homeGoalsAverage:
        1.45,

      awayGoalsAverage:
        1.15,
    };
  }

  return {
    matches:
      validMatches,

    homeGoalsAverage:
      homeGoals /
      validMatches,

    awayGoalsAverage:
      awayGoals /
      validMatches,
  };
}

/*
 * ==================================================
 * V0.4 CROSS-SEASON HOME VENUE HISTORY
 * ==================================================
 *
 * Takımın aynı ligdeki son 20 iç saha
 * FINISHED maçı alınır.
 *
 * Sezon sınırı yoktur.
 */
async function calculateHomeTeamProfile(
  options: {
    teamId:
      number;

    leagueId:
      number;

    beforeDate:
      Date;

    leagueHomeGoalsAverage:
      number;

    leagueAwayGoalsAverage:
      number;

    configuration:
      GoalProbabilityResolvedConfig;
  },
): Promise<TeamVenueProfile> {
  const matches =
    await prisma
      .match
      .findMany({
        where: {
          season: {
            leagueId:
              options.leagueId,
          },

          status:
            "FINISHED",

          /*
           * DATA LEAKAGE KORUMASI
           */
          kickoffAt: {
            lt:
              options.beforeDate,
          },

          homeScore: {
            not:
              null,
          },

          awayScore: {
            not:
              null,
          },

          homeTeamId:
            options.teamId,
        },

        select: {
          kickoffAt:
            true,

          homeTeamId:
            true,

          awayTeamId:
            true,

          homeScore:
            true,

          awayScore:
            true,
        },

        orderBy: {
          kickoffAt:
            "desc",
        },

        take:
          MAX_TEAM_HISTORY,
      });

  const average =
    calculateWeightedTeamAverage({
      matches,

      teamId:
        options.teamId,

      recencyDecay:
        options
          .configuration
          .recencyDecay,
    });

  const smoothedScored =
    smoothAverage({
      observedAverage:
        average.scoredAverage,

      observedWeight:
        average.effectiveWeight,

      leagueAverage:
        options
          .leagueHomeGoalsAverage,

      smoothingMatches:
        options
          .configuration
          .smoothingMatches,
    });

  const smoothedConceded =
    smoothAverage({
      observedAverage:
        average.concededAverage,

      observedWeight:
        average.effectiveWeight,

      leagueAverage:
        options
          .leagueAwayGoalsAverage,

      smoothingMatches:
        options
          .configuration
          .smoothingMatches,
    });

  const safeHomeAverage =
    Math.max(
      options
        .leagueHomeGoalsAverage,
      0.1,
    );

  const safeAwayAverage =
    Math.max(
      options
        .leagueAwayGoalsAverage,
      0.1,
    );

  return {
    matches:
      average.matches,

    scoredAverage:
      average.matches >
      0
        ? average
            .scoredAverage
        : options
            .leagueHomeGoalsAverage,

    concededAverage:
      average.matches >
      0
        ? average
            .concededAverage
        : options
            .leagueAwayGoalsAverage,

    smoothedScored,

    smoothedConceded,

    attackStrength:
      smoothedScored /
      safeHomeAverage,

    defenceWeakness:
      smoothedConceded /
      safeAwayAverage,
  };
}

/*
 * ==================================================
 * V0.4 CROSS-SEASON AWAY VENUE HISTORY
 * ==================================================
 *
 * Takımın aynı ligdeki son 20 deplasman
 * FINISHED maçı alınır.
 */
async function calculateAwayTeamProfile(
  options: {
    teamId:
      number;

    leagueId:
      number;

    beforeDate:
      Date;

    leagueHomeGoalsAverage:
      number;

    leagueAwayGoalsAverage:
      number;

    configuration:
      GoalProbabilityResolvedConfig;
  },
): Promise<TeamVenueProfile> {
  const matches =
    await prisma
      .match
      .findMany({
        where: {
          season: {
            leagueId:
              options.leagueId,
          },

          status:
            "FINISHED",

          /*
           * DATA LEAKAGE KORUMASI
           */
          kickoffAt: {
            lt:
              options.beforeDate,
          },

          homeScore: {
            not:
              null,
          },

          awayScore: {
            not:
              null,
          },

          awayTeamId:
            options.teamId,
        },

        select: {
          kickoffAt:
            true,

          homeTeamId:
            true,

          awayTeamId:
            true,

          homeScore:
            true,

          awayScore:
            true,
        },

        orderBy: {
          kickoffAt:
            "desc",
        },

        take:
          MAX_TEAM_HISTORY,
      });

  const average =
    calculateWeightedTeamAverage({
      matches,

      teamId:
        options.teamId,

      recencyDecay:
        options
          .configuration
          .recencyDecay,
    });

  const smoothedScored =
    smoothAverage({
      observedAverage:
        average.scoredAverage,

      observedWeight:
        average.effectiveWeight,

      leagueAverage:
        options
          .leagueAwayGoalsAverage,

      smoothingMatches:
        options
          .configuration
          .smoothingMatches,
    });

  const smoothedConceded =
    smoothAverage({
      observedAverage:
        average.concededAverage,

      observedWeight:
        average.effectiveWeight,

      leagueAverage:
        options
          .leagueHomeGoalsAverage,

      smoothingMatches:
        options
          .configuration
          .smoothingMatches,
    });

  const safeHomeAverage =
    Math.max(
      options
        .leagueHomeGoalsAverage,
      0.1,
    );

  const safeAwayAverage =
    Math.max(
      options
        .leagueAwayGoalsAverage,
      0.1,
    );

  return {
    matches:
      average.matches,

    scoredAverage:
      average.matches >
      0
        ? average
            .scoredAverage
        : options
            .leagueAwayGoalsAverage,

    concededAverage:
      average.matches >
      0
        ? average
            .concededAverage
        : options
            .leagueHomeGoalsAverage,

    smoothedScored,

    smoothedConceded,

    attackStrength:
      smoothedScored /
      safeAwayAverage,

    defenceWeakness:
      smoothedConceded /
      safeHomeAverage,
  };
}

function calculateExpectedGoals(
  options: {
    league:
      LeagueGoalProfile;

    home:
      TeamVenueProfile;

    away:
      TeamVenueProfile;
  },
): GoalExpectation {
  const rawHome =
    options
      .league
      .homeGoalsAverage *
    options
      .home
      .attackStrength *
    options
      .away
      .defenceWeakness;

  const rawAway =
    options
      .league
      .awayGoalsAverage *
    options
      .away
      .attackStrength *
    options
      .home
      .defenceWeakness;

  return {
    home:
      round(
        clamp(
          rawHome,
          MIN_EXPECTED_GOALS,
          MAX_EXPECTED_GOALS,
        ),
      ),

    away:
      round(
        clamp(
          rawAway,
          MIN_EXPECTED_GOALS,
          MAX_EXPECTED_GOALS,
        ),
      ),
  };
}

function dixonColesAdjustment(
  options: {
    homeGoals:
      number;

    awayGoals:
      number;

    homeLambda:
      number;

    awayLambda:
      number;

    rho:
      number;
  },
): number {
  const {
    homeGoals,
    awayGoals,
    homeLambda,
    awayLambda,
    rho,
  } =
    options;

  if (
    homeGoals ===
      0 &&
    awayGoals ===
      0
  ) {
    return Math.max(
      0.01,

      1 -
        homeLambda *
          awayLambda *
          rho,
    );
  }

  if (
    homeGoals ===
      0 &&
    awayGoals ===
      1
  ) {
    return Math.max(
      0.01,

      1 +
        homeLambda *
          rho,
    );
  }

  if (
    homeGoals ===
      1 &&
    awayGoals ===
      0
  ) {
    return Math.max(
      0.01,

      1 +
        awayLambda *
          rho,
    );
  }

  if (
    homeGoals ===
      1 &&
    awayGoals ===
      1
  ) {
    return Math.max(
      0.01,

      1 -
        rho,
    );
  }

  return 1;
}

function buildScoreMatrix(
  options: {
    expectation:
      GoalExpectation;

    dixonColesRho:
      number;
  },
): ScoreProbability[] {
  const scores:
    ScoreProbability[] =
      [];

  let totalProbability =
    0;

  for (
    let homeGoals =
      0;

    homeGoals <=
    MAX_GOALS;

    homeGoals +=
      1
  ) {
    const homeProbability =
      poissonProbability(
        homeGoals,
        options
          .expectation
          .home,
      );

    for (
      let awayGoals =
        0;

      awayGoals <=
      MAX_GOALS;

      awayGoals +=
        1
    ) {
      const awayProbability =
        poissonProbability(
          awayGoals,
          options
            .expectation
            .away,
        );

      const baseProbability =
        homeProbability *
        awayProbability;

      const adjustment =
        dixonColesAdjustment({
          homeGoals,

          awayGoals,

          homeLambda:
            options
              .expectation
              .home,

          awayLambda:
            options
              .expectation
              .away,

          rho:
            options
              .dixonColesRho,
        });

      const probability =
        baseProbability *
        adjustment;

      totalProbability +=
        probability;

      scores.push({
        homeGoals,

        awayGoals,

        probability,
      });
    }
  }

  if (
    totalProbability <=
      0 ||
    !Number.isFinite(
      totalProbability,
    )
  ) {
    throw new Error(
      "Score probability matrix normalize edilemedi.",
    );
  }

  return scores.map(
    (
      score,
    ) => ({
      ...score,

      probability:
        score.probability /
        totalProbability,
    }),
  );
}

function calculateGoalLines(
  scores:
    ScoreProbability[],
): GoalLineProbability[] {
  return GOAL_LINES.map(
    (
      line,
    ) => {
      const over =
        scores
          .filter(
            (
              score,
            ) =>
              score.homeGoals +
                score.awayGoals >
              line,
          )
          .reduce(
            (
              total,
              score,
            ) =>
              total +
              score.probability,
            0,
          );

      return {
        line,

        over:
          round(
            over *
              100,
            2,
          ),

        under:
          round(
            (
              1 -
              over
            ) *
              100,
            2,
          ),
      };
    },
  );
}

export async function calculateGoalProbabilities(
  matchId: number,
  config?:
    GoalProbabilityModelConfig,
): Promise<GoalProbabilityResult> {
  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <=
      0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const configuration =
    resolveConfiguration(
      config,
    );

  /*
   * V0.4 için seasonId yanında
   * leagueId'yi de alıyoruz.
   */
  const match =
    await prisma
      .match
      .findUnique({
        where: {
          id:
            matchId,
        },

        select: {
          id:
            true,

          seasonId:
            true,

          kickoffAt:
            true,

          homeTeamId:
            true,

          awayTeamId:
            true,

          season: {
            select: {
              id:
                true,

              year:
                true,

              leagueId:
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
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  /*
   * ==================================================
   * CROSS-SEASON HISTORICAL DATA
   * ==================================================
   */

  const league =
    await calculateLeagueGoalProfile({
      leagueId:
        match
          .season
          .leagueId,

      beforeDate:
        match.kickoffAt,
    });

  const [
    home,
    away,
  ] =
    await Promise.all([
      calculateHomeTeamProfile({
        teamId:
          match.homeTeamId,

        leagueId:
          match
            .season
            .leagueId,

        beforeDate:
          match.kickoffAt,

        leagueHomeGoalsAverage:
          league
            .homeGoalsAverage,

        leagueAwayGoalsAverage:
          league
            .awayGoalsAverage,

        configuration,
      }),

      calculateAwayTeamProfile({
        teamId:
          match.awayTeamId,

        leagueId:
          match
            .season
            .leagueId,

        beforeDate:
          match.kickoffAt,

        leagueHomeGoalsAverage:
          league
            .homeGoalsAverage,

        leagueAwayGoalsAverage:
          league
            .awayGoalsAverage,

        configuration,
      }),
    ]);

  const expectedGoals =
    calculateExpectedGoals({
      league,

      home,

      away,
    });

  const scoreProbabilities =
    buildScoreMatrix({
      expectation:
        expectedGoals,

      dixonColesRho:
        configuration
          .dixonColesRho,
    });

  let homeProbability =
    0;

  let drawProbability =
    0;

  let awayProbability =
    0;

  let bttsYes =
    0;

  for (
    const score
    of scoreProbabilities
  ) {
    if (
      score.homeGoals >
      score.awayGoals
    ) {
      homeProbability +=
        score.probability;
    } else if (
      score.homeGoals ===
      score.awayGoals
    ) {
      drawProbability +=
        score.probability;
    } else {
      awayProbability +=
        score.probability;
    }

    if (
      score.homeGoals >
        0 &&
      score.awayGoals >
        0
    ) {
      bttsYes +=
        score.probability;
    }
  }

  const warnings:
    string[] =
      [];

  if (
    league.matches <
    20
  ) {
    warnings.push(
      `Lig geçmiş maç sayısı düşük: ${league.matches}.`,
    );
  }

  if (
    home.matches <
    5
  ) {
    warnings.push(
      `Ev sahibinin iç saha geçmiş maç sayısı düşük: ${home.matches}.`,
    );
  }

  if (
    away.matches <
    5
  ) {
    warnings.push(
      `Deplasmanın deplasman geçmiş maç sayısı düşük: ${away.matches}.`,
    );
  }

  /*
   * V0.4 diagnostic uyarıları.
   */
  if (
    league.matches ===
    0
  ) {
    warnings.push(
      "Cross-season lig historical verisi bulunamadı; default lig gol ortalaması kullanıldı.",
    );
  }

  if (
    home.matches ===
      0 &&
    away.matches ===
      0
  ) {
    warnings.push(
      "Her iki takım için de aynı ligde cross-season venue geçmişi bulunamadı.",
    );
  }

  const mostLikelyScores =
    [
      ...scoreProbabilities,
    ]
      .sort(
        (
          left,
          right,
        ) =>
          right.probability -
          left.probability,
      )
      .slice(
        0,
        10,
      )
      .map(
        (
          score,
        ) => ({
          ...score,

          probability:
            round(
              score.probability *
                100,
              2,
            ),
        }),
      );

  return {
    matchId:
      match.id,

    expectedGoals,

    scoreProbabilities,

    outcomeProbabilities: {
      home:
        round(
          homeProbability *
            100,
          2,
        ),

      draw:
        round(
          drawProbability *
            100,
          2,
        ),

      away:
        round(
          awayProbability *
            100,
          2,
        ),
    },

    btts: {
      yes:
        round(
          bttsYes *
            100,
          2,
        ),

      no:
        round(
          (
            1 -
            bttsYes
          ) *
            100,
          2,
        ),
    },

    totals:
      calculateGoalLines(
        scoreProbabilities,
      ),

    mostLikelyScores,

    dataQuality: {
      leagueMatches:
        league.matches,

      homeVenueMatches:
        home.matches,

      awayVenueMatches:
        away.matches,

      minimumVenueMatches:
        Math.min(
          home.matches,
          away.matches,
        ),

      averageVenueMatches:
        round(
          (
            home.matches +
            away.matches
          ) /
            2,
          2,
        ),
    },

    model: {
      name:
        MODEL_NAME,

      version:
        MODEL_VERSION,

      configuration,
    },

    warnings,
  };
}
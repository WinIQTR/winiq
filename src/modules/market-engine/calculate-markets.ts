import type {
  GoalProbabilityResult,
  ScoreProbability,
} from "@/modules/goal-probability-engine";

import type {
  MarketEngineResult,
  MarketSelection,
} from "./types";

const MODEL_NAME =
  "score-matrix-market-engine";

const MODEL_VERSION =
  "v1.1-50-selections";

const TOTAL_GOAL_LINES = [
  0.5,
  1.5,
  2.5,
  3.5,
  4.5,
  5.5,
] as const;

const TEAM_GOAL_LINES = [
  0.5,
  1.5,
  2.5,
  3.5,
] as const;

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) /
    factor
  );
}

function percentage(
  probability: number,
): number {
  return round(
    probability * 100,
    2,
  );
}

function fairOdds(
  probabilityPercentage:
    number,
): number | null {
  if (
    !Number.isFinite(
      probabilityPercentage,
    ) ||
    probabilityPercentage <=
      0
  ) {
    return null;
  }

  return round(
    100 /
      probabilityPercentage,
    2,
  );
}

function createSelection(
  options: {
    key:
      string;

    category:
      MarketSelection["category"];

    market:
      string;

    selection:
      string;

    probability:
      number;
  },
): MarketSelection {
  const normalizedProbability =
    Math.min(
      Math.max(
        options.probability,
        0,
      ),
      1,
    );

  const probability =
    percentage(
      normalizedProbability,
    );

  return {
    key:
      options.key,

    category:
      options.category,

    market:
      options.market,

    selection:
      options.selection,

    probability,

    fairOdds:
      fairOdds(
        probability,
      ),
  };
}

function sumProbability(
  scores:
    ScoreProbability[],

  predicate:
    (
      score:
        ScoreProbability,
    ) => boolean,
): number {
  return scores
    .filter(
      predicate,
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
}

/*
 * ============================================================
 * MATCH RESULT
 * ============================================================
 */

function calculateMatchResult(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const home =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >
        score.awayGoals,
    );

  const draw =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals ===
        score.awayGoals,
    );

  const away =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals <
        score.awayGoals,
    );

  return [
    createSelection({
      key:
        "match_result_home",

      category:
        "MATCH_RESULT",

      market:
        "Match Result",

      selection:
        "HOME",

      probability:
        home,
    }),

    createSelection({
      key:
        "match_result_draw",

      category:
        "MATCH_RESULT",

      market:
        "Match Result",

      selection:
        "DRAW",

      probability:
        draw,
    }),

    createSelection({
      key:
        "match_result_away",

      category:
        "MATCH_RESULT",

      market:
        "Match Result",

      selection:
        "AWAY",

      probability:
        away,
    }),
  ];
}

/*
 * ============================================================
 * DOUBLE CHANCE
 * ============================================================
 */

function calculateDoubleChance(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const homeOrDraw =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >=
        score.awayGoals,
    );

  const awayOrDraw =
    sumProbability(
      scores,
      (score) =>
        score.awayGoals >=
        score.homeGoals,
    );

  const homeOrAway =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals !==
        score.awayGoals,
    );

  return [
    createSelection({
      key:
        "double_chance_1x",

      category:
        "DOUBLE_CHANCE",

      market:
        "Double Chance",

      selection:
        "1X",

      probability:
        homeOrDraw,
    }),

    createSelection({
      key:
        "double_chance_x2",

      category:
        "DOUBLE_CHANCE",

      market:
        "Double Chance",

      selection:
        "X2",

      probability:
        awayOrDraw,
    }),

    createSelection({
      key:
        "double_chance_12",

      category:
        "DOUBLE_CHANCE",

      market:
        "Double Chance",

      selection:
        "12",

      probability:
        homeOrAway,
    }),
  ];
}

/*
 * ============================================================
 * DRAW NO BET
 * ============================================================
 */

function calculateDrawNoBet(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const home =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >
        score.awayGoals,
    );

  const away =
    sumProbability(
      scores,
      (score) =>
        score.awayGoals >
        score.homeGoals,
    );

  const decisive =
    home +
    away;

  if (
    decisive <=
    0
  ) {
    return [];
  }

  return [
    createSelection({
      key:
        "dnb_home",

      category:
        "DRAW_NO_BET",

      market:
        "Draw No Bet",

      selection:
        "HOME",

      probability:
        home /
        decisive,
    }),

    createSelection({
      key:
        "dnb_away",

      category:
        "DRAW_NO_BET",

      market:
        "Draw No Bet",

      selection:
        "AWAY",

      probability:
        away /
        decisive,
    }),
  ];
}

/*
 * ============================================================
 * TOTAL GOALS
 * ============================================================
 */

function calculateTotalGoals(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const selections:
    MarketSelection[] =
      [];

  for (
    const line
    of TOTAL_GOAL_LINES
  ) {
    const over =
      sumProbability(
        scores,
        (score) =>
          score.homeGoals +
            score.awayGoals >
          line,
      );

    const under =
      sumProbability(
        scores,
        (score) =>
          score.homeGoals +
            score.awayGoals <
          line,
      );

    selections.push(
      createSelection({
        key:
          `total_goals_over_${line}`,

        category:
          "TOTAL_GOALS",

        market:
          `Total Goals ${line}`,

        selection:
          "OVER",

        probability:
          over,
      }),
    );

    selections.push(
      createSelection({
        key:
          `total_goals_under_${line}`,

        category:
          "TOTAL_GOALS",

        market:
          `Total Goals ${line}`,

        selection:
          "UNDER",

        probability:
          under,
      }),
    );
  }

  return selections;
}

/*
 * ============================================================
 * TEAM GOALS
 * ============================================================
 */

function calculateTeamGoals(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const selections:
    MarketSelection[] =
      [];

  for (
    const line
    of TEAM_GOAL_LINES
  ) {
    const homeOver =
      sumProbability(
        scores,
        (score) =>
          score.homeGoals >
          line,
      );

    const homeUnder =
      sumProbability(
        scores,
        (score) =>
          score.homeGoals <
          line,
      );

    const awayOver =
      sumProbability(
        scores,
        (score) =>
          score.awayGoals >
          line,
      );

    const awayUnder =
      sumProbability(
        scores,
        (score) =>
          score.awayGoals <
          line,
      );

    selections.push(
      createSelection({
        key:
          `home_team_goals_over_${line}`,

        category:
          "TEAM_GOALS",

        market:
          `Home Team Goals ${line}`,

        selection:
          "OVER",

        probability:
          homeOver,
      }),
    );

    selections.push(
      createSelection({
        key:
          `home_team_goals_under_${line}`,

        category:
          "TEAM_GOALS",

        market:
          `Home Team Goals ${line}`,

        selection:
          "UNDER",

        probability:
          homeUnder,
      }),
    );

    selections.push(
      createSelection({
        key:
          `away_team_goals_over_${line}`,

        category:
          "TEAM_GOALS",

        market:
          `Away Team Goals ${line}`,

        selection:
          "OVER",

        probability:
          awayOver,
      }),
    );

    selections.push(
      createSelection({
        key:
          `away_team_goals_under_${line}`,

        category:
          "TEAM_GOALS",

        market:
          `Away Team Goals ${line}`,

        selection:
          "UNDER",

        probability:
          awayUnder,
      }),
    );
  }

  return selections;
}

/*
 * ============================================================
 * BTTS
 * ============================================================
 */

function calculateBtts(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const yes =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >
          0 &&
        score.awayGoals >
          0,
    );

  const no =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals ===
          0 ||
        score.awayGoals ===
          0,
    );

  return [
    createSelection({
      key:
        "btts_yes",

      category:
        "BTTS",

      market:
        "Both Teams To Score",

      selection:
        "YES",

      probability:
        yes,
    }),

    createSelection({
      key:
        "btts_no",

      category:
        "BTTS",

      market:
        "Both Teams To Score",

      selection:
        "NO",

      probability:
        no,
    }),
  ];
}

/*
 * ============================================================
 * CLEAN SHEET
 * ============================================================
 */

function calculateCleanSheet(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const homeCleanSheet =
    sumProbability(
      scores,
      (score) =>
        score.awayGoals ===
        0,
    );

  const awayCleanSheet =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals ===
        0,
    );

  return [
    createSelection({
      key:
        "home_clean_sheet_yes",

      category:
        "CLEAN_SHEET",

      market:
        "Home Clean Sheet",

      selection:
        "YES",

      probability:
        homeCleanSheet,
    }),

    createSelection({
      key:
        "home_clean_sheet_no",

      category:
        "CLEAN_SHEET",

      market:
        "Home Clean Sheet",

      selection:
        "NO",

      probability:
        1 -
        homeCleanSheet,
    }),

    createSelection({
      key:
        "away_clean_sheet_yes",

      category:
        "CLEAN_SHEET",

      market:
        "Away Clean Sheet",

      selection:
        "YES",

      probability:
        awayCleanSheet,
    }),

    createSelection({
      key:
        "away_clean_sheet_no",

      category:
        "CLEAN_SHEET",

      market:
        "Away Clean Sheet",

      selection:
        "NO",

      probability:
        1 -
        awayCleanSheet,
    }),
  ];
}

/*
 * ============================================================
 * WIN TO NIL
 * ============================================================
 */

function calculateWinToNil(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const homeWinToNil =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >
          score.awayGoals &&
        score.awayGoals ===
          0,
    );

  const awayWinToNil =
    sumProbability(
      scores,
      (score) =>
        score.awayGoals >
          score.homeGoals &&
        score.homeGoals ===
          0,
    );

  return [
    createSelection({
      key:
        "home_win_to_nil_yes",

      category:
        "WIN_TO_NIL",

      market:
        "Home Win To Nil",

      selection:
        "YES",

      probability:
        homeWinToNil,
    }),

    createSelection({
      key:
        "home_win_to_nil_no",

      category:
        "WIN_TO_NIL",

      market:
        "Home Win To Nil",

      selection:
        "NO",

      probability:
        1 -
        homeWinToNil,
    }),

    createSelection({
      key:
        "away_win_to_nil_yes",

      category:
        "WIN_TO_NIL",

      market:
        "Away Win To Nil",

      selection:
        "YES",

      probability:
        awayWinToNil,
    }),

    createSelection({
      key:
        "away_win_to_nil_no",

      category:
        "WIN_TO_NIL",

      market:
        "Away Win To Nil",

      selection:
        "NO",

      probability:
        1 -
        awayWinToNil,
    }),
  ];
}

/*
 * ============================================================
 * TOTAL GOALS ODD / EVEN
 * ============================================================
 */

function calculateOddEven(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const odd =
    sumProbability(
      scores,
      (score) =>
        (
          score.homeGoals +
          score.awayGoals
        ) %
          2 ===
        1,
    );

  const even =
    sumProbability(
      scores,
      (score) =>
        (
          score.homeGoals +
          score.awayGoals
        ) %
          2 ===
        0,
    );

  return [
    createSelection({
      key:
        "total_goals_odd",

      category:
        "ODD_EVEN",

      market:
        "Total Goals Odd/Even",

      selection:
        "ODD",

      probability:
        odd,
    }),

    createSelection({
      key:
        "total_goals_even",

      category:
        "ODD_EVEN",

      market:
        "Total Goals Odd/Even",

      selection:
        "EVEN",

      probability:
        even,
    }),
  ];
}

/*
 * ============================================================
 * BTTS + OVER 2.5
 * ============================================================
 */

function calculateBttsOver25(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const yes =
    sumProbability(
      scores,
      (score) =>
        score.homeGoals >
          0 &&
        score.awayGoals >
          0 &&
        score.homeGoals +
          score.awayGoals >
          2.5,
    );

  const no =
    sumProbability(
      scores,
      (score) =>
        !(
          score.homeGoals >
            0 &&
          score.awayGoals >
            0 &&
          score.homeGoals +
            score.awayGoals >
            2.5
        ),
    );

  return [
    createSelection({
      key:
        "btts_yes_over_2.5_yes",

      category:
        "COMBINED",

      market:
        "BTTS + Over 2.5",

      selection:
        "YES",

      probability:
        yes,
    }),

    createSelection({
      key:
        "btts_yes_over_2.5_no",

      category:
        "COMBINED",

      market:
        "BTTS + Over 2.5",

      selection:
        "NO",

      probability:
        no,
    }),
  ];
}

/*
 * ============================================================
 * CORRECT SCORE
 * ============================================================
 */

function calculateCorrectScore(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  // Skor matrisindeki en olası ilk 6 skoru "Doğru Skor" market'i
  // olarak sunuyoruz. Tüm olası skorları listelemek (0-0'dan 8-8'e
  // kadar) kullanıcı için anlamsız derecede uzun ve düşük olasılıklı
  // seçenekler ekler; en olası adaylarla sınırlamak daha kullanışlı.
  return [...scores]
    .sort(
      (left, right) =>
        right.probability -
        left.probability,
    )
    .slice(0, 6)
    .map((score) =>
      createSelection({
        key: `correct_score_${score.homeGoals}_${score.awayGoals}`,

        category: "CORRECT_SCORE",

        market: "Correct Score",

        selection: `${score.homeGoals}-${score.awayGoals}`,

        probability: score.probability,
      }),
    );
}

/*
 * ============================================================
 * ASIAN HANDICAP
 * ============================================================
 */

const ASIAN_HANDICAP_LINES = [
  -1.5,
  -0.5,
  0.5,
  1.5,
] as const;

function calculateAsianHandicap(
  scores:
    ScoreProbability[],
): MarketSelection[] {
  const selections: MarketSelection[] = [];

  for (const line of ASIAN_HANDICAP_LINES) {
    // Ev sahibi handikapı: homeGoals + line > awayGoals olursa kazanır.
    // Yarım (.5) çizgiler kullanıldığı için berabere/push senaryosu
    // matematiksel olarak oluşmaz.
    const homeCovers =
      sumProbability(
        scores,
        (score) =>
          score.homeGoals + line >
          score.awayGoals,
      );

    const awayCovers = 1 - homeCovers;

    const lineLabel =
      line > 0 ? `+${line}` : `${line}`;

    selections.push(
      createSelection({
        key: `asian_handicap_home_${line}`,
        category: "ASIAN_HANDICAP",
        market: `Asian Handicap (Home ${lineLabel})`,
        selection: "HOME",
        probability: homeCovers,
      }),
    );

    selections.push(
      createSelection({
        key: `asian_handicap_away_${line}`,
        category: "ASIAN_HANDICAP",
        market: `Asian Handicap (Home ${lineLabel})`,
        selection: "AWAY",
        probability: awayCovers,
      }),
    );
  }

  return selections;
}

/*
 * ============================================================
 * PUBLIC ENGINE
 * ============================================================
 */

export function calculateMarketsFromGoalModel(
  goalModel:
    GoalProbabilityResult,
): MarketEngineResult {
  const scores =
    goalModel
      .scoreProbabilities;

  if (
    scores.length ===
    0
  ) {
    throw new Error(
      "Market Engine için score probability matrix boş.",
    );
  }

  const selections:
    MarketSelection[] = [
      ...calculateMatchResult(
        scores,
      ),

      ...calculateDoubleChance(
        scores,
      ),

      ...calculateDrawNoBet(
        scores,
      ),

      ...calculateTotalGoals(
        scores,
      ),

      ...calculateTeamGoals(
        scores,
      ),

      ...calculateBtts(
        scores,
      ),

      ...calculateCleanSheet(
        scores,
      ),

      ...calculateWinToNil(
        scores,
      ),

      ...calculateOddEven(
        scores,
      ),

      ...calculateBttsOver25(
        scores,
      ),

      ...calculateCorrectScore(
        scores,
      ),

      ...calculateAsianHandicap(
        scores,
      ),
    ];

  const topSelections =
    [
      ...selections,
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
        15,
      );

  return {
    matchId:
      goalModel.matchId,

    selections,

    topSelections,

    model: {
      name:
        MODEL_NAME,

      version:
        MODEL_VERSION,
    },

    warnings: [
      ...goalModel.warnings,
    ],
  };
}
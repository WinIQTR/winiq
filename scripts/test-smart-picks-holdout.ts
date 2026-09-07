import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculateMarketsFromGoalModel,
} from "@/modules/market-engine";

import type {
  MarketSelection,
} from "@/modules/market-engine";

const SEASON_YEAR =
  2024;

const TRAIN_RATIO =
  0.7;

const TOP_PICKS_LIMIT =
  10;

const MINIMUM_PROBABILITY =
  60;

const MINIMUM_HISTORICAL_SAMPLES =
  200;

const MINIMUM_FAIR_ODDS =
  1.05;

const MAXIMUM_FAIR_ODDS =
  5;

type PickResult =
  | "WIN"
  | "LOSS"
  | "VOID";

type HistoricalMarketStats = {
  key: string;

  samples: number;
  wins: number;
  losses: number;
  voids: number;

  probabilityTotal: number;
  brierTotal: number;

  samples70: number;
  wins70: number;

  samples80: number;
  wins80: number;

  samples90: number;
  wins90: number;
};

type FrozenMarketProfile = {
  key: string;

  historicalSamples: number;

  averageProbability: number;
  historicalHitRate: number;

  calibrationGap: number;
  brier: number;

  samples70: number;
  hit70: number | null;

  samples80: number;
  hit80: number | null;

  samples90: number;
  hit90: number | null;
};

type CandidatePick = {
  key: string;

  category: string;

  market: string;
  selection: string;

  probability: number;
  fairOdds: number | null;

  historicalHitRate: number;
  historicalSamples: number;

  thresholdHitRate: number | null;
  thresholdSamples: number;

  reliabilityScore: number;
  pickScore: number;

  tier:
    | "VERY_HIGH"
    | "HIGH"
    | "MEDIUM"
    | "LOW";
};

type TierAccumulator = {
  picks: number;
  wins: number;
  losses: number;
  voids: number;
};

type LeagueAccumulator = {
  apiId: number;
  league: string;

  picks: number;
  wins: number;
  losses: number;
  voids: number;
};

type MarketValidationAccumulator = {
  key: string;

  market: string;
  selection: string;

  picks: number;
  wins: number;
  losses: number;
  voids: number;

  reliabilityTotal: number;
  probabilityTotal: number;
};

type ProbabilityBucketAccumulator = {
  key: string;
  label: string;

  minimum: number;
  maximum: number;

  picks: number;
  wins: number;
  losses: number;
  voids: number;

  probabilityTotal: number;
  reliabilityTotal: number;
};

const PROBABILITY_BUCKETS: Array<{
  key: string;
  label: string;
  minimum: number;
  maximum: number;
}> = [
  {
    key:
      "60_69",

    label:
      "60–69.9%",

    minimum:
      60,

    maximum:
      69.999,
  },

  {
    key:
      "70_79",

    label:
      "70–79.9%",

    minimum:
      70,

    maximum:
      79.999,
  },

  {
    key:
      "80_89",

    label:
      "80–89.9%",

    minimum:
      80,

    maximum:
      89.999,
  },

  {
    key:
      "90_100",

    label:
      "90–100%",

    minimum:
      90,

    maximum:
      100,
  },
];

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

function hitRate(
  wins: number,
  samples: number,
): number | null {
  if (
    samples <=
    0
  ) {
    return null;
  }

  return (
    wins /
    samples *
    100
  );
}

function getProbabilityBucket(
  probability: number,
): {
  key: string;
  label: string;
  minimum: number;
  maximum: number;
} | null {
  return (
    PROBABILITY_BUCKETS.find(
      (
        bucket,
      ) =>
        probability >=
          bucket.minimum &&
        probability <=
          bucket.maximum,
    ) ??
    null
  );
}

function resolveSelection(
  key: string,

  homeGoals: number,

  awayGoals: number,
): PickResult {
  const totalGoals =
    homeGoals +
    awayGoals;

  switch (
    key
  ) {
    case "match_result_home":
      return homeGoals >
        awayGoals
        ? "WIN"
        : "LOSS";

    case "match_result_draw":
      return homeGoals ===
        awayGoals
        ? "WIN"
        : "LOSS";

    case "match_result_away":
      return awayGoals >
        homeGoals
        ? "WIN"
        : "LOSS";

    case "double_chance_1x":
      return homeGoals >=
        awayGoals
        ? "WIN"
        : "LOSS";

    case "double_chance_x2":
      return awayGoals >=
        homeGoals
        ? "WIN"
        : "LOSS";

    case "double_chance_12":
      return homeGoals !==
        awayGoals
        ? "WIN"
        : "LOSS";

    case "dnb_home":
      if (
        homeGoals ===
        awayGoals
      ) {
        return "VOID";
      }

      return homeGoals >
        awayGoals
        ? "WIN"
        : "LOSS";

    case "dnb_away":
      if (
        homeGoals ===
        awayGoals
      ) {
        return "VOID";
      }

      return awayGoals >
        homeGoals
        ? "WIN"
        : "LOSS";

    case "total_goals_over_0.5":
      return totalGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_0.5":
      return totalGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_1.5":
      return totalGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_1.5":
      return totalGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_2.5":
      return totalGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_2.5":
      return totalGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_3.5":
      return totalGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_3.5":
      return totalGoals <
        3.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_4.5":
      return totalGoals >
        4.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_4.5":
      return totalGoals <
        4.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_5.5":
      return totalGoals >
        5.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_5.5":
      return totalGoals <
        5.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_0.5":
      return homeGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_0.5":
      return homeGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_1.5":
      return homeGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_1.5":
      return homeGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_2.5":
      return homeGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_2.5":
      return homeGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_3.5":
      return homeGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_3.5":
      return homeGoals <
        3.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_0.5":
      return awayGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_0.5":
      return awayGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_1.5":
      return awayGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_1.5":
      return awayGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_2.5":
      return awayGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_2.5":
      return awayGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_3.5":
      return awayGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_3.5":
      return awayGoals <
        3.5
        ? "WIN"
        : "LOSS";

    case "btts_yes":
      return (
        homeGoals >
          0 &&
        awayGoals >
          0
      )
        ? "WIN"
        : "LOSS";

    case "btts_no":
      return (
        homeGoals ===
          0 ||
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "home_clean_sheet_yes":
      return awayGoals ===
        0
        ? "WIN"
        : "LOSS";

    case "home_clean_sheet_no":
      return awayGoals >
        0
        ? "WIN"
        : "LOSS";

    case "away_clean_sheet_yes":
      return homeGoals ===
        0
        ? "WIN"
        : "LOSS";

    case "away_clean_sheet_no":
      return homeGoals >
        0
        ? "WIN"
        : "LOSS";

    case "home_win_to_nil_yes":
      return (
        homeGoals >
          awayGoals &&
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "home_win_to_nil_no":
      return !(
        homeGoals >
          awayGoals &&
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "away_win_to_nil_yes":
      return (
        awayGoals >
          homeGoals &&
        homeGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "away_win_to_nil_no":
      return !(
        awayGoals >
          homeGoals &&
        homeGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "total_goals_odd":
      return totalGoals %
          2 ===
        1
        ? "WIN"
        : "LOSS";

    case "total_goals_even":
      return totalGoals %
          2 ===
        0
        ? "WIN"
        : "LOSS";

    case "btts_yes_over_2.5_yes": {
      const happened =
        homeGoals >
          0 &&
        awayGoals >
          0 &&
        totalGoals >
          2.5;

      return happened
        ? "WIN"
        : "LOSS";
    }

    case "btts_yes_over_2.5_no": {
      const happened =
        homeGoals >
          0 &&
        awayGoals >
          0 &&
        totalGoals >
          2.5;

      return happened
        ? "LOSS"
        : "WIN";
    }

    default:
      throw new Error(
        `Resolution yok: ${key}`,
      );
  }
}

function updateHistoricalStats(
  stats:
    HistoricalMarketStats,

  selection:
    MarketSelection,

  result:
    PickResult,
): void {
  if (
    result ===
    "VOID"
  ) {
    stats.voids +=
      1;

    return;
  }

  stats.samples +=
    1;

  stats.probabilityTotal +=
    selection.probability;

  const probability =
    selection.probability /
    100;

  const actual =
    result ===
    "WIN"
      ? 1
      : 0;

  stats.brierTotal +=
    (
      probability -
      actual
    ) **
    2;

  if (
    result ===
    "WIN"
  ) {
    stats.wins +=
      1;
  } else {
    stats.losses +=
      1;
  }

  if (
    selection.probability >=
    70
  ) {
    stats.samples70 +=
      1;

    if (
      result ===
      "WIN"
    ) {
      stats.wins70 +=
        1;
    }
  }

  if (
    selection.probability >=
    80
  ) {
    stats.samples80 +=
      1;

    if (
      result ===
      "WIN"
    ) {
      stats.wins80 +=
        1;
    }
  }

  if (
    selection.probability >=
    90
  ) {
    stats.samples90 +=
      1;

    if (
      result ===
      "WIN"
    ) {
      stats.wins90 +=
        1;
    }
  }
}

function buildFrozenProfile(
  stats:
    HistoricalMarketStats,
): FrozenMarketProfile {
  const averageProbability =
    stats.samples >
    0
      ? stats.probabilityTotal /
        stats.samples
      : 0;

  const historicalHitRate =
    hitRate(
      stats.wins,
      stats.samples,
    ) ??
    0;

  return {
    key:
      stats.key,

    historicalSamples:
      stats.samples,

    averageProbability:
      round(
        averageProbability,
        2,
      ),

    historicalHitRate:
      round(
        historicalHitRate,
        2,
      ),

    calibrationGap:
      round(
        historicalHitRate -
          averageProbability,
        2,
      ),

    brier:
      stats.samples >
      0
        ? round(
            stats.brierTotal /
              stats.samples,
            4,
          )
        : 0,

    samples70:
      stats.samples70,

    hit70:
      stats.samples70 >
      0
        ? round(
            (
              stats.wins70 /
              stats.samples70
            ) *
              100,
            2,
          )
        : null,

    samples80:
      stats.samples80,

    hit80:
      stats.samples80 >
      0
        ? round(
            (
              stats.wins80 /
              stats.samples80
            ) *
              100,
            2,
          )
        : null,

    samples90:
      stats.samples90,

    hit90:
      stats.samples90 >
      0
        ? round(
            (
              stats.wins90 /
              stats.samples90
            ) *
              100,
            2,
          )
        : null,
  };
}

function calculateReliability(
  selection:
    MarketSelection,

  profile:
    FrozenMarketProfile,
): {
  score: number;
  thresholdHitRate:
    number | null;
  thresholdSamples:
    number;
} {
  let thresholdHitRate:
    number | null =
      null;

  let thresholdSamples =
    0;

  if (
    selection.probability >=
      90 &&
    profile.samples90 >
      0
  ) {
    thresholdHitRate =
      profile.hit90;

    thresholdSamples =
      profile.samples90;
  } else if (
    selection.probability >=
      80 &&
    profile.samples80 >
      0
  ) {
    thresholdHitRate =
      profile.hit80;

    thresholdSamples =
      profile.samples80;
  } else if (
    selection.probability >=
      70 &&
    profile.samples70 >
      0
  ) {
    thresholdHitRate =
      profile.hit70;

    thresholdSamples =
      profile.samples70;
  }

  const calibrationQuality =
    Math.max(
      0,
      100 -
        Math.abs(
          profile.calibrationGap,
        ) *
          5,
    );

  const sampleQuality =
    Math.min(
      100,
      (
        profile.historicalSamples /
        1500
      ) *
        100,
    );

  const brierQuality =
    Math.max(
      0,
      100 -
        profile.brier *
          180,
    );

  const thresholdQuality =
    thresholdHitRate ??
    profile.historicalHitRate;

  const score =
    profile.historicalHitRate *
      0.32 +
    thresholdQuality *
      0.28 +
    calibrationQuality *
      0.16 +
    sampleQuality *
      0.12 +
    brierQuality *
      0.12;

  return {
    score:
      round(
        Math.max(
          0,
          Math.min(
            100,
            score,
          ),
        ),
        2,
      ),

    thresholdHitRate,

    thresholdSamples,
  };
}

function getTier(
  reliabilityScore:
    number,
):
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW" {
  if (
    reliabilityScore >=
    85
  ) {
    return "VERY_HIGH";
  }

  if (
    reliabilityScore >=
    75
  ) {
    return "HIGH";
  }

  if (
    reliabilityScore >=
    65
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function calculatePickScore(
  selection:
    MarketSelection,

  reliabilityScore:
    number,
): number {
  const fairOddsPenalty =
    selection.fairOdds !==
      null &&
    selection.fairOdds <
      1.1
      ? 6
      : 0;

  const score =
    reliabilityScore *
      0.7 +
    selection.probability *
      0.3 -
    fairOddsPenalty;

  return round(
    score,
    2,
  );
}

function buildCandidates(
  selections:
    MarketSelection[],

  profiles:
    Map<
      string,
      FrozenMarketProfile
    >,
): CandidatePick[] {
  const candidates:
    CandidatePick[] =
      [];

  for (
    const selection
    of selections
  ) {
    const profile =
      profiles.get(
        selection.key,
      );

    if (
      !profile
    ) {
      continue;
    }

    if (
      selection.probability <
      MINIMUM_PROBABILITY
    ) {
      continue;
    }

    if (
      profile.historicalSamples <
      MINIMUM_HISTORICAL_SAMPLES
    ) {
      continue;
    }

    if (
      selection.fairOdds !==
        null &&
      (
        selection.fairOdds <
          MINIMUM_FAIR_ODDS ||
        selection.fairOdds >
          MAXIMUM_FAIR_ODDS
      )
    ) {
      continue;
    }

    const reliability =
      calculateReliability(
        selection,
        profile,
      );

    const reliabilityScore =
      reliability.score;

    candidates.push({
      key:
        selection.key,

      category:
        selection.category,

      market:
        selection.market,

      selection:
        selection.selection,

      probability:
        selection.probability,

      fairOdds:
        selection.fairOdds,

      historicalHitRate:
        profile.historicalHitRate,

      historicalSamples:
        profile.historicalSamples,

      thresholdHitRate:
        reliability.thresholdHitRate,

      thresholdSamples:
        reliability.thresholdSamples,

      reliabilityScore,

      pickScore:
        calculatePickScore(
          selection,
          reliabilityScore,
        ),

      tier:
        getTier(
          reliabilityScore,
        ),
    });
  }

  return candidates.sort(
    (
      first,
      second,
    ) =>
      second.pickScore -
      first.pickScore,
  );
}

function getFamily(
  pick:
    CandidatePick,
): string {
  if (
    pick.key.startsWith(
      "home_team_goals_",
    )
  ) {
    return "TEAM_GOALS_HOME";
  }

  if (
    pick.key.startsWith(
      "away_team_goals_",
    )
  ) {
    return "TEAM_GOALS_AWAY";
  }

  return pick.category;
}

function diversifyCandidates(
  candidates:
    CandidatePick[],
): CandidatePick[] {
  const selected:
    CandidatePick[] =
      [];

  const marketCount =
    new Map<
      string,
      number
    >();

  const familyCount =
    new Map<
      string,
      number
    >();

  for (
    const candidate
    of candidates
  ) {
    if (
      selected.length >=
      TOP_PICKS_LIMIT
    ) {
      break;
    }

    const marketKey =
      candidate.market;

    const family =
      getFamily(
        candidate,
      );

    const currentMarketCount =
      marketCount.get(
        marketKey,
      ) ??
      0;

    const currentFamilyCount =
      familyCount.get(
        family,
      ) ??
      0;

    if (
      currentMarketCount >=
      1
    ) {
      continue;
    }

    if (
      currentFamilyCount >=
      2
    ) {
      continue;
    }

    selected.push(
      candidate,
    );

    marketCount.set(
      marketKey,
      currentMarketCount +
        1,
    );

    familyCount.set(
      family,
      currentFamilyCount +
        1,
    );
  }

  return selected;
}

async function main(): Promise<void> {
  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "SMART PICKS CHRONOLOGICAL HOLDOUT",
  );

  console.log(
    "========================================",
  );

  const apiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

  const matches =
    await prisma.match.findMany({
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
              in:
                apiIds,
            },
          },
        },
      },

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

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  if (
    matches.length ===
    0
  ) {
    throw new Error(
      "Holdout testi için uygun FINISHED maç bulunamadı.",
    );
  }

  const splitIndex =
    Math.floor(
      matches.length *
        TRAIN_RATIO,
    );

  const trainingMatches =
    matches.slice(
      0,
      splitIndex,
    );

  const validationMatches =
    matches.slice(
      splitIndex,
    );

  if (
    trainingMatches.length ===
      0 ||
    validationMatches.length ===
      0
  ) {
    throw new Error(
      "Train/validation bölümü oluşturmak için yeterli maç yok.",
    );
  }

  console.log("");

  console.table({
    "All matches":
      matches.length,

    "Training matches":
      trainingMatches.length,

    "Validation matches":
      validationMatches.length,

    "Train %":
      round(
        (
          trainingMatches.length /
          matches.length
        ) *
          100,
      ),

    "Validation %":
      round(
        (
          validationMatches.length /
          matches.length
        ) *
          100,
      ),

    "Split date":
      validationMatches[0]
        ?.kickoffAt
        .toISOString() ??
      null,
  });

  /*
   * =========================================================
   * TRAIN
   * =========================================================
   */

  console.log("");

  console.log(
    "Building frozen reliability profile...",
  );

  const trainingStats =
    new Map<
      string,
      HistoricalMarketStats
    >();

  for (
    let index = 0;
    index <
    trainingMatches.length;
    index += 1
  ) {
    const match =
      trainingMatches[
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

    const goalModel =
      await calculateGoalProbabilities(
        match.id,
      );

    const markets =
      calculateMarketsFromGoalModel(
        goalModel,
      );

    for (
      const selection
      of markets.selections
    ) {
      let stats =
        trainingStats.get(
          selection.key,
        );

      if (
        !stats
      ) {
        stats = {
          key:
            selection.key,

          samples:
            0,

          wins:
            0,

          losses:
            0,

          voids:
            0,

          probabilityTotal:
            0,

          brierTotal:
            0,

          samples70:
            0,

          wins70:
            0,

          samples80:
            0,

          wins80:
            0,

          samples90:
            0,

          wins90:
            0,
        };

        trainingStats.set(
          selection.key,
          stats,
        );
      }

      const result =
        resolveSelection(
          selection.key,
          match.homeScore,
          match.awayScore,
        );

      updateHistoricalStats(
        stats,
        selection,
        result,
      );
    }

    if (
      (
        index +
        1
      ) %
        100 ===
      0
    ) {
      console.log(
        `TRAIN [${index + 1}/${trainingMatches.length}]`,
      );
    }
  }

  const frozenProfiles =
    new Map<
      string,
      FrozenMarketProfile
    >();

  for (
    const [
      key,
      stats,
    ]
    of trainingStats
  ) {
    frozenProfiles.set(
      key,
      buildFrozenProfile(
        stats,
      ),
    );
  }

  console.log("");

  console.log(
    `Frozen markets: ${frozenProfiles.size}`,
  );

  /*
   * =========================================================
   * VALIDATION
   * =========================================================
   */

  console.log("");

  console.log(
    "Running unseen validation...",
  );

  const tierStats =
    new Map<
      string,
      TierAccumulator
    >();

  const leagueStats =
    new Map<
      number,
      LeagueAccumulator
    >();

  const marketStats =
    new Map<
      string,
      MarketValidationAccumulator
    >();

  const probabilityBucketStats =
    new Map<
      string,
      ProbabilityBucketAccumulator
    >();

  for (
    const bucket
    of PROBABILITY_BUCKETS
  ) {
    probabilityBucketStats.set(
      bucket.key,
      {
        key:
          bucket.key,

        label:
          bucket.label,

        minimum:
          bucket.minimum,

        maximum:
          bucket.maximum,

        picks:
          0,

        wins:
          0,

        losses:
          0,

        voids:
          0,

        probabilityTotal:
          0,

        reliabilityTotal:
          0,
      },
    );
  }

  let validationMatchesProcessed =
    0;

  let totalPicks =
    0;

  let wins =
    0;

  let losses =
    0;

  let voids =
    0;

  for (
    let index = 0;
    index <
    validationMatches.length;
    index += 1
  ) {
    const match =
      validationMatches[
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

    const goalModel =
      await calculateGoalProbabilities(
        match.id,
      );

    const markets =
      calculateMarketsFromGoalModel(
        goalModel,
      );

    const candidates =
      buildCandidates(
        markets.selections,
        frozenProfiles,
      );

    const picks =
      diversifyCandidates(
        candidates,
      );

    for (
      const pick
      of picks
    ) {
      const result =
        resolveSelection(
          pick.key,
          match.homeScore,
          match.awayScore,
        );

      /*
       * =====================================================
       * PROBABILITY BUCKET
       * =====================================================
       */

      const probabilityBucket =
        getProbabilityBucket(
          pick.probability,
        );

      if (
        probabilityBucket
      ) {
        const bucketStats =
          probabilityBucketStats.get(
            probabilityBucket.key,
          );

        if (
          bucketStats
        ) {
          bucketStats.picks +=
            1;

          bucketStats.probabilityTotal +=
            pick.probability;

          bucketStats.reliabilityTotal +=
            pick.reliabilityScore;

          if (
            result ===
            "WIN"
          ) {
            bucketStats.wins +=
              1;
          } else if (
            result ===
            "LOSS"
          ) {
            bucketStats.losses +=
              1;
          } else {
            bucketStats.voids +=
              1;
          }
        }
      }

      /*
       * =====================================================
       * GLOBAL
       * =====================================================
       */

      totalPicks +=
        1;

      if (
        result ===
        "WIN"
      ) {
        wins +=
          1;
      } else if (
        result ===
        "LOSS"
      ) {
        losses +=
          1;
      } else {
        voids +=
          1;
      }

      /*
       * =====================================================
       * TIER
       * =====================================================
       */

      const tier =
        tierStats.get(
          pick.tier,
        ) ?? {
          picks:
            0,

          wins:
            0,

          losses:
            0,

          voids:
            0,
        };

      tier.picks +=
        1;

      if (
        result ===
        "WIN"
      ) {
        tier.wins +=
          1;
      } else if (
        result ===
        "LOSS"
      ) {
        tier.losses +=
          1;
      } else {
        tier.voids +=
          1;
      }

      tierStats.set(
        pick.tier,
        tier,
      );

      /*
       * =====================================================
       * LEAGUE
       * =====================================================
       */

      const leagueApiId =
        match
          .season
          .league
          .apiId;

      const league =
        leagueStats.get(
          leagueApiId,
        ) ?? {
          apiId:
            leagueApiId,

          league:
            match
              .season
              .league
              .name,

          picks:
            0,

          wins:
            0,

          losses:
            0,

          voids:
            0,
        };

      league.picks +=
        1;

      if (
        result ===
        "WIN"
      ) {
        league.wins +=
          1;
      } else if (
        result ===
        "LOSS"
      ) {
        league.losses +=
          1;
      } else {
        league.voids +=
          1;
      }

      leagueStats.set(
        leagueApiId,
        league,
      );

      /*
       * =====================================================
       * MARKET
       * =====================================================
       */

      const market =
        marketStats.get(
          pick.key,
        ) ?? {
          key:
            pick.key,

          market:
            pick.market,

          selection:
            pick.selection,

          picks:
            0,

          wins:
            0,

          losses:
            0,

          voids:
            0,

          reliabilityTotal:
            0,

          probabilityTotal:
            0,
        };

      market.picks +=
        1;

      market.reliabilityTotal +=
        pick.reliabilityScore;

      market.probabilityTotal +=
        pick.probability;

      if (
        result ===
        "WIN"
      ) {
        market.wins +=
          1;
      } else if (
        result ===
        "LOSS"
      ) {
        market.losses +=
          1;
      } else {
        market.voids +=
          1;
      }

      marketStats.set(
        pick.key,
        market,
      );
    }

    validationMatchesProcessed +=
      1;

    if (
      (
        index +
        1
      ) %
        100 ===
      0
    ) {
      console.log(
        `VALIDATION [${index + 1}/${validationMatches.length}] • picks ${totalPicks}`,
      );
    }
  }

  const settled =
    wins +
    losses;

  /*
   * =========================================================
   * GLOBAL RESULT
   * =========================================================
   */

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "OUT-OF-SAMPLE RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "Validation matches":
      validationMatchesProcessed,

    Picks:
      totalPicks,

    WIN:
      wins,

    LOSS:
      losses,

    VOID:
      voids,

    Settled:
      settled,

    "Hit Rate":
      settled >
      0
        ? `${round(
            (
              wins /
              settled
            ) *
              100,
          )}%`
        : null,
  });

  /*
   * =========================================================
   * TIER PERFORMANCE
   * =========================================================
   */

  console.log("");

  console.log(
    "TIER PERFORMANCE",
  );

  console.log("");

  console.table(
    [
      ...tierStats.entries(),
    ]
      .map(
        (
          [
            tier,
            stats,
          ],
        ) => {
          const tierSettled =
            stats.wins +
            stats.losses;

          return {
            tier,

            picks:
              stats.picks,

            wins:
              stats.wins,

            losses:
              stats.losses,

            voids:
              stats.voids,

            hitRate:
              tierSettled >
              0
                ? round(
                    (
                      stats.wins /
                      tierSettled
                    ) *
                      100,
                  )
                : null,
          };
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            second.hitRate ??
            0
          ) -
          (
            first.hitRate ??
            0
          ),
      ),
  );

  /*
   * =========================================================
   * MODEL PROBABILITY PERFORMANCE
   * =========================================================
   */

  console.log("");

  console.log(
    "MODEL PROBABILITY PERFORMANCE",
  );

  console.log("");

  console.table(
    PROBABILITY_BUCKETS.map(
      (
        bucket,
      ) => {
        const stats =
          probabilityBucketStats.get(
            bucket.key,
          );

        if (
          !stats
        ) {
          return {
            range:
              bucket.label,

            picks:
              0,

            wins:
              0,

            losses:
              0,

            voids:
              0,

            hitRate:
              null,

            avgProbability:
              null,

            avgReliability:
              null,

            calibrationGap:
              null,
          };
        }

        const bucketSettled =
          stats.wins +
          stats.losses;

        const actualHitRate =
          bucketSettled >
          0
            ? (
                stats.wins /
                bucketSettled
              ) *
              100
            : null;

        const averageProbability =
          stats.picks >
          0
            ? stats.probabilityTotal /
              stats.picks
            : null;

        const averageReliability =
          stats.picks >
          0
            ? stats.reliabilityTotal /
              stats.picks
            : null;

        const calibrationGap =
          actualHitRate !==
            null &&
          averageProbability !==
            null
            ? actualHitRate -
              averageProbability
            : null;

        return {
          range:
            bucket.label,

          picks:
            stats.picks,

          wins:
            stats.wins,

          losses:
            stats.losses,

          voids:
            stats.voids,

          hitRate:
            actualHitRate !==
            null
              ? round(
                  actualHitRate,
                )
              : null,

          avgProbability:
            averageProbability !==
            null
              ? round(
                  averageProbability,
                )
              : null,

          avgReliability:
            averageReliability !==
            null
              ? round(
                  averageReliability,
                )
              : null,

          calibrationGap:
            calibrationGap !==
            null
              ? round(
                  calibrationGap,
                )
              : null,
        };
      },
    ),
  );

  /*
   * =========================================================
   * LEAGUE PERFORMANCE
   * =========================================================
   */

  console.log("");

  console.log(
    "LEAGUE PERFORMANCE",
  );

  console.log("");

  console.table(
    [
      ...leagueStats.values(),
    ]
      .map(
        (
          stats,
        ) => {
          const leagueSettled =
            stats.wins +
            stats.losses;

          return {
            apiId:
              stats.apiId,

            league:
              stats.league,

            picks:
              stats.picks,

            wins:
              stats.wins,

            losses:
              stats.losses,

            voids:
              stats.voids,

            hitRate:
              leagueSettled >
              0
                ? round(
                    (
                      stats.wins /
                      leagueSettled
                    ) *
                      100,
                  )
                : null,
          };
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            second.hitRate ??
            0
          ) -
          (
            first.hitRate ??
            0
          ),
      ),
  );

  /*
   * =========================================================
   * TOP MARKETS
   * =========================================================
   */

  console.log("");

  console.log(
    "TOP VALIDATION MARKETS",
  );

  console.log("");

  console.table(
    [
      ...marketStats.values(),
    ]
      .map(
        (
          stats,
        ) => {
          const marketSettled =
            stats.wins +
            stats.losses;

          return {
            key:
              stats.key,

            market:
              stats.market,

            selection:
              stats.selection,

            picks:
              stats.picks,

            wins:
              stats.wins,

            losses:
              stats.losses,

            voids:
              stats.voids,

            hitRate:
              marketSettled >
              0
                ? round(
                    (
                      stats.wins /
                      marketSettled
                    ) *
                      100,
                  )
                : null,

            avgReliability:
              stats.picks >
              0
                ? round(
                    stats.reliabilityTotal /
                      stats.picks,
                  )
                : null,

            avgProbability:
              stats.picks >
              0
                ? round(
                    stats.probabilityTotal /
                      stats.picks,
                  )
                : null,
          };
        },
      )
      .filter(
        (
          row,
        ) =>
          row.picks >=
          50,
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            second.hitRate ??
            0
          ) -
          (
            first.hitRate ??
            0
          ),
      )
      .slice(
        0,
        20,
      ),
  );

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "HOLDOUT TEST COMPLETE",
  );

  console.log(
    "========================================",
  );
}

main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error("");

      console.error(
        "Holdout test başarısız.",
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
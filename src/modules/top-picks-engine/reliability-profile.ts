import type {
  MarketReliabilityProfile,
} from "./types";

export const MARKET_RELIABILITY_PROFILE:
  Record<
    string,
    MarketReliabilityProfile
  > = {
  match_result_home: {
    key:
      "match_result_home",

    historicalSamples:
      2367,

    averageProbability:
      43.93,

    historicalHitRate:
      45.12,

    calibrationGap:
      1.19,

    brier:
      0.2376,

    samples70:
      61,

    hit70:
      60.66,

    samples80:
      7,

    hit80:
      42.86,

    samples90:
      1,

    hit90:
      0,
  },

  match_result_draw: {
    key:
      "match_result_draw",

    historicalSamples:
      2367,

    averageProbability:
      24.1,

    historicalHitRate:
      22.94,

    calibrationGap:
      -1.16,

    brier:
      0.1772,

    samples70:
      0,

    hit70:
      null,

    samples80:
      0,

    hit80:
      null,

    samples90:
      0,

    hit90:
      null,
  },

  match_result_away: {
    key:
      "match_result_away",

    historicalSamples:
      2367,

    averageProbability:
      31.97,

    historicalHitRate:
      31.94,

    calibrationGap:
      -0.03,

    brier:
      0.2092,

    samples70:
      29,

    hit70:
      68.97,

    samples80:
      4,

    hit80:
      100,

    samples90:
      0,

    hit90:
      null,
  },

  double_chance_1x: {
    key:
      "double_chance_1x",

    historicalSamples:
      2367,

    averageProbability:
      68.03,

    historicalHitRate:
      68.06,

    calibrationGap:
      0.03,

    brier:
      0.2092,

    samples70:
      1222,

    hit70:
      74.39,

    samples80:
      418,

    hit80:
      77.51,

    samples90:
      23,

    hit90:
      69.57,
  },

  double_chance_x2: {
    key:
      "double_chance_x2",

    historicalSamples:
      2367,

    averageProbability:
      56.07,

    historicalHitRate:
      54.88,

    calibrationGap:
      -1.19,

    brier:
      0.2376,

    samples70:
      379,

    hit70:
      76.78,

    samples80:
      107,

    hit80:
      85.05,

    samples90:
      13,

    hit90:
      92.31,
  },

  double_chance_12: {
    key:
      "double_chance_12",

    historicalSamples:
      2367,

    averageProbability:
      75.9,

    historicalHitRate:
      77.06,

    calibrationGap:
      1.16,

    brier:
      0.1772,

    samples70:
      2266,

    hit70:
      77.14,

    samples80:
      294,

    hit80:
      81.29,

    samples90:
      2,

    hit90:
      100,
  },

  dnb_home: {
    key:
      "dnb_home",

    historicalSamples:
      1824,

    averageProbability:
      57.76,

    historicalHitRate:
      58.55,

    calibrationGap:
      0.79,

    brier:
      0.2278,

    samples70:
      481,

    hit70:
      70.48,

    samples80:
      163,

    hit80:
      75.46,

    samples90:
      11,

    hit90:
      45.45,
  },

  dnb_away: {
    key:
      "dnb_away",

    historicalSamples:
      1824,

    averageProbability:
      42.24,

    historicalHitRate:
      41.45,

    calibrationGap:
      -0.79,

    brier:
      0.2278,

    samples70:
      131,

    hit70:
      77.1,

    samples80:
      48,

    hit80:
      85.42,

    samples90:
      8,

    hit90:
      87.5,
  },

  "total_goals_over_0.5": {
    key:
      "total_goals_over_0.5",

    historicalSamples:
      2367,

    averageProbability:
      93.27,

    historicalHitRate:
      93.92,

    calibrationGap:
      0.65,

    brier:
      0.0583,

    samples70:
      2366,

    hit70:
      93.91,

    samples80:
      2356,

    hit80:
      93.89,

    samples90:
      2039,

    hit90:
      93.67,
  },

  "total_goals_over_1.5": {
    key:
      "total_goals_over_1.5",

    historicalSamples:
      2367,

    averageProbability:
      75.92,

    historicalHitRate:
      77.02,

    calibrationGap:
      1.1,

    brier:
      0.1834,

    samples70:
      1832,

    hit70:
      77.18,

    samples80:
      789,

    hit80:
      78.45,

    samples90:
      102,

    hit90:
      79.41,
  },

  "total_goals_over_2.5": {
    key:
      "total_goals_over_2.5",

    historicalSamples:
      2367,

    averageProbability:
      52.79,

    historicalHitRate:
      54.75,

    calibrationGap:
      1.96,

    brier:
      0.2559,

    samples70:
      204,

    hit70:
      55.88,

    samples80:
      29,

    hit80:
      65.52,

    samples90:
      1,

    hit90:
      0,
  },

  "total_goals_under_2.5": {
    key:
      "total_goals_under_2.5",

    historicalSamples:
      2367,

    averageProbability:
      47.21,

    historicalHitRate:
      45.25,

    calibrationGap:
      -1.96,

    brier:
      0.2559,

    samples70:
      65,

    hit70:
      52.31,

    samples80:
      7,

    hit80:
      57.14,

    samples90:
      0,

    hit90:
      null,
  },

  "total_goals_under_3.5": {
    key:
      "total_goals_under_3.5",

    historicalSamples:
      2367,

    averageProbability:
      68.47,

    historicalHitRate:
      66.96,

    calibrationGap:
      -1.51,

    brier:
      0.2255,

    samples70:
      1192,

    hit70:
      70.22,

    samples80:
      320,

    hit80:
      75.63,

    samples90:
      33,

    hit90:
      81.82,
  },

  "total_goals_under_4.5": {
    key:
      "total_goals_under_4.5",

    historicalSamples:
      2367,

    averageProbability:
      83.61,

    historicalHitRate:
      82.76,

    calibrationGap:
      -0.85,

    brier:
      0.1464,

    samples70:
      2183,

    hit70:
      82.87,

    samples80:
      1739,

    hit80:
      83.61,

    samples90:
      534,

    hit90:
      87.83,
  },

  "home_team_goals_over_0.5": {
    key:
      "home_team_goals_over_0.5",

    historicalSamples:
      2367,

    averageProbability:
      76.98,

    historicalHitRate:
      76.51,

    calibrationGap:
      -0.47,

    brier:
      0.178,

    samples70:
      1897,

    hit70:
      78.39,

    samples80:
      953,

    hit80:
      81.22,

    samples90:
      137,

    hit90:
      89.78,
  },

  "away_team_goals_over_0.5": {
    key:
      "away_team_goals_over_0.5",

    historicalSamples:
      2367,

    averageProbability:
      69.99,

    historicalHitRate:
      70.3,

    calibrationGap:
      0.31,

    brier:
      0.2088,

    samples70:
      1160,

    hit70:
      75.52,

    samples80:
      432,

    hit80:
      81.25,

    samples90:
      64,

    hit90:
      84.38,
  },

  "home_team_goals_under_1.5": {
    key:
      "home_team_goals_under_1.5",

    historicalSamples:
      2367,

    averageProbability:
      55.06,

    historicalHitRate:
      53.82,

    calibrationGap:
      -1.24,

    brier:
      0.2477,

    samples70:
      295,

    hit70:
      66.78,

    samples80:
      65,

    hit80:
      80,

    samples90:
      6,

    hit90:
      83.33,
  },

  "away_team_goals_under_1.5": {
    key:
      "away_team_goals_under_1.5",

    historicalSamples:
      2367,

    averageProbability:
      64.17,

    historicalHitRate:
      63.46,

    calibrationGap:
      -0.71,

    brier:
      0.2305,

    samples70:
      903,

    hit70:
      68.88,

    samples80:
      212,

    hit80:
      68.4,

    samples90:
      16,

    hit90:
      68.75,
  },

  "home_team_goals_under_2.5": {
    key:
      "home_team_goals_under_2.5",

    historicalSamples:
      2367,

    averageProbability:
      79.04,

    historicalHitRate:
      78.07,

    calibrationGap:
      -0.97,

    brier:
      0.1728,

    samples70:
      1953,

    hit70:
      79.37,

    samples80:
      1247,

    hit80:
      80.99,

    samples90:
      303,

    hit90:
      88.78,
  },

  "away_team_goals_under_2.5": {
    key:
      "away_team_goals_under_2.5",

    historicalSamples:
      2367,

    averageProbability:
      85.36,

    historicalHitRate:
      85.59,

    calibrationGap:
      0.23,

    brier:
      0.1227,

    samples70:
      2177,

    hit70:
      86.86,

    samples80:
      1843,

    hit80:
      87.74,

    samples90:
      920,

    hit90:
      90.22,
  },

  "home_team_goals_under_3.5": {
    key:
      "home_team_goals_under_3.5",

    historicalSamples:
      2367,

    averageProbability:
      91.86,

    historicalHitRate:
      91.25,

    calibrationGap:
      -0.61,

    brier:
      0.0821,

    samples70:
      2344,

    hit70:
      91.25,

    samples80:
      2239,

    hit80:
      91.38,

    samples90:
      1734,

    hit90:
      91.87,
  },

  "away_team_goals_under_3.5": {
    key:
      "away_team_goals_under_3.5",

    historicalSamples:
      2367,

    averageProbability:
      94.93,

    historicalHitRate:
      94.72,

    calibrationGap:
      -0.21,

    brier:
      0.0492,

    samples70:
      2352,

    hit70:
      94.86,

    samples80:
      2308,

    hit80:
      95.15,

    samples90:
      2071,

    hit90:
      95.8,
  },

  home_clean_sheet_no: {
    key:
      "home_clean_sheet_no",

    historicalSamples:
      2367,

    averageProbability:
      69.99,

    historicalHitRate:
      70.3,

    calibrationGap:
      0.31,

    brier:
      0.2088,

    samples70:
      1160,

    hit70:
      75.52,

    samples80:
      432,

    hit80:
      81.25,

    samples90:
      64,

    hit90:
      84.38,
  },

  away_clean_sheet_no: {
    key:
      "away_clean_sheet_no",

    historicalSamples:
      2367,

    averageProbability:
      76.98,

    historicalHitRate:
      76.51,

    calibrationGap:
      -0.47,

    brier:
      0.178,

    samples70:
      1897,

    hit70:
      78.39,

    samples80:
      953,

    hit80:
      81.22,

    samples90:
      137,

    hit90:
      89.78,
  },

  home_win_to_nil_no: {
    key:
      "home_win_to_nil_no",

    historicalSamples:
      2367,

    averageProbability:
      76.72,

    historicalHitRate:
      76.38,

    calibrationGap:
      -0.34,

    brier:
      0.1772,

    samples70:
      1834,

    hit70:
      78.24,

    samples80:
      868,

    hit80:
      84.56,

    samples90:
      170,

    hit90:
      90.59,
  },

  away_win_to_nil_no: {
    key:
      "away_win_to_nil_no",

    historicalSamples:
      2367,

    averageProbability:
      83.71,

    historicalHitRate:
      82.59,

    calibrationGap:
      -1.12,

    brier:
      0.1402,

    samples70:
      2238,

    hit70:
      83.65,

    samples80:
      1752,

    hit80:
      85.73,

    samples90:
      458,

    hit90:
      89.52,
  },
  "total_goals_under_5.5": {
    key:
      "total_goals_under_5.5",

    historicalSamples:
      2367,

    averageProbability:
      92.52,

    historicalHitRate:
      92.82,

    calibrationGap:
      0.3,

    brier:
      0.0684,

    samples70:
      2353,

    hit70:
      92.78,

    samples80:
      2287,

    hit80:
      92.79,

    samples90:
      1830,

    hit90:
      93.39,
  },
};

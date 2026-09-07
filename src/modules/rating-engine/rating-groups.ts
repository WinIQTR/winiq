import type {
  RatingCategory,
} from "./types";

/**
 * Rating Engine V2
 *
 * Her feature yalnızca mantıksal olarak
 * ait olduğu ana kategoriye bağlanır.
 *
 * Aktif modelde bulunmayan feature anahtarları
 * otomatik olarak görmezden gelinir.
 */
export const RATING_GROUPS: Record<
  RatingCategory,
  readonly string[]
> = {
  form: [
    "last_5_points_per_game",
    "last_10_points_per_game",

    "form_momentum",

    "win_rate",
    "loss_rate",

    "goal_difference_per_game",
  ],

  attack: [
    "goals_scored_per_game",
    "last_10_goals_scored_per_game",
  ],

  defense: [
    "goals_conceded_per_game",
    "last_10_goals_conceded_per_game",

    "clean_sheet_rate",
  ],

  venue: [
    "venue_last_5_points_per_game",
    "venue_last_10_points_per_game",

    "venue_goals_scored_per_game",
    "venue_goals_conceded_per_game",

    "venue_last_10_goals_scored_per_game",
    "venue_last_10_goals_conceded_per_game",
  ],

  xg: [
    "expected_goals_per_game",
    "expected_goals_against_per_game",
    "expected_goals_difference",

    "last5_expected_goals",
    "last5_expected_goals_against",
    "last5_expected_goals_difference",
  ],

  shotThreat: [
    "shots_per_game",
    "shots_on_target_per_game",
    "shot_accuracy",
    "attacking_pressure",

    "last5_shots_per_game",
    "last5_shots_on_target_per_game",
    "last5_attacking_pressure",
  ],

  fitness: [
    "rest_days",
    "fixture_congestion_14_days",
  ],
};

/**
 * İlk V2 kategori ağırlıkları.
 *
 * Toplam: 1.00
 *
 * Bu değerler geçici başlangıç ağırlıklarıdır.
 * Daha sonra backtest ve Learning Engine
 * tarafından optimize edilecektir.
 */
export const CATEGORY_WEIGHTS: Record<
  RatingCategory,
  number
> = {
  form:
    0.2,

  attack:
    0.13,

  defense:
    0.13,

  venue:
    0.16,

  xg:
    0.18,

  shotThreat:
    0.12,

  fitness:
    0.08,
};

export const RATING_CATEGORIES:
  RatingCategory[] = [
  "form",
  "attack",
  "defense",
  "venue",
  "xg",
  "shotThreat",
  "fitness",
];
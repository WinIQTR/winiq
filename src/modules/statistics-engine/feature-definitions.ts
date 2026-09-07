import {
  FeatureCategory,
  FeatureScope,
  FeatureStatus,
  FeatureValueType,
} from "@/generated/prisma/client";

import {
  registerFeature,
} from "@/modules/feature-registry";

const FORM_CALCULATION_VERSION =
  "team-form-v2.0";

export function registerTeamFormFeatures():
  void {
  const definitions = [
    {
      key:
        "last_10_points_per_game",

      name:
        "Son 10 Maç Puan Ortalaması",

      description:
        "Takımın son 10 maçta topladığı puanın maç başına ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "points_per_game",

      minimumValue:
        0,

      maximumValue:
        3,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "last_10_goals_scored_per_game",

      name:
        "Son 10 Maç Gol Ortalaması",

      description:
        "Takımın son 10 maçta maç başına attığı gol ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.ATTACK,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "goals_per_game",

      minimumValue:
        0,

      maximumValue:
        5,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "last_10_goals_conceded_per_game",

      name:
        "Son 10 Maç Yenilen Gol Ortalaması",

      description:
        "Takımın son 10 maçta maç başına yediği gol ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.DEFENCE,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "goals_per_game",

      minimumValue:
        0,

      maximumValue:
        5,

      higherIsBetter:
        false,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "venue_last_10_points_per_game",

      name:
        "Saha Bazlı Son 10 Puan Ortalaması",

      description:
        "Ev sahibinin iç sahadaki veya deplasman takımının dış sahadaki son 10 maç puan ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.HOME_AWAY,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "points_per_game",

      minimumValue:
        0,

      maximumValue:
        3,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "venue_last_10_goals_scored_per_game",

      name:
        "Saha Bazlı Son 10 Gol Ortalaması",

      description:
        "Ev sahibinin iç sahadaki veya deplasman takımının dış sahadaki son 10 maç gol ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.HOME_AWAY,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "goals_per_game",

      minimumValue:
        0,

      maximumValue:
        5,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "venue_last_10_goals_conceded_per_game",

      name:
        "Saha Bazlı Son 10 Yenilen Gol Ortalaması",

      description:
        "Ev sahibinin iç sahadaki veya deplasman takımının dış sahadaki son 10 maç yenilen gol ortalaması.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.HOME_AWAY,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "goals_per_game",

      minimumValue:
        0,

      maximumValue:
        5,

      higherIsBetter:
        false,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "win_rate",

      name:
        "Galibiyet Oranı",

      description:
        "Takımın incelenen son maçlardaki galibiyet yüzdesi.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "draw_rate",

      name:
        "Beraberlik Oranı",

      description:
        "Takımın incelenen son maçlardaki beraberlik yüzdesi.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        null,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "loss_rate",

      name:
        "Mağlubiyet Oranı",

      description:
        "Takımın incelenen son maçlardaki mağlubiyet yüzdesi.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        false,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "clean_sheet_rate",

      name:
        "Gol Yemeden Bitirme Oranı",

      description:
        "Takımın incelenen maçların yüzde kaçında gol yemediği.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.DEFENCE,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "btts_rate",

      name:
        "Karşılıklı Gol Oranı",

      description:
        "Takımın incelenen maçlarının yüzde kaçında iki takımın da gol attığı.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.ATTACK,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "over_2_5_rate",

      name:
        "2.5 Gol Üstü Oranı",

      description:
        "Takımın incelenen maçlarının yüzde kaçında toplam gol sayısının 2.5 üstünde olduğu.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.ATTACK,

      valueType:
        FeatureValueType.PERCENTAGE,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "percentage",

      minimumValue:
        0,

      maximumValue:
        100,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "goal_difference_per_game",

      name:
        "Maç Başına Gol Farkı",

      description:
        "Takımın maç başına attığı ve yediği gol arasındaki fark.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "goals_per_game",

      minimumValue:
        -5,

      maximumValue:
        5,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "form_momentum",

      name:
        "Form İvmesi",

      description:
        "Son 5 maç puan ortalaması ile son 10 maç puan ortalaması arasındaki fark.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.RECENT_FORM,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "points_per_game_difference",

      minimumValue:
        -3,

      maximumValue:
        3,

      higherIsBetter:
        true,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },

    {
      key:
        "fixture_congestion_14_days",

      name:
        "Son 14 Gün Maç Yoğunluğu",

      description:
        "Takımın maçtan önceki son 14 günde oynadığı tamamlanmış maç sayısı.",

      scope:
        FeatureScope.TEAM,

      category:
        FeatureCategory.REST_AND_FATIGUE,

      valueType:
        FeatureValueType.NUMBER,

      status:
        FeatureStatus.ACTIVE,

      unit:
        "matches",

      minimumValue:
        0,

      maximumValue:
        6,

      higherIsBetter:
        false,

      availableBeforeMatch:
        true,

      requiredDataSource:
        "INTERNAL_MATCH_HISTORY",

      calculationVersion:
        FORM_CALCULATION_VERSION,
    },
  ] as const;

  for (
    const definition
    of definitions
  ) {
    registerFeature(
      definition,
    );
  }
}
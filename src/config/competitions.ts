export type CompetitionKind =
  | "DOMESTIC_LEAGUE"
  | "EUROPEAN_CUP";

export type TargetCompetition = {
  apiId: number;

  name: string;
  shortName: string;

  country: string | null;

  kind: CompetitionKind;

  priority: number;

  enabled: boolean;
};

/*
 * V1 COMPETITION SCOPE
 *
 * Bu liste artık projenin merkezi
 * organizasyon kaynağıdır.
 *
 * Yeni bir lig eklemek gerektiğinde
 * importer / prediction / learning
 * dosyalarına dokunmak yerine yalnızca
 * bu listeye ekleme yapılacaktır.
 */
export const TARGET_COMPETITIONS:
  readonly TargetCompetition[] = [
  {
    apiId: 39,

    name:
      "Premier League",

    shortName:
      "EPL",

    country:
      "England",

    kind:
      "DOMESTIC_LEAGUE",

    priority:
      1,

    enabled:
      true,
  },

{
  apiId: 140,

  name:
    "La Liga",

  shortName:
    "ESP",

  country:
    "Spain",

  kind:
    "DOMESTIC_LEAGUE",

  priority:
    2,

  enabled:
    true,
},

  {
    apiId: 203,

    name:
      "Süper Lig",

    shortName:
      "TUR",

    country:
      "Türkiye",

    kind:
      "DOMESTIC_LEAGUE",

    priority:
      2,

    enabled:
      true,
  },

  {
    apiId: 135,

    name:
      "Serie A",

    shortName:
      "ITA",

    country:
      "Italy",

    kind:
      "DOMESTIC_LEAGUE",

    priority:
      3,

    enabled:
      true,
  },

{
  apiId: 61,

  name:
    "Ligue 1",

  shortName:
    "FRA",

  country:
    "France",

  kind:
    "DOMESTIC_LEAGUE",

  priority:
    5,

  enabled:
    true,
},

  {
    apiId: 78,

    name:
      "Bundesliga",

    shortName:
      "GER",

    country:
      "Germany",

    kind:
      "DOMESTIC_LEAGUE",

    priority:
      4,

    enabled:
      true,
  },

  {
    apiId: 2,

    name:
      "UEFA Champions League",

    shortName:
      "UCL",

    country:
      null,

    kind:
      "EUROPEAN_CUP",

    priority:
      5,

    enabled:
      true,
  },

  {
    apiId: 3,

    name:
      "UEFA Europa League",

    shortName:
      "UEL",

    country:
      null,

    kind:
      "EUROPEAN_CUP",

    priority:
      6,

    enabled:
      true,
  },

  {
    apiId: 848,

    name:
      "UEFA Conference League",

    shortName:
      "UECL",

    country:
      null,

    kind:
      "EUROPEAN_CUP",

    priority:
      7,

    enabled:
      true,
  },
] as const;

export const ACTIVE_COMPETITIONS =
  TARGET_COMPETITIONS
    .filter(
      (
        competition,
      ) =>
        competition.enabled,
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.priority -
        right.priority,
    );

export const ACTIVE_COMPETITION_API_IDS =
  ACTIVE_COMPETITIONS.map(
    (
      competition,
    ) =>
      competition.apiId,
  );

export function getCompetitionByApiId(
  apiId: number,
): TargetCompetition | null {
  return (
    TARGET_COMPETITIONS.find(
      (
        competition,
      ) =>
        competition.apiId ===
        apiId,
    ) ??
    null
  );
}

export function isTargetCompetition(
  apiId: number,
): boolean {
  return (
    ACTIVE_COMPETITION_API_IDS.includes(
      apiId,
    )
  );
}

export function getDomesticCompetitions():
  TargetCompetition[] {
  return (
    ACTIVE_COMPETITIONS.filter(
      (
        competition,
      ) =>
        competition.kind ===
        "DOMESTIC_LEAGUE",
    )
  );
}

export function getEuropeanCompetitions():
  TargetCompetition[] {
  return (
    ACTIVE_COMPETITIONS.filter(
      (
        competition,
      ) =>
        competition.kind ===
        "EUROPEAN_CUP",
    )
  );
}
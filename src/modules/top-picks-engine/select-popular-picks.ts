import type {
  RankedMarketPick,
} from "./types";

export type PopularPickFamily =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "TOTAL_GOALS_2_5"
  | "BTTS"
  | "TEAM_GOALS";

export type PopularMarketPick =
  RankedMarketPick & {
    popularFamily:
      PopularPickFamily;

    popularityScore:
      number;
  };

const FAMILY_ORDER:
  readonly PopularPickFamily[] = [
  "MATCH_RESULT",
  "DOUBLE_CHANCE",
  "TOTAL_GOALS_2_5",
  "BTTS",
  "TEAM_GOALS",
];

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

function resolvePopularFamily(
  pick:
    RankedMarketPick,
): PopularPickFamily | null {
  const key =
    pick.key;

  if (
    key.startsWith(
      "match_result_",
    )
  ) {
    return "MATCH_RESULT";
  }

  if (
    key.startsWith(
      "double_chance_",
    )
  ) {
    return "DOUBLE_CHANCE";
  }

  if (
    key.startsWith(
      "total_goals_2.5_",
    )
  ) {
    return "TOTAL_GOALS_2_5";
  }

  if (
    key ===
      "btts_yes" ||
    key ===
      "btts_no"
  ) {
    return "BTTS";
  }

  if (
    key.startsWith(
      "home_team_goals_",
    ) ||
    key.startsWith(
      "away_team_goals_",
    )
  ) {
    /*
     * Popüler listede yalnızca daha anlamlı
     * 0.5 ve 1.5 takım golü çizgileri kullanılır.
     *
     * 2.5 ve 3.5 gibi çok düşük oranlı güvenli
     * marketler sağdaki güvenli listede kalır.
     */
    if (
      key.includes(
        "_0.5_",
      ) ||
      key.includes(
        "_1.5_",
      )
    ) {
      return "TEAM_GOALS";
    }
  }

  return null;
}

function getMarketImportance(
  family:
    PopularPickFamily,
): number {
  switch (
    family
  ) {
    case "MATCH_RESULT":
      return 100;

    case "TOTAL_GOALS_2_5":
      return 95;

    case "BTTS":
      return 92;

    case "DOUBLE_CHANCE":
      return 85;

    case "TEAM_GOALS":
      return 78;
  }
}

function calculateOddsBalance(
  fairOdds:
    number | null,
): number {
  if (
    fairOdds ===
    null
  ) {
    return 40;
  }

  /*
   * Popüler tahminler için ideal aralık:
   * yaklaşık 1.35–2.50.
   */

  if (
    fairOdds <
    1.2
  ) {
    return 15;
  }

  if (
    fairOdds <
    1.35
  ) {
    return 55;
  }

  if (
    fairOdds <=
    2.5
  ) {
    return 100;
  }

  if (
    fairOdds <=
    3.25
  ) {
    return 82;
  }

  if (
    fairOdds <=
    4
  ) {
    return 60;
  }

  return 25;
}

function calculatePopularityScore(
  pick:
    RankedMarketPick,

  family:
    PopularPickFamily,
): number {
  const marketImportance =
    getMarketImportance(
      family,
    );

  const oddsBalance =
    calculateOddsBalance(
      pick.fairOdds,
    );

  /*
   * Popüler seçim puanı:
   *
   * %30 model olasılığı
   * %30 tarihsel reliability
   * %25 market önemi
   * %15 oran dengesi
   */
  return round(
    clamp(
      pick.probability *
        0.3 +
      pick.reliabilityScore *
        0.3 +
      marketImportance *
        0.25 +
      oddsBalance *
        0.15,
      0,
      100,
    ),
  );
}

export function selectPopularPicks(
  picks:
    readonly RankedMarketPick[],
): PopularMarketPick[] {
  const candidates =
    picks
      .map(
        (
          pick,
        ) => {
          const popularFamily =
            resolvePopularFamily(
              pick,
            );

          if (
            !popularFamily
          ) {
            return null;
          }

          /*
           * Ana popüler alanda aşırı düşük veya
           * aşırı yüksek adil oranları göstermiyoruz.
           */
          if (
            pick.fairOdds !==
              null &&
            (
              pick.fairOdds <
                1.2 ||
              pick.fairOdds >
                4
            )
          ) {
            return null;
          }

          return {
            ...pick,

            popularFamily,

            popularityScore:
              calculatePopularityScore(
                pick,
                popularFamily,
              ),
          };
        },
      )
      .filter(
        (
          pick,
        ): pick is PopularMarketPick =>
          pick !==
          null,
      );

  const selected:
    PopularMarketPick[] =
      [];

  for (
    const family
    of FAMILY_ORDER
  ) {
    const familyPick =
      candidates
        .filter(
          (
            pick,
          ) =>
            pick.popularFamily ===
            family,
        )
        .sort(
          (
            first,
            second,
          ) =>
            second.popularityScore -
            first.popularityScore,
        )[0];

    if (
      familyPick
    ) {
      selected.push(
        familyPick,
      );
    }
  }

  return selected.map(
    (
      pick,
      index,
    ) => ({
      ...pick,

      rank:
        index +
        1,
    }),
  );
}
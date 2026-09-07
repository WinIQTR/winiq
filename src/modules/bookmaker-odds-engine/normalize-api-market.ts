import type {
  ApiOddsBet,
  NormalizedOddsMarket,
  NormalizedOddsSelection,
  SupportedOddsMarketFamily,
} from "./types";

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

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9.]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}

function parseDecimalOdds(
  rawValue: string,
): number | null {
  const parsedValue =
    Number.parseFloat(
      rawValue,
    );

  if (
    !Number.isFinite(
      parsedValue,
    ) ||
    parsedValue <=
      1
  ) {
    return null;
  }

  return parsedValue;
}

function parseLine(
  value: string,
): number | null {
  const match =
    value.match(
      /(\d+(?:\.\d+)?)/,
    );

  if (
    !match
  ) {
    return null;
  }

  const parsedValue =
    Number.parseFloat(
      match[1],
    );

  return Number.isFinite(
    parsedValue,
  )
    ? parsedValue
    : null;
}

function resolveMarketDefinition(
  bet:
    ApiOddsBet,
): {
  marketKey: string;
  marketFamily:
    SupportedOddsMarketFamily;
} | null {
  const normalizedName =
    bet.name
      .trim()
      .toLowerCase();

  if (
    normalizedName ===
      "match winner" ||
    normalizedName ===
      "1x2"
  ) {
    return {
      marketKey:
        "match_result",

      marketFamily:
        "MATCH_RESULT",
    };
  }

  if (
    normalizedName ===
      "double chance"
  ) {
    return {
      marketKey:
        "double_chance",

      marketFamily:
        "DOUBLE_CHANCE",
    };
  }

  if (
    normalizedName ===
      "goals over/under" ||
    normalizedName ===
      "total goals"
  ) {
    return {
      marketKey:
        "total_goals_2_5",

      marketFamily:
        "TOTAL_GOALS",
    };
  }

  if (
    normalizedName ===
      "both teams score" ||
    normalizedName ===
      "both teams to score"
  ) {
    return {
      marketKey:
        "btts",

      marketFamily:
        "BTTS",
    };
  }

  if (
    normalizedName ===
      "draw no bet"
  ) {
    return {
      marketKey:
        "draw_no_bet",

      marketFamily:
        "DRAW_NO_BET",
    };
  }

  if (
    [
      "home team total goals",
      "home team goals",
      "home goals over/under",
    ].includes(
      normalizedName,
    )
  ) {
    return {
      marketKey:
        "home_team_goals",

      marketFamily:
        "HOME_TEAM_GOALS",
    };
  }

  if (
    [
      "away team total goals",
      "away team goals",
      "away goals over/under",
    ].includes(
      normalizedName,
    )
  ) {
    return {
      marketKey:
        "away_team_goals",

      marketFamily:
        "AWAY_TEAM_GOALS",
    };
  }

  return null;
}

function normalizeSelectionName(
  family:
    SupportedOddsMarketFamily,

  rawValue:
    string,
): string | null {
  const normalizedValue =
    rawValue
      .trim()
      .toLowerCase();

  if (
    family ===
    "MATCH_RESULT"
  ) {
    if (
      normalizedValue ===
      "home"
    ) {
      return "HOME";
    }

    if (
      normalizedValue ===
      "draw"
    ) {
      return "DRAW";
    }

    if (
      normalizedValue ===
      "away"
    ) {
      return "AWAY";
    }

    return null;
  }

  if (
    family ===
    "DOUBLE_CHANCE"
  ) {
    const compactValue =
      normalizedValue
        .replace(
          /\s+/g,
          "",
        )
        .replace(
          "homeordraw",
          "1x",
        )
        .replace(
          "draworaway",
          "x2",
        )
        .replace(
          "homeoraway",
          "12",
        );

    if (
      compactValue ===
      "1x"
    ) {
      return "1X";
    }

    if (
      compactValue ===
      "x2"
    ) {
      return "X2";
    }

    if (
      compactValue ===
      "12"
    ) {
      return "12";
    }

    return null;
  }

  if (
    family ===
    "BTTS"
  ) {
    if (
      normalizedValue ===
      "yes"
    ) {
      return "YES";
    }

    if (
      normalizedValue ===
      "no"
    ) {
      return "NO";
    }

    return null;
  }

  if (
    family ===
    "DRAW_NO_BET"
  ) {
    if (
      normalizedValue ===
      "home"
    ) {
      return "HOME";
    }

    if (
      normalizedValue ===
      "away"
    ) {
      return "AWAY";
    }

    return null;
  }

  if (
    family ===
      "TOTAL_GOALS" ||
    family ===
      "HOME_TEAM_GOALS" ||
    family ===
      "AWAY_TEAM_GOALS"
  ) {
    const line =
      parseLine(
        rawValue,
      );

    if (
      line ===
      null
    ) {
      return null;
    }

    if (
      family ===
        "TOTAL_GOALS" &&
      line !==
        2.5
    ) {
      return null;
    }

    if (
      (
        family ===
          "HOME_TEAM_GOALS" ||
        family ===
          "AWAY_TEAM_GOALS"
      ) &&
      line !==
        0.5 &&
      line !==
        1.5
    ) {
      return null;
    }

    if (
      normalizedValue.startsWith(
        "over",
      )
    ) {
      return `OVER_${line}`;
    }

    if (
      normalizedValue.startsWith(
        "under",
      )
    ) {
      return `UNDER_${line}`;
    }

    return null;
  }

  return null;
}

function applyNormalizedProbabilities(
  selections:
    NormalizedOddsSelection[],
): NormalizedOddsSelection[] {
  const totalImpliedProbability =
    selections.reduce(
      (
        total,
        selection,
      ) =>
        total +
        selection.impliedProbability,
      0,
    );

  if (
    totalImpliedProbability <=
    0
  ) {
    return selections;
  }

  return selections.map(
    (
      selection,
    ) => ({
      ...selection,

      normalizedProbability:
        round(
          (
            selection.impliedProbability /
            totalImpliedProbability
          ) *
            100,
          4,
        ),
    }),
  );
}

export function normalizeApiMarket(
  bet:
    ApiOddsBet,
): NormalizedOddsMarket | null {
  const definition =
    resolveMarketDefinition(
      bet,
    );

  if (
    !definition
  ) {
    return null;
  }

  const selections:
    NormalizedOddsSelection[] =
      [];

  for (
    const value
    of bet.values
  ) {
    const decimalOdds =
      parseDecimalOdds(
        value.odd,
      );

    if (
      decimalOdds ===
      null
    ) {
      continue;
    }

    const selectionName =
      normalizeSelectionName(
        definition.marketFamily,
        value.value,
      );

    if (
      selectionName ===
      null
    ) {
      continue;
    }

    const line =
      parseLine(
        value.value,
      );

    selections.push({
      selectionKey:
        normalizeText(
          `${definition.marketKey}_${selectionName}`,
        ),

      selectionName,

      decimalOdds,

      impliedProbability:
        round(
          100 /
            decimalOdds,
          4,
        ),

      normalizedProbability:
        null,

      line,
    });
  }

  if (
    selections.length <
    2
  ) {
    return null;
  }

  const normalizedSelections =
    applyNormalizedProbabilities(
      selections,
    );

  return {
    apiBetId:
      bet.id,

    marketKey:
      definition.marketKey,

    marketName:
      bet.name,

    marketFamily:
      definition.marketFamily,

    selections:
      normalizedSelections,
  };
}
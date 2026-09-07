export type SettlementResult =
  | "WON"
  | "LOST"
  | "VOID";

export type MarketSettlement = {
  result: SettlementResult;
  supported: boolean;
};

function wonIf(
  condition: boolean,
): MarketSettlement {
  return {
    result: condition
      ? "WON"
      : "LOST",
    supported: true,
  };
}

function parseLine(
  value: string,
): number | null {
  const line = Number(value);

  return Number.isFinite(line)
    ? line
    : null;
}

/**
 * Settles every market key currently emitted by Market Engine V1.
 * Unknown keys are voided so they cannot silently corrupt accuracy metrics.
 */
export function settleMarketSelection(options: {
  marketKey: string;
  homeScore: number;
  awayScore: number;
}): MarketSettlement {
  const {
    marketKey,
    homeScore,
    awayScore,
  } = options;

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    return {
      result: "VOID",
      supported: false,
    };
  }

  const totalGoals =
    homeScore + awayScore;

  switch (marketKey) {
    case "match_result_home":
      return wonIf(homeScore > awayScore);

    case "match_result_draw":
      return wonIf(homeScore === awayScore);

    case "match_result_away":
      return wonIf(awayScore > homeScore);

    case "double_chance_1x":
      return wonIf(homeScore >= awayScore);

    case "double_chance_x2":
      return wonIf(awayScore >= homeScore);

    case "double_chance_12":
      return wonIf(homeScore !== awayScore);

    case "dnb_home":
      return homeScore === awayScore
        ? { result: "VOID", supported: true }
        : wonIf(homeScore > awayScore);

    case "dnb_away":
      return homeScore === awayScore
        ? { result: "VOID", supported: true }
        : wonIf(awayScore > homeScore);

    case "btts_yes":
      return wonIf(homeScore > 0 && awayScore > 0);

    case "btts_no":
      return wonIf(homeScore === 0 || awayScore === 0);

    case "home_clean_sheet_yes":
      return wonIf(awayScore === 0);

    case "home_clean_sheet_no":
      return wonIf(awayScore > 0);

    case "away_clean_sheet_yes":
      return wonIf(homeScore === 0);

    case "away_clean_sheet_no":
      return wonIf(homeScore > 0);

    case "home_win_to_nil_yes":
      return wonIf(homeScore > awayScore && awayScore === 0);

    case "home_win_to_nil_no":
      return wonIf(!(homeScore > awayScore && awayScore === 0));

    case "away_win_to_nil_yes":
      return wonIf(awayScore > homeScore && homeScore === 0);

    case "away_win_to_nil_no":
      return wonIf(!(awayScore > homeScore && homeScore === 0));

    case "total_goals_odd":
      return wonIf(totalGoals % 2 === 1);

    case "total_goals_even":
      return wonIf(totalGoals % 2 === 0);

    case "btts_yes_over_2.5_yes":
      return wonIf(
        homeScore > 0 &&
        awayScore > 0 &&
        totalGoals > 2.5,
      );

    case "btts_yes_over_2.5_no":
      return wonIf(
        !(
          homeScore > 0 &&
          awayScore > 0 &&
          totalGoals > 2.5
        ),
      );
  }

  const totalGoalsMatch =
    /^total_goals_(over|under)_(\d+(?:\.\d+)?)$/.exec(
      marketKey,
    );

  if (totalGoalsMatch) {
    const line = parseLine(totalGoalsMatch[2]);

    if (line !== null) {
      return wonIf(
        totalGoalsMatch[1] === "over"
          ? totalGoals > line
          : totalGoals < line,
      );
    }
  }

  const teamGoalsMatch =
    /^(home|away)_team_goals_(over|under)_(\d+(?:\.\d+)?)$/.exec(
      marketKey,
    );

  if (teamGoalsMatch) {
    const line = parseLine(teamGoalsMatch[3]);
    const goals =
      teamGoalsMatch[1] === "home"
        ? homeScore
        : awayScore;

    if (line !== null) {
      return wonIf(
        teamGoalsMatch[2] === "over"
          ? goals > line
          : goals < line,
      );
    }
  }

  return {
    result: "VOID",
    supported: false,
  };
}

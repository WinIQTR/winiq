/**
 * 1X2 arbitrage detector (R1ch1k).
 */

export type OneXTwoOdds = {
  home: number;
  draw: number;
  away: number;
};

export type ArbitrageOpportunity = {
  present: boolean;
  impliedSum: number;
  marginPct: number;
  /** Stakes that lock equal profit for unit total stake (if present). */
  stakes: { home: number; draw: number; away: number } | null;
  guaranteedProfitPct: number | null;
};

export function detectOneXTwoArbitrage(odds: OneXTwoOdds): ArbitrageOpportunity {
  const { home, draw, away } = odds;
  if (!(home > 1 && draw > 1 && away > 1)) {
    return {
      present: false,
      impliedSum: Number.POSITIVE_INFINITY,
      marginPct: Number.POSITIVE_INFINITY,
      stakes: null,
      guaranteedProfitPct: null,
    };
  }
  const impliedSum = 1 / home + 1 / draw + 1 / away;
  const present = impliedSum < 1 - 1e-12;
  if (!present) {
    return {
      present: false,
      impliedSum,
      marginPct: (impliedSum - 1) * 100,
      stakes: null,
      guaranteedProfitPct: null,
    };
  }
  const stakes = {
    home: 1 / home / impliedSum,
    draw: 1 / draw / impliedSum,
    away: 1 / away / impliedSum,
  };
  const guaranteedProfitPct = (1 - impliedSum) * 100;
  return {
    present: true,
    impliedSum,
    marginPct: (impliedSum - 1) * 100,
    stakes,
    guaranteedProfitPct,
  };
}

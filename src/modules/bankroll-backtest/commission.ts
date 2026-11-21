/**
 * Exchange-style commission models (R1ch1k NetWinningsCommission).
 */

export type CommissionModel = {
  readonly name: string;
  apply(stake: number, odds: number, won: boolean): number;
};

/** No commission — profit = stake*(odds-1) on win, -stake on loss. */
export const NoCommission: CommissionModel = {
  name: "none",
  apply(stake, odds, won) {
    if (!won) return -stake;
    return stake * (odds - 1);
  },
};

/**
 * Commission charged only on net winnings (Betfair-style).
 * On win: stake*(odds-1)*(1-rate); on loss: -stake.
 */
export class NetWinningsCommission implements CommissionModel {
  readonly name = "net_winnings";
  constructor(private readonly rate: number) {
    if (!(rate >= 0 && rate < 1)) {
      throw new Error("commission rate must be in [0, 1)");
    }
  }

  apply(stake: number, odds: number, won: boolean): number {
    if (!won) return -stake;
    return stake * (odds - 1) * (1 - this.rate);
  }
}

export function settleWithCommission(
  stake: number,
  odds: number,
  result: "WON" | "LOST" | "VOID",
  commission: CommissionModel = NoCommission,
): number {
  if (stake <= 0 || result === "VOID") return 0;
  return commission.apply(stake, odds, result === "WON");
}

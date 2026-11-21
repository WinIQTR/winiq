/**
 * Odds as-of prediction timestamp — never use closing quotes in early mode.
 */

export type TimestampedOddsQuote = {
  id: string;
  observedAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  bookmaker?: string;
};

export type AsOfOddsResult = {
  quote: TimestampedOddsQuote | null;
  rejectedAfterCutoff: number;
  reason: string | null;
};

export function selectOddsAsOf(
  quotes: readonly TimestampedOddsQuote[],
  predictionTimestamp: Date,
): AsOfOddsResult {
  const eligible = quotes
    .filter((quote) => quote.observedAt.getTime() <= predictionTimestamp.getTime())
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const rejectedAfterCutoff = quotes.length - eligible.length;
  if (eligible.length === 0) {
    return {
      quote: null,
      rejectedAfterCutoff,
      reason: "No odds observed at or before the prediction timestamp",
    };
  }
  return {
    quote: eligible[0]!,
    rejectedAfterCutoff,
    reason: null,
  };
}

export function filterOddsHistoryAsOf<T extends { observedAt: Date }>(
  quotes: readonly T[],
  predictionTimestamp: Date,
): T[] {
  return quotes.filter(
    (quote) => quote.observedAt.getTime() <= predictionTimestamp.getTime(),
  );
}

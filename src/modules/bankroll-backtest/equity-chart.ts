import type { BankrollPathPoint } from "@/modules/bankroll-backtest/types";

export type EquityChartSeries = {
  labels: string[];
  bankroll: number[];
  drawdownPct: number[];
  peak: number;
  valley: number;
};

/**
 * Compact series for admin/member equity + underwater drawdown charts.
 */
export function buildEquityChartSeries(
  path: readonly BankrollPathPoint[],
): EquityChartSeries {
  if (path.length === 0) {
    return { labels: [], bankroll: [], drawdownPct: [], peak: 0, valley: 0 };
  }
  const labels = path.map((point, index) =>
    index === 0
      ? "start"
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Istanbul",
          month: "2-digit",
          day: "2-digit",
        }).format(point.date),
  );
  const bankroll = path.map((point) =>
    Math.round(point.bankroll * 100) / 100,
  );
  const drawdownPct = path.map(
    (point) => Math.round(point.drawdownPct * 100) / 100,
  );
  return {
    labels,
    bankroll,
    drawdownPct,
    peak: Math.max(...bankroll),
    valley: Math.min(...bankroll),
  };
}

/** SVG polyline points (0–100 viewBox coords) for a simple sparkline. */
export function toSparklinePoints(
  values: readonly number[],
  width = 100,
  height = 28,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? 0
          : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

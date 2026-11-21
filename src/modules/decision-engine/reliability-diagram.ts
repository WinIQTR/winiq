export type ReliabilityBin = {
  index: number;
  lower: number;
  upper: number;
  count: number;
  averagePredicted: number;
  averageObserved: number;
  gap: number;
};

export type ReliabilityDiagram = {
  bins: ReliabilityBin[];
  ece: number;
  samples: number;
  /** SVG-friendly polyline points for predicted vs observed (0–100). */
  chartPoints: Array<{ x: number; y: number; count: number }>;
};

/**
 * Reliability diagram + ECE over equal-width probability bins.
 */
export function buildReliabilityDiagram(
  rows: readonly { predicted01: number; outcome01: 0 | 1 }[],
  binCount = 10,
): ReliabilityDiagram {
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    lower: index / binCount,
    upper: (index + 1) / binCount,
    count: 0,
    probabilitySum: 0,
    outcomeSum: 0,
  }));

  for (const row of rows) {
    const p = Math.min(0.999999, Math.max(0, row.predicted01));
    const bin = bins[Math.min(binCount - 1, Math.floor(p * binCount))]!;
    bin.count += 1;
    bin.probabilitySum += p;
    bin.outcomeSum += row.outcome01;
  }

  const samples = rows.length;
  let ece = 0;
  const mapped: ReliabilityBin[] = bins.map((bin) => {
    const averagePredicted =
      bin.count === 0 ? (bin.lower + bin.upper) / 2 : bin.probabilitySum / bin.count;
    const averageObserved = bin.count === 0 ? 0 : bin.outcomeSum / bin.count;
    const gap = Math.abs(averagePredicted - averageObserved);
    if (bin.count > 0 && samples > 0) ece += (bin.count / samples) * gap;
    return {
      index: bin.index,
      lower: bin.lower,
      upper: bin.upper,
      count: bin.count,
      averagePredicted,
      averageObserved,
      gap,
    };
  });

  return {
    bins: mapped,
    ece,
    samples,
    chartPoints: mapped
      .filter((bin) => bin.count > 0)
      .map((bin) => ({
        x: Math.round(bin.averagePredicted * 1000) / 10,
        y: Math.round(bin.averageObserved * 1000) / 10,
        count: bin.count,
      })),
  };
}

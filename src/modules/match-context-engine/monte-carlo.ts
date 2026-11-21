/**
 * Monte-Carlo scoreline sampler — cross-check analytic Poisson markets.
 */

export type MonteCarloMarketEstimate = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  over15Prob: number;
  over25Prob: number;
  over35Prob: number;
  bttsProb: number;
  topScorelines: Array<{ score: string; prob: number }>;
  simulations: number;
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knuth Poisson sampler using a uniform RNG. */
function samplePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-Math.max(0, lambda));
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

export function simulateScorelines(
  lambdaHome: number,
  lambdaAway: number,
  options?: { simulations?: number; seed?: number },
): MonteCarloMarketEstimate {
  const simulations = options?.simulations ?? 20_000;
  const rng = mulberry32(options?.seed ?? 42);
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let btts = 0;
  const counts = new Map<string, number>();

  for (let i = 0; i < simulations; i += 1) {
    const h = samplePoisson(lambdaHome, rng);
    const a = samplePoisson(lambdaAway, rng);
    const total = h + a;
    if (h > a) homeWins += 1;
    else if (h === a) draws += 1;
    else awayWins += 1;
    if (total > 1.5) over15 += 1;
    if (total > 2.5) over25 += 1;
    if (total > 3.5) over35 += 1;
    if (h > 0 && a > 0) btts += 1;
    const key = `${h}-${a}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const topScorelines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, count]) => ({
      score,
      prob: Math.round((count / simulations) * 10_000) / 10_000,
    }));

  return {
    homeWinProb: homeWins / simulations,
    drawProb: draws / simulations,
    awayWinProb: awayWins / simulations,
    over15Prob: over15 / simulations,
    over25Prob: over25 / simulations,
    over35Prob: over35 / simulations,
    bttsProb: btts / simulations,
    topScorelines,
    simulations,
  };
}

export type AnalyticMarkets = {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  over15Prob?: number;
  over25Prob?: number;
  over35Prob?: number;
  bttsProb?: number;
};

export type MonteCarloCrossCheck = {
  mc: MonteCarloMarketEstimate;
  maxAbsDiff1x2: number;
  withinTolerance: boolean;
  diffs: Record<string, number>;
};

export function crossCheckAnalyticVsMonteCarlo(
  analytic: AnalyticMarkets,
  lambdaHome: number,
  lambdaAway: number,
  options?: { simulations?: number; seed?: number; tolerance?: number },
): MonteCarloCrossCheck {
  const mc = simulateScorelines(lambdaHome, lambdaAway, options);
  const tolerance = options?.tolerance ?? 0.03;
  const diffs: Record<string, number> = {
    home: mc.homeWinProb - analytic.homeWinProb,
    draw: mc.drawProb - analytic.drawProb,
    away: mc.awayWinProb - analytic.awayWinProb,
  };
  if (analytic.over25Prob != null) {
    diffs.over25 = mc.over25Prob - analytic.over25Prob;
  }
  if (analytic.bttsProb != null) {
    diffs.btts = mc.bttsProb - analytic.bttsProb;
  }
  const maxAbsDiff1x2 = Math.max(
    Math.abs(diffs.home!),
    Math.abs(diffs.draw!),
    Math.abs(diffs.away!),
  );
  return {
    mc,
    maxAbsDiff1x2,
    withinTolerance: maxAbsDiff1x2 <= tolerance,
    diffs,
  };
}

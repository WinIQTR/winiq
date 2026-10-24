import "dotenv/config";

import {
  buildSpecialCandidates,
  filterSpecialMatches,
  loadSpecialListPredictions,
  sortSpecialCandidates,
} from "../src/lib/special-list";

async function main() {
  const t0 = Date.now();
  const { predictions, source } = await loadSpecialListPredictions();
  const loadMs = Date.now() - t0;
  const week = filterSpecialMatches(predictions, "week");
  const day = filterSpecialMatches(predictions, "day");
  const candidates = sortSpecialCandidates(buildSpecialCandidates(week, "ALL"), {
    sortProb: true,
  });

  console.log(
    JSON.stringify(
      {
        loadMs,
        source,
        total: predictions.length,
        dayMatches: day.length,
        weekMatches: week.length,
        weekCandidates: candidates.length,
        sample: candidates.slice(0, 5).map((row) => ({
          match: `${row.prediction.homeTeam} vs ${row.prediction.awayTeam}`,
          market: row.marketLabel,
          selection: row.selection,
          probability: Number(row.probability.toFixed(1)),
        })),
      },
      null,
      2,
    ),
  );

  if (loadMs > 5_000) {
    throw new Error(`Special List load too slow: ${loadMs}ms`);
  }
  if (predictions.length === 0) {
    throw new Error("Special List returned zero predictions (snapshot missing?)");
  }
  if (candidates.length === 0) {
    console.warn("No week candidates for current kickoff window — empty UI is OK, hang is not.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

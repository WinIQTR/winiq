import {
  buildMarketLineMove,
  classifyMarketLineMove,
  marketLineMoveKey,
} from "@/lib/market-line-move";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(classifyMarketLineMove(1.45, 1.52) === "up", "rising line → up");
assert(classifyMarketLineMove(2.12, 2.05) === "down", "falling line → down");
assert(classifyMarketLineMove(1.9, 1.901) === "flat", "tiny delta → flat");
assert(marketLineMoveKey(12, "btts_yes") === "12:btts_yes", "key format");

const move = buildMarketLineMove(1.45, 1.52);
assert(move?.direction === "up", "build up");
assert(move?.openingOdds === 1.45 && move.currentOdds === 1.52, "build odds");
assert(buildMarketLineMove(0.9, 1.5) === null, "reject invalid opening");

console.log("market-line-move.selftest: ok");

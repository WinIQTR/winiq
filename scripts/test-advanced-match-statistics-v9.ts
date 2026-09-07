import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const importer = readFileSync(
  resolve(process.cwd(), "scripts/import-advanced-match-statistics-v9.ts"),
  "utf8",
);
const engine = readFileSync(
  resolve(process.cwd(), "src/modules/importer/football/api-football/import-match-team-statistics.ts"),
  "utf8",
);
const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const marketEngine = readFileSync(
  resolve(process.cwd(), "src/modules/market-engine/calculate-cards-corners-market.ts"),
  "utf8",
);
const catalog = readFileSync(resolve(process.cwd(), "src/lib/bet-market-catalog.ts"), "utf8");
const refreshScript = readFileSync(
  resolve(process.cwd(), "scripts/refresh-upcoming-advanced-markets-v9.ts"),
  "utf8",
);

assert.match(importer, /CONFIRM_MATCH_STATS_IMPORT/);
assert.match(importer, /MATCH_STATS_MATCH_LIMIT/);
assert.match(importer, /ACTIVE_COMPETITIONS/);
assert.match(importer, /Ana %20 ML \/ %80 Poisson ağırlıkları değiştirilmedi/);
assert.match(engine, /fixtures\/statistics/);
assert.match(engine, /Corner Kicks/);
assert.match(engine, /Offsides/);
assert.match(engine, /Yellow Cards/);
assert.match(engine, /Total Shots/);
assert.match(engine, /Shots on Goal/);
assert.match(engine, /stoppedByRateLimit/);
assert.match(engine, /API_FOOTBALL_NO_DATA/);
assert.match(engine, /refreshIncomplete = false/);
assert.match(packageJson, /statistics:import-v9/);
assert.match(packageJson, /statistics:coverage-v9/);
assert.match(marketEngine, /Toplam Ofsayt/);
assert.match(marketEngine, /Toplam İsabetli Şut/);
assert.match(marketEngine, /stats\.length < 3/);
assert.match(catalog, /offsides\.length \? group\(23/);
assert.match(catalog, /shots\.length \? group\(24/);
assert.match(marketEngine, /seasonStats\.length < 3/);
assert.match(refreshScript, /mergeExisting: false/);
assert.match(refreshScript, /MS olasılıkları, yayın kararları/);
assert.match(packageJson, /markets:refresh-upcoming-v9/);

console.log("V9.5.6 advanced markets refresh tests passed.");

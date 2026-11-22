import assert from "node:assert/strict";

import {
  MEMBER_ODDS_BAND_DEFS,
  mapPublishedOddsToBandKey,
  resolvePublishedSelectionOdds,
} from "../src/lib/member-odds-bands";

assert.equal(MEMBER_ODDS_BAND_DEFS.length, 5);

assert.equal(mapPublishedOddsToBandKey(1.1), "o110_149");
assert.equal(mapPublishedOddsToBandKey(1.49), "o110_149");
assert.equal(mapPublishedOddsToBandKey(1.5), "o150_179");
assert.equal(mapPublishedOddsToBandKey(1.79), "o150_179");
assert.equal(mapPublishedOddsToBandKey(1.8), "o180_219");
assert.equal(mapPublishedOddsToBandKey(2.19), "o180_219");
assert.equal(mapPublishedOddsToBandKey(2.2), "o220_299");
assert.equal(mapPublishedOddsToBandKey(2.99), "o220_299");
assert.equal(mapPublishedOddsToBandKey(3.0), "o300_plus");
assert.equal(mapPublishedOddsToBandKey(5.5), "o300_plus");
assert.equal(mapPublishedOddsToBandKey(1.09), null);

assert.equal(
  resolvePublishedSelectionOdds({ fairOdds: 1.8, marketOdds: 2.2 }),
  2.2,
);
assert.equal(
  resolvePublishedSelectionOdds({ fairOdds: 1.8, marketOdds: null }),
  1.8,
);
assert.equal(
  resolvePublishedSelectionOdds({ fairOdds: null, marketOdds: 2.5 }),
  2.5,
);

console.log("test-member-odds-bands-v1: ok (scheme A · 5 bands)");

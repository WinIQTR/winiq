import assert from "node:assert/strict";

import {
  mapPublishedOddsToBandKey,
  resolvePublishedSelectionOdds,
} from "../src/lib/member-odds-bands";

assert.equal(mapPublishedOddsToBandKey(1.1), "o110_150");
assert.equal(mapPublishedOddsToBandKey(1.5), "o110_150");
assert.equal(mapPublishedOddsToBandKey(1.51), "o151_175");
assert.equal(mapPublishedOddsToBandKey(1.75), "o151_175");
assert.equal(mapPublishedOddsToBandKey(1.76), "o176_200");
assert.equal(mapPublishedOddsToBandKey(2.0), "o176_200");
assert.equal(mapPublishedOddsToBandKey(2.01), "o200_300");
assert.equal(mapPublishedOddsToBandKey(3.0), "o200_300");
assert.equal(mapPublishedOddsToBandKey(3.01), "o300_plus");
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

console.log("test-member-odds-bands-v1: ok");

import assert from "node:assert/strict";

import {
  mapPublishedOddsToBandKey,
  resolvePublishedSelectionOdds,
} from "../src/lib/member-odds-bands";

assert.equal(mapPublishedOddsToBandKey(1.1), "o110_145");
assert.equal(mapPublishedOddsToBandKey(1.45), "o110_145");
assert.equal(mapPublishedOddsToBandKey(1.46), "o146_185");
assert.equal(mapPublishedOddsToBandKey(1.85), "o146_185");
assert.equal(mapPublishedOddsToBandKey(1.86), "o186_215");
assert.equal(mapPublishedOddsToBandKey(2.15), "o186_215");
assert.equal(mapPublishedOddsToBandKey(2.16), "o216_plus");
assert.equal(mapPublishedOddsToBandKey(3.5), "o216_plus");
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

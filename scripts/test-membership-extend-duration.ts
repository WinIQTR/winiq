import assert from "node:assert/strict";

import {
  extendMembershipEndsAt,
  parseDurationFromNote,
} from "../src/lib/membership-commerce";

const now = new Date("2026-11-25T10:00:00.000Z");

{
  const fromNull = extendMembershipEndsAt(null, "MONTHLY", now);
  assert.equal(fromNull.toISOString().slice(0, 7), "2026-12");
}

{
  const future = new Date("2026-12-10T12:00:00.000Z");
  const extended = extendMembershipEndsAt(future, "QUARTERLY", now);
  assert.equal(extended.toISOString().slice(0, 7), "2027-03");
}

{
  const past = new Date("2026-10-01T12:00:00.000Z");
  const extended = extendMembershipEndsAt(past, "YEARLY", now);
  assert.equal(extended.toISOString().slice(0, 7), "2027-11");
}

assert.equal(parseDurationFromNote("RENEW QUARTERLY · single membership"), "QUARTERLY");
assert.equal(parseDurationFromNote("no duration here"), null);

console.log("test-membership-extend-duration: ok");

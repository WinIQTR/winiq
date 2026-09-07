import assert from "node:assert/strict";
import { join } from "node:path";

import {
  VALUE_BET_DASHBOARD_SNAPSHOT_PATH,
} from "@/lib/value-bet-dashboard-snapshot";

assert.equal(
  VALUE_BET_DASHBOARD_SNAPSHOT_PATH,
  join(
    process.cwd(),
    "data",
    "value-bet-dashboard-snapshot.json",
  ),
);
assert.ok(
  VALUE_BET_DASHBOARD_SNAPSHOT_PATH.startsWith(
    join(process.cwd(), "data"),
  ),
);

console.log("Production Snapshot Static Trace V3.4.3 tests passed.");

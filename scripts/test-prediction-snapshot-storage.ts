import assert from "node:assert/strict";
import { join } from "node:path";

import {
  PREDICTION_DASHBOARD_SNAPSHOT_PATH,
} from "@/lib/prediction-dashboard-snapshot";

assert.equal(
  PREDICTION_DASHBOARD_SNAPSHOT_PATH,
  join(
    process.cwd(),
    "data",
    "production-dashboard-snapshot.json",
  ),
);
assert.ok(
  PREDICTION_DASHBOARD_SNAPSHOT_PATH.startsWith(
    join(process.cwd(), "data"),
  ),
);

console.log("Prediction Dashboard Static Trace V3.4.4 tests passed.");

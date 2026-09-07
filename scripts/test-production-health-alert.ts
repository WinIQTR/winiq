import assert from "node:assert/strict";

import {
  decideHealthNotification,
  type ProductionHealthState,
} from "@/lib/production-health-alert";

function state(options: {
  level: "HEALTHY" | "WARNING" | "CRITICAL";
  observedAt: string;
  notifiedAt: string | null;
}): ProductionHealthState {
  return {
    schemaVersion: 1,
    currentLevel: options.level,
    firstSeenAt: options.observedAt,
    lastObservedAt: options.observedAt,
    lastNotifiedAt: options.notifiedAt,
    notificationCount: options.notifiedAt ? 1 : 0,
  };
}

const now = new Date("2026-08-14T12:00:00.000Z");

assert.deepEqual(
  decideHealthNotification(null, "HEALTHY", now),
  { reason: "FIRST_OBSERVATION", shouldNotify: false },
);
assert.deepEqual(
  decideHealthNotification(null, "WARNING", now),
  { reason: "FIRST_OBSERVATION", shouldNotify: true },
);
assert.deepEqual(
  decideHealthNotification(
    state({
      level: "WARNING",
      observedAt: "2026-08-14T10:00:00.000Z",
      notifiedAt: "2026-08-14T10:00:00.000Z",
    }),
    "WARNING",
    now,
  ),
  { reason: "OBSERVATION", shouldNotify: false },
);
assert.deepEqual(
  decideHealthNotification(
    state({
      level: "WARNING",
      observedAt: "2026-08-13T11:00:00.000Z",
      notifiedAt: "2026-08-13T11:00:00.000Z",
    }),
    "WARNING",
    now,
  ),
  { reason: "REMINDER", shouldNotify: true },
);
assert.deepEqual(
  decideHealthNotification(
    state({
      level: "WARNING",
      observedAt: "2026-08-14T10:00:00.000Z",
      notifiedAt: "2026-08-14T10:00:00.000Z",
    }),
    "CRITICAL",
    now,
  ),
  { reason: "DEGRADATION", shouldNotify: true },
);
assert.deepEqual(
  decideHealthNotification(
    state({
      level: "CRITICAL",
      observedAt: "2026-08-14T10:00:00.000Z",
      notifiedAt: "2026-08-14T10:00:00.000Z",
    }),
    "HEALTHY",
    now,
  ),
  { reason: "RECOVERY", shouldNotify: true },
);

console.log("Production Health Logging and Notification V3.3 tests passed.");

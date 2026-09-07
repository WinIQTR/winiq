import assert from "node:assert/strict";

import {
  parseBackupManifest,
  parseHealthEvent,
  parseHealthState,
  parseNotification,
  parseProductionReport,
} from "../src/lib/production-operations-dashboard";

const backup = parseBackupManifest({
  schemaVersion: 1,
  createdAt: "2026-08-14T06:00:50.277Z",
  databaseFormat: "postgresql-custom",
  secretsIncluded: false,
  files: [
    { path: "database/production.dump", sizeBytes: 8_000_000, sha256: "a" },
    { path: "data/snapshot.json", sizeBytes: 120_000, sha256: "b" },
  ],
}, "20260814T060050Z");
assert.equal(backup.available, true);
assert.equal(backup.fileCount, 2);
assert.equal(backup.totalBytes, 8_120_000);
assert.equal(backup.secretsIncluded, false);

const weekly = parseProductionReport({
  schemaVersion: 1,
  generatedAt: "2026-08-14T06:10:00.000Z",
  period: { kind: "WEEKLY", key: "2026-W33" },
  settled: { settled: 14, roi: 29.8 },
  modelHealth: { overallLevel: "WARNING" },
}, "WEEKLY");
assert.equal(weekly.available, true);
assert.equal(weekly.settled, 14);
assert.equal(weekly.roi, 29.8);

const state = parseHealthState({
  schemaVersion: 1,
  currentLevel: "WARNING",
  lastObservedAt: "2026-08-14T06:20:00.000Z",
  lastNotifiedAt: "2026-08-14T06:20:00.000Z",
  notificationCount: 1,
});
assert.equal(state.available, true);
assert.equal(state.currentLevel, "WARNING");
assert.equal(state.notificationCount, 1);

const event = parseHealthEvent({
  observedAt: "2026-08-14T06:20:00.000Z",
  level: "WARNING",
  reason: "FIRST_OBSERVATION",
  notificationCreated: true,
  metrics: { independentSelections: 9 },
});
assert.ok(event);
assert.equal(event.independentSelections, 9);
assert.equal(event.notificationCreated, true);

const notification = parseNotification({
  createdAt: "2026-08-14T06:20:00.000Z",
  severity: "WARNING",
  reason: "FIRST_OBSERVATION",
  title: "Bet Project Production Health: WARNING",
  acknowledged: false,
});
assert.ok(notification);
assert.equal(notification.acknowledged, false);

assert.equal(parseHealthEvent({ bad: true }), null);
assert.equal(parseNotification({ bad: true }), null);

console.log("Production Operations Dashboard V4.1 tests passed.");

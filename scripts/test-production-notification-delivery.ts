import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNotificationDeliveryReadiness,
  deliverProductionNotifications,
} from "../src/lib/production-notification-delivery";

const notification = {
  schemaVersion: 1,
  createdAt: "2026-08-14T06:20:00.000Z",
  channel: "LOCAL_OUTBOX",
  severity: "WARNING",
  reason: "FIRST_OBSERVATION",
  title: "Bet Project Production Health: WARNING",
  message: "Production model health is WARNING.",
  acknowledged: false,
  production: {
    champion: "20% ML / 80% Poisson",
    automaticModelChangeAllowed: false,
  },
};

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "bet-project-notification-v4-"));
  const path = join(root, "20260814T062000000Z-warning.json");
  try {
    await writeFile(path, `${JSON.stringify(notification, null, 2)}\n`, "utf8");
    const blockedEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PRODUCTION_NOTIFICATION_DELIVERY_ENABLED: "false",
      PRODUCTION_NOTIFICATION_WEBHOOK_URL: "https://alerts.example.test/health",
    };
    const blocked = await deliverProductionNotifications({
      environment: blockedEnvironment,
      notificationDirectory: root,
    });
    assert.equal(blocked.status, "SAFELY_BLOCKED");
    assert.equal(blocked.attempted, 0);
    assert.equal(
      (JSON.parse(await readFile(path, "utf8")) as { acknowledged: boolean }).acknowledged,
      false,
    );

    assert.equal(buildNotificationDeliveryReadiness({
      NODE_ENV: "test",
      PRODUCTION_NOTIFICATION_DELIVERY_ENABLED: "true",
      PRODUCTION_NOTIFICATION_WEBHOOK_URL: "http://localhost:3000/hook",
    }).status, "SAFELY_BLOCKED");

    let receivedAuthorization = "";
    let receivedBody = "";
    const delivered = await deliverProductionNotifications({
      environment: {
        NODE_ENV: "test",
        PRODUCTION_NOTIFICATION_DELIVERY_ENABLED: "true",
        PRODUCTION_NOTIFICATION_WEBHOOK_URL: "https://alerts.example.test/health",
        PRODUCTION_NOTIFICATION_WEBHOOK_TOKEN: "test-secret-never-persist",
      },
      notificationDirectory: root,
      now: new Date("2026-08-14T07:00:00.000Z"),
      fetcher: async (_input, init) => {
        receivedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
        receivedBody = String(init?.body ?? "");
        return new Response(null, { status: 204 });
      },
    });
    assert.equal(delivered.status, "DELIVERED");
    assert.equal(delivered.delivered, 1);
    assert.equal(receivedAuthorization, "Bearer test-secret-never-persist");
    assert.match(receivedBody, /"automaticModelChangeAllowed":false/);

    const stored = await readFile(path, "utf8");
    assert.doesNotMatch(stored, /test-secret-never-persist/);
    const parsed = JSON.parse(stored) as {
      acknowledged: boolean;
      delivery: { status: string; responseStatus: number; attempts: number };
      production: { automaticModelChangeAllowed: boolean };
    };
    assert.equal(parsed.acknowledged, true);
    assert.equal(parsed.delivery.status, "DELIVERED");
    assert.equal(parsed.delivery.responseStatus, 204);
    assert.equal(parsed.delivery.attempts, 1);
    assert.equal(parsed.production.automaticModelChangeAllowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  console.log("Production Notification Delivery V4.2 tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

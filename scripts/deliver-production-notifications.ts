import { deliverProductionNotifications } from "../src/lib/production-notification-delivery";

async function main(): Promise<void> {
  console.log("\nPRODUCTION NOTIFICATION DELIVERY\n");
  const result = await deliverProductionNotifications();
  console.table({
    Status: result.status,
    Readiness: result.readiness.status,
    Discovered: result.discovered,
    Attempted: result.attempted,
    Delivered: result.delivered,
    Failed: result.failed,
    "Unsafe skipped": result.skippedUnsafe,
    Champion: "20% ML / 80% Poisson",
    "Model auto-change": "LOCKED",
  });
  if (result.status === "SAFELY_BLOCKED") {
    console.log(result.readiness.reason);
    console.log("No external notification was sent and no outbox file was modified.");
    return;
  }
  console.log("Production notification delivery run completed.");
}

main().catch((error: unknown) => {
  console.error("Production notification delivery failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

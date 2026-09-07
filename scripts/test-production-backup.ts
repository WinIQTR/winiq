import assert from "node:assert/strict";
import {
  buildPostgresBackupEnvironment,
  productionBackupIsDue,
} from "@/lib/production-backup";

const environment = buildPostgresBackupEnvironment(
  "postgresql://backup_user:p%40ssword@localhost:5433/bet_project?sslmode=require",
  { NODE_ENV: "test", PATH: "test-path" },
);
assert.equal(environment.PGHOST, "localhost");
assert.equal(environment.PGPORT, "5433");
assert.equal(environment.PGUSER, "backup_user");
assert.equal(environment.PGPASSWORD, "p@ssword");
assert.equal(environment.PGDATABASE, "bet_project");
assert.equal(environment.PGSSLMODE, "require");
assert.equal(environment.PATH, "test-path");
assert.equal(environment.DATABASE_URL, undefined);

const createdAt = new Date("2026-08-14T00:00:00.000Z");
assert.equal(productionBackupIsDue(createdAt, new Date("2026-08-14T19:59:59.000Z")), false);
assert.equal(productionBackupIsDue(createdAt, new Date("2026-08-14T20:00:00.000Z")), true);

console.log("Production Backup and Recovery V3.1 tests passed.");

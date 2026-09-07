import "dotenv/config";
import { backupDisplayName, verifyProductionBackup } from "@/lib/production-backup";

async function main(): Promise<void> {
  const result = await verifyProductionBackup(process.argv[2]);
  console.table({ Status: "VALID", Backup: backupDisplayName(result.backupPath), Files: result.fileCount, "Total MB": (result.totalBytes / 1024 / 1024).toFixed(2), "Created at": result.createdAt.toISOString(), "PostgreSQL dump": result.databaseDumpValid ? "VALID" : "INVALID" });
  console.log("Production backup verification passed.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

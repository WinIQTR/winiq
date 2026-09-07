import "dotenv/config";
import { backupDisplayName, runProductionBackup } from "@/lib/production-backup";

async function main(): Promise<void> {
  const result = await runProductionBackup({ force: process.argv.includes("--force") });
  console.table({ Status: result.status, Backup: backupDisplayName(result.backupPath), Files: result.fileCount, "Total MB": (result.totalBytes / 1024 / 1024).toFixed(2), "Created at": result.createdAt.toISOString() });
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

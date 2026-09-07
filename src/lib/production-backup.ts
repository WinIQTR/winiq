import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const BACKUP_SCHEMA_VERSION = 1;
const DEFAULT_MINIMUM_INTERVAL_HOURS = 20;
const HOUR_MS = 60 * 60 * 1000;

type BackupFile = { path: string; sizeBytes: number; sha256: string };
type BackupManifest = { schemaVersion: typeof BACKUP_SCHEMA_VERSION; createdAt: string; databaseFormat: "postgresql-custom"; files: BackupFile[]; secretsIncluded: false };

export type ProductionBackupResult = { status: "CREATED" | "SKIPPED"; backupPath: string; createdAt: Date; fileCount: number; totalBytes: number };
export type BackupVerificationResult = { backupPath: string; createdAt: Date; fileCount: number; totalBytes: number; databaseDumpValid: boolean };

function backupRoot(): string {
  const productionDataRoot = process.env.PRODUCTION_DATA_ROOT?.trim();
  return resolve(
    process.env.PRODUCTION_BACKUP_DIR?.trim() ||
      (productionDataRoot
        ? join(productionDataRoot, "backups", "production")
        : join(process.cwd(), "backups", "production")),
  );
}

export function buildPostgresBackupEnvironment(
  databaseUrl: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const parsed = new URL(databaseUrl);
  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) throw new Error("DATABASE_URL must use postgresql:// or postgres://.");
  const sslMode = parsed.searchParams.get("sslmode");
  return { ...baseEnvironment, PGHOST: parsed.hostname, PGPORT: parsed.port || "5432", PGUSER: decodeURIComponent(parsed.username), PGPASSWORD: decodeURIComponent(parsed.password), PGDATABASE: parsed.pathname.replace(/^\//, ""), ...(sslMode ? { PGSSLMODE: sslMode } : {}) };
}

export function productionBackupIsDue(
  previousCreatedAt: Date,
  now: Date,
  minimumIntervalHours = DEFAULT_MINIMUM_INTERVAL_HOURS,
): boolean {
  return now.getTime() - previousCreatedAt.getTime() >= minimumIntervalHours * HOUR_MS;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.on("close", (code) => code === 0 ? resolvePromise(stdout) : reject(new Error(`${command} failed with exit code ${code}. ${stderr.trim()}`)));
  });
}

async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile() && entry.name !== "manifest.json") files.push(path);
  }
  return files.sort();
}

async function checksum(path: string): Promise<string> { return createHash("sha256").update(await readFile(path)).digest("hex"); }

async function createManifest(directory: string, createdAt: Date): Promise<BackupManifest> {
  const files: BackupFile[] = [];
  for (const path of await filesUnder(directory)) {
    const info = await stat(path);
    files.push({ path: relative(directory, path).replaceAll("\\", "/"), sizeBytes: info.size, sha256: await checksum(path) });
  }
  return { schemaVersion: BACKUP_SCHEMA_VERSION, createdAt: createdAt.toISOString(), databaseFormat: "postgresql-custom", files, secretsIncluded: false };
}

async function latestBackupDirectory(root: string): Promise<string | null> {
  if (!await exists(root)) return null;
  const candidates = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".tmp-") && /^\d{8}T\d{6}Z$/.test(entry.name))
    .map((entry) => join(root, entry.name)).sort().reverse();
  for (const candidate of candidates) if (await exists(join(candidate, "manifest.json"))) return candidate;
  return null;
}

async function readManifest(directory: string): Promise<BackupManifest> {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION || !Array.isArray(manifest.files)) throw new Error("Backup manifest is invalid.");
  return manifest;
}

export async function runProductionBackup(options: { force?: boolean; now?: Date } = {}): Promise<ProductionBackupResult> {
  const now = options.now ?? new Date();
  const root = backupRoot();
  await mkdir(root, { recursive: true });
  const latest = await latestBackupDirectory(root);
  if (latest && !options.force) {
    const manifest = await readManifest(latest);
    const createdAt = new Date(manifest.createdAt);
    if (!Number.isNaN(createdAt.getTime()) && !productionBackupIsDue(createdAt, now)) {
      return { status: "SKIPPED", backupPath: latest, createdAt, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((total, file) => total + file.sizeBytes, 0) };
    }
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is missing; production backup was not created.");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const finalDirectory = join(root, stamp);
  const temporaryDirectory = join(root, `.tmp-${stamp}-${process.pid}`);
  if (await exists(finalDirectory)) throw new Error(`Backup target already exists: ${finalDirectory}`);
  try {
    await mkdir(join(temporaryDirectory, "database"), { recursive: true });
    await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${join(temporaryDirectory, "database", "production.dump")}`], buildPostgresBackupEnvironment(databaseUrl));
    const dataDirectory = join(process.cwd(), "data");
    if (await exists(dataDirectory)) await cp(dataDirectory, join(temporaryDirectory, "data"), { recursive: true });
    const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
    if (await exists(schemaPath)) { await mkdir(join(temporaryDirectory, "prisma"), { recursive: true }); await cp(schemaPath, join(temporaryDirectory, "prisma", "schema.prisma")); }
    const migrationsPath = join(process.cwd(), "prisma", "migrations");
    if (await exists(migrationsPath)) await cp(migrationsPath, join(temporaryDirectory, "prisma", "migrations"), { recursive: true });
    await run("pg_restore", ["--list", join(temporaryDirectory, "database", "production.dump")], process.env);
    const manifest = await createManifest(temporaryDirectory, now);
    await writeFile(join(temporaryDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(temporaryDirectory, finalDirectory);
    return { status: "CREATED", backupPath: finalDirectory, createdAt: now, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((total, file) => total + file.sizeBytes, 0) };
  } catch (error) { await rm(temporaryDirectory, { recursive: true, force: true }); throw error; }
}

export async function verifyProductionBackup(directory?: string): Promise<BackupVerificationResult> {
  const target = directory ? resolve(directory) : await latestBackupDirectory(backupRoot());
  if (!target) throw new Error("No production backup was found.");
  const manifest = await readManifest(target);
  for (const file of manifest.files) {
    const path = join(target, ...file.path.split("/"));
    const info = await stat(path);
    if (info.size !== file.sizeBytes) throw new Error(`Backup size mismatch: ${file.path}`);
    if (await checksum(path) !== file.sha256) throw new Error(`Backup checksum mismatch: ${file.path}`);
  }
  await run("pg_restore", ["--list", join(target, "database", "production.dump")], process.env);
  return { backupPath: target, createdAt: new Date(manifest.createdAt), fileCount: manifest.files.length, totalBytes: manifest.files.reduce((total, file) => total + file.sizeBytes, 0), databaseDumpValid: true };
}

export function backupDisplayName(path: string): string { return basename(path); }

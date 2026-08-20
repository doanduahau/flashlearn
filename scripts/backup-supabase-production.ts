import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { CAPYSTUDY_PRODUCTION_SUPABASE_PROJECT_REF } from "../src/lib/supabase/production-project";

const CLI_JS = path.resolve("node_modules/supabase/dist/supabase.js");
const LINKED_PROJECT_JSON = path.resolve("supabase/.temp/linked-project.json");
const BACKUP_ROOT = path.resolve("backups/production");

type DumpMode = "roles" | "schema" | "data";

const DUMP_ARGS: Record<DumpMode, readonly string[]> = {
  roles: ["db", "dump", "--linked", "--role-only"],
  schema: ["db", "dump", "--linked"],
  data: ["db", "dump", "--linked", "--data-only"],
};

const CONTENT_MARKERS: Record<DumpMode, RegExp> = {
  roles: /ALTER ROLE|GRANT/,
  schema:
    /create (or replace )?(table|function|view|index|trigger|policy|extension)|CREATE (TABLE|FUNCTION|VIEW|INDEX|TRIGGER|POLICY|EXTENSION)/i,
  data: /INSERT INTO|COPY /,
};

function readProjectRef(): string {
  if (!existsSync(LINKED_PROJECT_JSON)) {
    throw new Error(
      `Linked project file not found at ${LINKED_PROJECT_JSON}. Run "npx supabase link" first.`,
    );
  }
  const parsed = JSON.parse(readFileSync(LINKED_PROJECT_JSON, "utf8")) as { ref?: string };
  if (typeof parsed.ref !== "string" || parsed.ref.length === 0) {
    throw new Error(`Linked project file does not contain a project ref: ${LINKED_PROJECT_JSON}`);
  }
  return parsed.ref;
}

function assertProductionProjectRef(linkedRef: string): void {
  if (linkedRef !== CAPYSTUDY_PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(
      `Refusing to back up linked project "${linkedRef}". Expected production project ` +
        `"${CAPYSTUDY_PRODUCTION_SUPABASE_PROJECT_REF}". This script only backs up production.`,
    );
  }
}

function utcTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function runDump(mode: DumpMode, filePath: string): void {
  const args = [...DUMP_ARGS[mode], "--file", filePath];
  const result = spawnSync(process.execPath, [CLI_JS, ...args], {
    encoding: "utf8",
    timeout: 15 * 60_000,
  });

  if (result.error) {
    throw new Error(`Failed to spawn Supabase CLI for ${mode} dump: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    throw new Error(
      `Supabase CLI exited with status ${result.status} during ${mode} dump. ${stderr}`,
    );
  }
  if (!existsSync(filePath)) {
    throw new Error(`Dump file was not created for ${mode}: ${filePath}`);
  }
  const size = statSync(filePath).size;
  if (size === 0) {
    throw new Error(`${mode} dump file is empty: ${filePath}`);
  }
  const content = readFileSync(filePath, "utf8");
  if (!CONTENT_MARKERS[mode].test(content)) {
    throw new Error(
      `${mode} dump file does not contain expected content markers (${CONTENT_MARKERS[mode]}): ${filePath}`,
    );
  }
}

function retentionDays(): number {
  const raw = process.env.BACKUP_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === "") return 35;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`BACKUP_RETENTION_DAYS must be a non-negative number, got "${raw}".`);
  }
  return value;
}

function pruneOldBackups(days: number): void {
  if (days <= 0) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  if (!existsSync(BACKUP_ROOT)) return;
  for (const entry of readdirSync(BACKUP_ROOT)) {
    const entryPath = path.join(BACKUP_ROOT, entry);
    if (!/^\d{8}-\d{6}$/.test(entry) || !statSync(entryPath).isDirectory()) continue;
    if (statSync(entryPath).mtimeMs < cutoff) {
      rmRecursive(entryPath);
      console.log(`Pruned expired backup: ${entryPath}`);
    }
  }
}

function rmRecursive(target: string): void {
  rmSync(target, { recursive: true, force: true });
}

function main(): void {
  if (!existsSync(CLI_JS)) {
    throw new Error(
      `Supabase CLI not found at ${CLI_JS}. Run "npm install" first (supabase is a devDependency).`,
    );
  }

  const linkedRef = readProjectRef();
  assertProductionProjectRef(linkedRef);

  const timestamp = utcTimestamp();
  const backupDir = path.join(BACKUP_ROOT, timestamp);
  mkdirSync(backupDir, { recursive: true });

  const files: Array<{ mode: DumpMode; path: string }> = [
    { mode: "roles", path: path.join(backupDir, `roles-${timestamp}.sql`) },
    { mode: "schema", path: path.join(backupDir, `schema-${timestamp}.sql`) },
    { mode: "data", path: path.join(backupDir, `data-${timestamp}.sql`) },
  ];

  for (const { mode, path: filePath } of files) {
    runDump(mode, filePath);
    console.log(`Backed up ${mode} -> ${filePath}`);
  }

  const manifest = {
    createdAtUtc: new Date().toISOString(),
    projectRef: linkedRef,
    projectName: "flashlearn-production",
    files: files.map(({ mode, path: filePath }) => ({
      mode,
      fileName: path.basename(filePath),
      sizeBytes: statSync(filePath).size,
      sha256: sha256(filePath),
    })),
  };
  const manifestPath = path.join(backupDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Backup manifest -> ${manifestPath}`);

  pruneOldBackups(retentionDays());
  console.log(`Backup complete: ${backupDir}`);
}

main();

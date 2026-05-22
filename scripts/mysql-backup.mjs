import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const backupDir = path.resolve(process.env.MYSQL_BACKUP_DIR || "/var/backups/buyweb");
const retentionDays = Number.parseInt(process.env.MYSQL_BACKUP_RETENTION_DAYS || "14", 10);

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const url = new URL(process.env.DATABASE_URL);

  if (!url.protocol.startsWith("mysql")) {
    throw new Error("DATABASE_URL must be a mysql:// URL");
  }

  return {
    database: url.pathname.replace(/^\//, ""),
    host: url.hostname || "127.0.0.1",
    password: decodeURIComponent(url.password || ""),
    port: url.port || "3306",
    user: decodeURIComponent(url.username || ""),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function sha256File(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function runDump(config, outputFile) {
  const args = [
    "--host",
    config.host,
    "--port",
    config.port,
    "--user",
    config.user,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--default-character-set=utf8mb4",
    config.database,
  ];
  const child = spawn("mysqldump", args, {
    env: {
      ...process.env,
      MYSQL_PWD: config.password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderr = [];

  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

  const closed = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`mysqldump exited with ${code}: ${stderr.join("").trim()}`));
      }
    });
  });

  await pipeline(child.stdout, createWriteStream(outputFile));
  await closed;
}

async function writeRestoreGuide(config, backupFile, checksum) {
  const guide = [
    "# MySQL Backup Restore Guide",
    "",
    `Backup file: ${path.basename(backupFile)}`,
    `Database: ${config.database}`,
    `SHA256: ${checksum}`,
    "",
    "Restore to a temporary database first:",
    "",
    "```bash",
    "sha256sum -c " + path.basename(`${backupFile}.sha256`),
    "mysql --host 127.0.0.1 --user buyweb_migrate --password TEMP_RESTORE_DATABASE < " + path.basename(backupFile),
    "```",
    "",
    "For point-in-time recovery, restore this full backup and then replay MySQL binlog up to the target timestamp with `mysqlbinlog --stop-datetime`.",
    "",
    "This project does not batch-delete backup files. Review `cleanup-candidates.txt` and remove only one explicit file path at a time.",
    "",
  ].join("\n");

  await writeFile(`${backupFile}.restore.md`, guide, "utf8");
}

async function writeCleanupCandidates() {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const candidates = [];

  for (const entry of await readdir(backupDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const file = path.join(backupDir, entry.name);
    const info = await stat(file);

    if (info.mtimeMs < cutoff && /^buyweb-\d{4}-/.test(entry.name)) {
      candidates.push(file);
    }
  }

  const content = [
    "# Cleanup candidates",
    "",
    "No files are deleted by this script.",
    "If cleanup is required, remove one explicit file path at a time after review.",
    "",
    ...candidates,
    "",
  ].join("\n");

  await writeFile(path.join(backupDir, "cleanup-candidates.txt"), content, "utf8");
}

await mkdir(backupDir, { recursive: true });

const config = requireDatabaseUrl();
const backupFile = path.join(backupDir, `buyweb-${timestamp()}.sql`);

await runDump(config, backupFile);

const checksum = await sha256File(backupFile);
await writeFile(`${backupFile}.sha256`, `${checksum}  ${path.basename(backupFile)}\n`, "utf8");
await writeRestoreGuide(config, backupFile, checksum);
await writeCleanupCandidates();

console.log(`MySQL backup written: ${backupFile}`);
console.log(`SHA256: ${checksum}`);

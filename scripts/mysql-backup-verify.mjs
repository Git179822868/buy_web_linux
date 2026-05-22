import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const backupDir = path.resolve(process.env.MYSQL_BACKUP_DIR || "/var/backups/buyweb");

function mysqlConfigFromUrl(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  const url = new URL(value);

  return {
    database: url.pathname.replace(/^\//, ""),
    host: url.hostname || "127.0.0.1",
    password: decodeURIComponent(url.password || ""),
    port: url.port || "3306",
    user: decodeURIComponent(url.username || ""),
  };
}

async function sha256File(file) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function latestBackupFile() {
  const files = (await readdir(backupDir))
    .filter((name) => /^buyweb-.*\.sql$/.test(name))
    .sort();
  const latest = files.at(-1);

  if (!latest) {
    throw new Error(`No buyweb-*.sql backup found in ${backupDir}`);
  }

  return path.join(backupDir, latest);
}

async function runMysql(config, inputFile, sql) {
  const args = [
    "--host",
    config.host,
    "--port",
    config.port,
    "--user",
    config.user,
    "--default-character-set=utf8mb4",
    config.database,
  ];

  if (sql) {
    args.unshift("--batch", "--skip-column-names", "--execute", sql);
  }

  const child = spawn("mysql", args, {
    env: {
      ...process.env,
      MYSQL_PWD: config.password,
    },
    stdio: [inputFile ? "pipe" : "ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];

  child.stdout.on("data", (chunk) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

  const closed = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.join(""));
      } else {
        reject(new Error(`mysql exited with ${code}: ${stderr.join("").trim()}`));
      }
    });
  });

  if (inputFile) {
    await pipeline(createReadStream(inputFile), child.stdin);
  }

  return closed;
}

const backupFile = await latestBackupFile();
const expectedText = await readFile(`${backupFile}.sha256`, "utf8");
const expected = expectedText.trim().split(/\s+/)[0];
const actual = await sha256File(backupFile);

if (expected !== actual) {
  throw new Error(`Checksum mismatch for ${backupFile}: expected ${expected}, got ${actual}`);
}

console.log(`Checksum verified: ${backupFile}`);

if (!process.env.MYSQL_VERIFY_DATABASE_URL) {
  console.log("MYSQL_VERIFY_DATABASE_URL is not set; skipped restore drill.");
  process.exit(0);
}

const verifyConfig = mysqlConfigFromUrl(process.env.MYSQL_VERIFY_DATABASE_URL, "MYSQL_VERIFY_DATABASE_URL");

await runMysql(verifyConfig, backupFile);

const counts = await runMysql(
  verifyConfig,
  null,
  [
    "SELECT 'users', COUNT(*) FROM users",
    "UNION ALL SELECT 'orders', COUNT(*) FROM orders",
    "UNION ALL SELECT 'payment_records', COUNT(*) FROM payment_records",
    "UNION ALL SELECT 'security_events', COUNT(*) FROM security_events;",
  ].join(" "),
);

console.log("Restore drill completed against MYSQL_VERIFY_DATABASE_URL:");
console.log(counts.trim());

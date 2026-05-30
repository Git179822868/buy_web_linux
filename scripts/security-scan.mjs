import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const thisFile = path.resolve(fileURLToPath(import.meta.url));
const ignoredDirs = new Set([".deploy", ".git", ".next", "node_modules"]);
const scannedExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const forbiddenPatterns = [
  {
    name: "Prisma unsafe raw SQL",
    pattern: /\b(?:queryRawUnsafe|executeRawUnsafe)\b/,
  },
  {
    name: "Unreviewed Prisma raw SQL",
    pattern: /\.\$(?:queryRaw|executeRaw)\b/,
  },
];

function isAllowed(lines, index) {
  const start = Math.max(0, index - 2);
  const nearby = lines.slice(start, index + 1).join("\n");
  return nearby.includes("security-scan: allow-raw-sql");
}

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(path.join(dir, entry.name), files);
      }

      continue;
    }

    const file = path.join(dir, entry.name);

    if (path.resolve(file) !== thisFile && scannedExtensions.has(path.extname(entry.name))) {
      files.push(file);
    }
  }

  return files;
}

const findings = [];

for (const file of await walk(root)) {
  if (!(await stat(file)).isFile()) {
    continue;
  }

  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(line) && !isAllowed(lines, index)) {
        findings.push({
          file: path.relative(root, file),
          line: index + 1,
          rule: rule.name,
          text: line.trim(),
        });
      }
    }
  });
}

if (findings.length) {
  console.error("Security scan failed:");

  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`);
  }

  console.error("Add a local 'security-scan: allow-raw-sql' comment only after reviewing parameterization.");
  process.exit(1);
}

console.log("Security scan passed: no unsafe or unreviewed raw SQL usage found.");

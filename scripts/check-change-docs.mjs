import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const changesDir = join(root, ".changes");
const requiredHeadings = ["Summary", "Why", "Behavior", "Regression coverage", "Verification", "Documentation"];
const currentRecordVersion = "Change record version: 2";

function markdownFiles(directory) {
  return readdirSync(directory)
    .map((name) => join(directory, name))
    .filter((path) => statSync(path).isFile() && path.endsWith(".md"))
    .filter((path) => !path.endsWith("README.md") && !path.endsWith("template.md"));
}

function validateRecord(path) {
  const content = readFileSync(path, "utf8");
  const missing = requiredHeadings.filter((heading) => !content.includes(`## ${heading}`));
  if (missing.length > 0) {
    throw new Error(`${relative(root, path)} is missing sections: ${missing.join(", ")}`);
  }
  if (content.includes(currentRecordVersion) && !content.includes("## Exploratory review")) {
    throw new Error(`${relative(root, path)} is missing section: Exploratory review`);
  }
}

const records = markdownFiles(changesDir);
for (const record of records) validateRecord(record);

const baseFlag = process.argv.indexOf("--base");
if (baseFlag !== -1) {
  const base = process.argv[baseFlag + 1];
  if (!base) throw new Error("--base requires a git revision");

  const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: root,
    encoding: "utf8",
  }).trim().split("\n").filter(Boolean);

  const codeBearing = changed.some((path) =>
    /^(apps|packages|tests|scripts)\//.test(path) ||
    path === "package.json" ||
    path === "package-lock.json" ||
    path === "playwright.config.ts" ||
    path === "vitest.config.ts"
  );
  const changedRecord = changed.some((path) => /^\.changes\/[^/]+\.md$/.test(path) && !path.endsWith("template.md") && !path.endsWith("README.md"));

  if (codeBearing && !changedRecord) {
    throw new Error("Code-bearing pull requests must include a change record under .changes/");
  }
  for (const path of changed.filter((item) => /^\.changes\/[^/]+\.md$/.test(item) && !item.endsWith("template.md") && !item.endsWith("README.md"))) {
    const content = readFileSync(join(root, path), "utf8");
    if (!content.includes(currentRecordVersion) || !content.includes("## Exploratory review")) {
      throw new Error(`${path} must use change record version 2 and include Exploratory review`);
    }
  }
}

console.log(`Change documentation valid (${records.length} record${records.length === 1 ? "" : "s"}).`);

#!/usr/bin/env node
// Measures how much of each pull request lands on each product area, by lines
// changed, using the same path rules as build.mjs. Run from the repo root:
//   node docs/experiments/product-map/pipeline/build-work.mjs <rawDir>
// <rawDir> is the output of docs/experiments/work-on-the-map/pipeline/fetch.sh
// (per-file additions and deletions, which github-snapshot.json does not keep).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const dataDir = path.join(
  root,
  "apps/dashboard/src/components/product-map/data"
);
const outPath = path.join(dataDir, "diffkit-work.json");
const rawDir = process.argv[2];
if (!rawDir) {
  console.error("usage: build-work.mjs <rawDir>");
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const pathConfig = readJson(path.join(here, "area-paths.json"));
const map = readJson(path.join(dataDir, "diffkit.json"));
const rawPulls = readJson(path.join(rawDir, "prs.json"));

const ignore = pathConfig.ignore.map((source) => new RegExp(source));
const rules = pathConfig.rules.map(([area, source]) => [
  area,
  new RegExp(source),
]);

function areaOf(file) {
  if (ignore.some((pattern) => pattern.test(file))) {
    return null;
  }
  return rules.find(([, pattern]) => pattern.test(file))?.[0] ?? null;
}

const FIX_TITLE = /\b(hot)?fix(es|ed)?\b|^revert|^harden|^stabilize|^handle /i;
const FEATURE_PREFIX = /^feat\b(?!.*\bfix)/i;
const isFix = (title) => !FEATURE_PREFIX.test(title) && FIX_TITLE.test(title);

function filesOf(pull) {
  const paged = path.join(rawDir, `files-${pull.number}.json`);
  return existsSync(paged) ? readJson(paged) : pull.files;
}

function partsOf(files) {
  const lines = new Map();
  for (const file of files) {
    const area = areaOf(file.path);
    if (area) {
      lines.set(area, (lines.get(area) ?? 0) + file.additions + file.deletions);
    }
  }
  const total = [...lines.values()].reduce((sum, value) => sum + value, 0);
  return [...lines]
    .filter(([, value]) => value > 0)
    .map(([area, value]) => ({
      area,
      lines: value,
      share: Number((value / total).toFixed(4)),
    }))
    .sort((a, b) => b.lines - a.lines);
}

const problems = [];
const pulls = {};
for (const pull of rawPulls) {
  if (pull.state === "CLOSED") {
    continue;
  }
  const known = map.pulls[pull.number];
  if (!known) {
    problems.push(`#${pull.number} is not in diffkit.json`);
    continue;
  }
  const parts = partsOf(filesOf(pull));
  if (parts.length === 0) {
    continue;
  }
  for (const area of known.areas) {
    if (!parts.some((part) => part.area === area)) {
      problems.push(`#${pull.number}: build.mjs lists ${area}, no lines there`);
    }
  }
  pulls[pull.number] = { fix: isFix(pull.title), parts };
}

writeFileSync(
  outPath,
  JSON.stringify({ repo: `${map.repo.owner}/${map.repo.name}`, pulls })
);
execFileSync("npx", ["biome", "format", "--write", outPath], { cwd: root });

for (const problem of problems) {
  console.warn(problem);
}
console.log(
  `wrote ${path.relative(root, outPath)}: ${Object.keys(pulls).length} pull requests`
);

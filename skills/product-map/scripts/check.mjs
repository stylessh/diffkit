#!/usr/bin/env node
// Checks a repository's product map the way DiffKit does, plus the things only
// a checkout can tell: that every path the map mentions exists and that every
// area receives files. Needs Node 18 or later and no install.
//
//   node check.mjs [repository root]     (defaults to the current directory)
//
// Exits 1 when the map would be rejected or points at something missing.
// Files that no area covers are listed as a warning and do not fail the run.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  MAP_AREAS_PATH,
  MAP_FILE_PATH,
  parseMapFolder,
} from "./lib/map-file.mjs";
import { createAreaMatcher } from "./lib/path-rules.mjs";

const root = path.resolve(process.argv[2] ?? ".");
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);
const UNMAPPED_SHOWN = 20;

function fail(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}

function walk(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name)
        ? []
        : walk(path.join(directory, entry.name), relative);
    return entry.isFile() ? [relative] : [];
  });
}

/** Tracked files when this is a git checkout, otherwise every file on disk. */
function repositoryFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return walk(root);
  }
}

const indexPath = path.join(root, MAP_FILE_PATH);
const areasPath = path.join(root, MAP_AREAS_PATH);
if (!existsSync(indexPath))
  fail([`No ${MAP_FILE_PATH} in ${root}. There is no product map to check.`]);
const areaFiles =
  existsSync(areasPath) && statSync(areasPath).isDirectory()
    ? readdirSync(areasPath).sort()
    : [];

const parsed = parseMapFolder({
  index: readFileSync(indexPath, "utf8"),
  areas: areaFiles.map((name) => ({
    name,
    text: readFileSync(path.join(areasPath, name), "utf8"),
  })),
});
if (!parsed.ok)
  fail([
    "DiffKit would reject this map:",
    ...parsed.problems.map((problem) => `  - ${problem}`),
  ]);

const { map } = parsed;
const problems = [];

for (const area of map.areas) {
  const mentioned = [
    ...area.flow.flatMap((step) => (step.path ? [step.path] : [])),
    ...area.entryPoints.map((entry) => entry.path),
    ...area.features.flatMap((feature) =>
      feature.entry.map((entry) => entry.path)
    ),
    ...(area.screen ? [area.screen.light, area.screen.dark] : []),
  ];
  for (const file of new Set(mentioned))
    if (!existsSync(path.join(root, file)))
      problems.push(`areas/${area.id}.json mentions ${file}, which does not exist.`);
}

const match = createAreaMatcher(map.rules, map.ignore);
const filesPerArea = new Map(map.areas.map((area) => [area.id, 0]));
const unmapped = [];
for (const file of repositoryFiles()) {
  const found = match(file);
  if (found.kind === "area")
    filesPerArea.set(found.area, filesPerArea.get(found.area) + 1);
  else if (found.kind === "unmapped") unmapped.push(file);
}
for (const [id, count] of filesPerArea)
  if (count === 0)
    problems.push(`areas/${id}.json: no file matches its "paths".`);

if (problems.length > 0)
  fail(["The map is valid but out of step with the code:", ...problems.map((problem) => `  - ${problem}`)]);

console.log(
  `Product map OK: ${map.areas.length} areas, ${[...filesPerArea.values()].reduce((sum, count) => sum + count, 0)} files placed.`
);
if (unmapped.length > 0) {
  console.log(
    `\n${unmapped.length} file(s) belong to no area. Add a pattern to the area each belongs to, or to "ignore" in map.json if it is generated or not part of the product:`
  );
  for (const file of unmapped.slice(0, UNMAPPED_SHOWN)) console.log(`  ${file}`);
  if (unmapped.length > UNMAPPED_SHOWN)
    console.log(`  … and ${unmapped.length - UNMAPPED_SHOWN} more`);
}

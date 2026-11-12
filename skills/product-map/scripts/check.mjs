#!/usr/bin/env node
// Checks a repository's product map the way DiffKit does, plus the things only
// a checkout can tell: that every path the map mentions exists and that every
// area receives files. Needs Node 18 or later and no install.
//
//   node check.mjs [repository root] [--fix] [--fail-on-unmapped]
//
// --fix               put every map file's keys in the format's order, and move
//                     code links whose line drifted back onto their symbol
// --fail-on-unmapped  also fail when a file belongs to no area
//
// Exits 1 when the map would be rejected or points at something missing.
// Without --fail-on-unmapped, files no area covers are only listed.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { MAP_AREAS_PATH, MAP_FILE_PATH, parseMapFolder } from "./lib/map-file.mjs";
import { createAreaMatcher } from "./lib/path-rules.mjs";
import {
  anchorLines,
  byDirectory,
  parseArgs,
  readMapFolder,
  repositoryFiles,
  rewriteCanonical,
} from "./shared.mjs";

const { positional, options } = parseArgs(process.argv.slice(2));
const root = path.resolve(positional[0] ?? ".");
const inActions = process.env.GITHUB_ACTIONS === "true";
const UNMAPPED_SHOWN = 20;

/** `areas/x.json: …` and `map.json: …` problems name the file they are about. */
function fileOf(problem) {
  const match = /^(map\.json|areas\/[^:\s]+\.json)/.exec(problem);
  return match ? `.diffkit/${match[1]}` : MAP_FILE_PATH;
}

function fail(heading, problems) {
  console.error([heading, ...problems.map((problem) => `  - ${problem}`)].join("\n"));
  if (inActions)
    for (const problem of problems)
      console.log(`::error file=${fileOf(problem)}::${problem}`);
  process.exit(1);
}

if (options.fix && existsSync(path.join(root, MAP_FILE_PATH))) {
  const rewritten = [];
  if (rewriteCanonical(path.join(root, MAP_FILE_PATH), "index"))
    rewritten.push(MAP_FILE_PATH);
  const areasPath = path.join(root, MAP_AREAS_PATH);
  if (existsSync(areasPath))
    for (const name of readdirSync(areasPath).sort())
      if (name.endsWith(".json") && rewriteCanonical(path.join(areasPath, name), "area"))
        rewritten.push(`${MAP_AREAS_PATH}/${name}`);
  if (rewritten.length > 0)
    console.log(`Rewrote in canonical order: ${rewritten.join(", ")}`);
}

const source = readMapFolder(root);
if (!source)
  fail(`No ${MAP_FILE_PATH} in ${root}.`, ["There is no product map to check."]);

const parsed = parseMapFolder(source);
if (!parsed.ok) fail("DiffKit would reject this map:", parsed.problems);

const { map } = parsed;
const problems = [];

for (const area of map.areas) {
  const mentioned = [
    ...area.flow.flatMap((step) => (step.path ? [step.path] : [])),
    ...area.entryPoints.map((entry) => entry.path),
    ...area.features.flatMap((feature) => feature.entry.map((entry) => entry.path)),
    ...(area.screen ? [area.screen.light, area.screen.dark] : []),
  ];
  for (const file of new Set(mentioned))
    if (!existsSync(path.join(root, file)))
      problems.push(`areas/${area.id}.json mentions ${file}, which does not exist.`);
}

const match = createAreaMatcher(map.rules, map.ignore);
const filesPerArea = new Map(map.areas.map((area) => [area.id, 0]));
const unmapped = [];
for (const file of repositoryFiles(root)) {
  const found = match(file);
  if (found.kind === "area")
    filesPerArea.set(found.area, filesPerArea.get(found.area) + 1);
  else if (found.kind === "unmapped") unmapped.push(file);
}
for (const [id, count] of filesPerArea)
  if (count === 0) problems.push(`areas/${id}.json: no file matches its "paths".`);

if (problems.length > 0)
  fail("The map is valid but out of step with the code:", problems);

const placed = [...filesPerArea.values()].reduce((sum, count) => sum + count, 0);
console.log(`Product map OK: ${map.areas.length} areas, ${placed} files placed.`);

const anchors = anchorLines(root, { fix: Boolean(options.fix) });
if (anchors.moved.length > 0) {
  console.log(
    options.fix
      ? `\nMoved ${anchors.moved.length} code link(s) back onto their symbol:`
      : `\n${anchors.moved.length} code link(s) point at a line that no longer shows their symbol. Run check.mjs --fix to move them:`
  );
  for (const line of anchors.moved) console.log(`  ${line}`);
  if (inActions && !options.fix)
    console.log(
      `::warning::${anchors.moved.length} product map code link(s) point at the wrong line. Run the product-map check with --fix.`
    );
}
if (anchors.lost.length > 0) {
  console.log(`\n${anchors.lost.length} code link(s) name a symbol their file no longer has. Update or remove them:`);
  for (const line of anchors.lost) console.log(`  ${line}`);
}

if (unmapped.length > 0) {
  console.log(
    `\n${unmapped.length} file(s) belong to no area. Add a pattern to the area each belongs to, or to "ignore" in map.json if it is generated or not part of the product:`
  );
  if (unmapped.length <= UNMAPPED_SHOWN)
    for (const file of unmapped) console.log(`  ${file}`);
  else
    for (const [directory, count] of byDirectory(unmapped).slice(0, UNMAPPED_SHOWN))
      console.log(`  ${String(count).padStart(5)}  ${directory}/`);
  if (inActions)
    console.log(
      `::${options["fail-on-unmapped"] ? "error" : "warning"}::${unmapped.length} file(s) belong to no product map area. Run the product-map skill's "Keep it current" steps.`
    );
  if (options["fail-on-unmapped"]) process.exit(1);
}

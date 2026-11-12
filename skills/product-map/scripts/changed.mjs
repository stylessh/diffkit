#!/usr/bin/env node
// Says exactly what a change asks of the product map, so an update reads only
// the areas that moved instead of the whole repository.
//
//   node changed.mjs [repository root] [--base <ref>] [--since <date>]
//
// --base   compare with where the branch left this ref (default: the default
//          branch), including work that is not committed yet
// --since  everything committed since a date, e.g. "8 days ago"; for a
//          scheduled refresh
//
// It lists, per area, the changed files and which of them the map mentions by
// path, then the new files no area covers. Nothing listed means nothing to do.

import { existsSync } from "node:fs";
import path from "node:path";
import { createAreaMatcher } from "./lib/path-rules.mjs";
import { byDirectory, git, loadMap, parseArgs } from "./shared.mjs";

const { positional, options } = parseArgs(process.argv.slice(2));
const root = path.resolve(positional[0] ?? ".");
const FILES_SHOWN = 12;

function defaultBase() {
  for (const ref of ["origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    try {
      return git(root, ["merge-base", "HEAD", ref]).trim();
    } catch {
      // Try the next name.
    }
  }
  return "HEAD~1";
}

/** Path to status letter: A added, M modified, D deleted, R renamed away. */
function changes() {
  const result = new Map();
  const record = (lines) => {
    for (const line of lines.split("\n")) {
      const [status, first, second] = line.split("\t");
      if (!(status && first)) continue;
      if (status.startsWith("R") && second) {
        result.set(first, "R");
        result.set(second, "A");
      } else result.set(first, status[0]);
    }
  };
  if (typeof options.since === "string") {
    record(git(root, ["log", `--since=${options.since}`, "--no-merges", "--name-status", "-M", "--format="]));
    return { changed: result, label: `since ${options.since}` };
  }
  const base = typeof options.base === "string" ? git(root, ["merge-base", "HEAD", options.base]).trim() : defaultBase();
  record(git(root, ["diff", "--name-status", "-M", base]));
  for (const file of git(root, ["ls-files", "--others", "--exclude-standard"]).split("\n"))
    if (file) result.set(file, "A");
  return { changed: result, label: `since ${base.slice(0, 9)}` };
}

const map = loadMap(root);
const match = createAreaMatcher(map.rules, map.ignore);
const { changed, label } = changes();

const perArea = new Map();
const outside = [];
for (const [file, status] of changed) {
  if (file.startsWith(".diffkit/")) continue;
  const found = match(file);
  if (found.kind === "area") {
    const list = perArea.get(found.area) ?? [];
    list.push([status, file]);
    perArea.set(found.area, list);
  } else if (found.kind === "unmapped" && status !== "D" && status !== "R") outside.push(file);
}

/** Every path each area's file mentions, with where it mentions it. */
function mentions(area) {
  return [
    ...area.flow.flatMap((step) => (step.path ? [[step.path, `flow "${step.label}"`]] : [])),
    ...area.features.flatMap((feature) =>
      feature.path ? [[feature.path, `feature "${feature.name}"`]] : []
    ),
  ];
}

console.log(`# What changed ${label}`);

const stale = [];
for (const area of map.areas)
  for (const [file, where] of mentions(area))
    if (!existsSync(path.join(root, file)))
      stale.push(`areas/${area.id}.json, ${where}: ${file} no longer exists`);
if (stale.length > 0) {
  console.log("\n## Fix first: the map points at files that are gone");
  for (const line of [...new Set(stale)]) console.log(`  - ${line}`);
}

if (perArea.size > 0) {
  console.log("\n## Areas whose code changed");
  console.log("Re-read each one's file in .diffkit/areas/ against these changes. Update it only where the behaviour or a path is now wrong.");
  for (const [id, list] of [...perArea].sort((a, b) => b[1].length - a[1].length)) {
    const area = map.areas.find((candidate) => candidate.id === id);
    console.log(`\n### ${id} (${list.length} file${list.length === 1 ? "" : "s"})`);
    for (const [status, file] of list.slice(0, FILES_SHOWN)) console.log(`  ${status} ${file}`);
    if (list.length > FILES_SHOWN) console.log(`  … and ${list.length - FILES_SHOWN} more`);
    const touched = new Set(list.map(([, file]) => file));
    const mentioned = [...new Set(mentions(area).filter(([file]) => touched.has(file)).map(([file, where]) => `${file} (${where})`))];
    if (mentioned.length > 0) {
      console.log("  The map mentions these changed files; check what it says about them:");
      for (const line of mentioned) console.log(`    - ${line}`);
    }
  }
}

if (outside.length > 0) {
  console.log(`\n## New files no area covers (${outside.length})`);
  console.log('Add a pattern to the area each belongs to, or to "ignore" in map.json.');
  if (outside.length <= 25) for (const file of outside) console.log(`  ${file}`);
  else for (const [directory, count] of byDirectory(outside, 4).slice(0, 25)) console.log(`${String(count).padStart(6)}  ${directory}/`);
}

if (stale.length + perArea.size + outside.length === 0)
  console.log("\nNothing in this change touches the map. No update needed.");

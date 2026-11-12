#!/usr/bin/env node
// Prints a bounded inventory of a repository, so areas can be proposed without
// walking the tree by hand. The output stays about the same length whether the
// repository has a thousand files or half a million.
//
//   node survey.mjs [repository root] [--depth 3]
//
// With a map already in place it also shows how the files are spread over the
// areas and where the unmapped ones are.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAP_FILE_PATH } from "./lib/map-file.mjs";
import { createAreaMatcher } from "./lib/path-rules.mjs";
import { byDirectory, git, loadMap, parseArgs, repositoryFiles } from "./shared.mjs";

const { positional, options } = parseArgs(process.argv.slice(2));
const root = path.resolve(positional[0] ?? ".");
const depth = Number(options.depth) > 0 ? Number(options.depth) : 3;

const DIRECTORIES_SHOWN = 60;
const HOT_FILES_SHOWN = 25;
const ENTRY_HINTS = [
  [/(^|\/)(routes|pages|app|views|screens)\//, "screens and routes"],
  [/(^|\/)(api|handlers|controllers|endpoints|resolvers)\//, "server endpoints"],
  [/(^|\/)(cmd|bin|cli)\//, "commands"],
  [/(^|\/)(jobs|workers|crons?|tasks|queues)\//, "background work"],
  [/(^|\/)(migrations|schema|db|models|prisma|drizzle)\//, "data"],
  [/(^|\/)(components|ui|widgets)\//, "interface components"],
  [/(^|\/)(docs?|documentation)\//, "documentation"],
  [/(^|\/)(\.github|ci|scripts|tools|infra|deploy|terraform|k8s)\//, "tooling and operations"],
];
const MANIFESTS = /(^|\/)(package\.json|Cargo\.toml|go\.mod|pyproject\.toml|setup\.py|Gemfile|pom\.xml|build\.gradle(\.kts)?|composer\.json|mix\.exs|Package\.swift)$/;
const NOT_SOURCE = /(^|\/)(node_modules|vendor|dist|build|\.next|target|coverage)\/|\.(lock|min\.js|map|png|jpe?g|gif|svg|ico|woff2?|ttf|pdf)$|(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;

const files = repositoryFiles(root);
const section = (title) => console.log(`\n## ${title}`);

console.log(`# Survey of ${path.basename(root)}`);
console.log(`${files.length} tracked files.`);

section("File types");
const extensions = new Map();
for (const file of files) {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "(none)";
  extensions.set(extension, (extensions.get(extension) ?? 0) + 1);
}
console.log(
  [...extensions]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([extension, count]) => `${extension} ${count}`)
    .join(", ")
);

section(`Folders, ${depth} levels deep, by file count`);
const folders = byDirectory(files, depth);
for (const [directory, count] of folders.slice(0, DIRECTORIES_SHOWN))
  console.log(`${String(count).padStart(6)}  ${directory}/`);
if (folders.length > DIRECTORIES_SHOWN)
  console.log(`        … and ${folders.length - DIRECTORIES_SHOWN} smaller folders`);

const manifests = files.filter((file) => MANIFESTS.test(file) && !NOT_SOURCE.test(file));
if (manifests.length > 0) {
  section("Packages and modules");
  for (const file of manifests.slice(0, 40)) {
    let label = "";
    if (file.endsWith("package.json")) {
      try {
        label = JSON.parse(readFileSync(path.join(root, file), "utf8")).name ?? "";
      } catch {
        label = "";
      }
    }
    console.log(`  ${file}${label ? `  (${label})` : ""}`);
  }
  if (manifests.length > 40) console.log(`  … and ${manifests.length - 40} more`);
}

section("Where the product probably lives");
for (const [pattern, label] of ENTRY_HINTS) {
  const matches = files.filter((file) => pattern.test(file) && !NOT_SOURCE.test(file));
  if (matches.length === 0) continue;
  const top = byDirectory(matches, 4)
    .slice(0, 5)
    .map(([directory, count]) => `${directory}/ (${count})`);
  console.log(`  ${label}: ${top.join(", ")}`);
}

try {
  const log = git(root, ["log", "--since=6 months ago", "--no-merges", "--name-only", "--format="]);
  const changes = new Map();
  for (const file of log.split("\n"))
    if (file && !NOT_SOURCE.test(file)) changes.set(file, (changes.get(file) ?? 0) + 1);
  const hot = [...changes].sort((a, b) => b[1] - a[1]).slice(0, HOT_FILES_SHOWN);
  if (hot.length > 0) {
    section("Most changed files in the last six months");
    for (const [file, count] of hot) console.log(`${String(count).padStart(6)}  ${file}`);
  }
} catch {
  // Not a git checkout, or no history: the inventory above still stands.
}

if (existsSync(path.join(root, MAP_FILE_PATH))) {
  const map = loadMap(root);
  const match = createAreaMatcher(map.rules, map.ignore);
  const perArea = new Map(map.areas.map((area) => [area.id, 0]));
  const unmapped = [];
  for (const file of files) {
    const found = match(file);
    if (found.kind === "area") perArea.set(found.area, perArea.get(found.area) + 1);
    else if (found.kind === "unmapped") unmapped.push(file);
  }
  section("The map today");
  for (const [id, count] of [...perArea].sort((a, b) => b[1] - a[1]))
    console.log(`${String(count).padStart(6)}  ${id}`);
  if (unmapped.length > 0) {
    section(`Files outside the map (${unmapped.length})`);
    for (const [directory, count] of byDirectory(unmapped, depth).slice(0, 30))
      console.log(`${String(count).padStart(6)}  ${directory}/`);
  }
}

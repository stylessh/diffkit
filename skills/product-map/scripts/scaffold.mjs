#!/usr/bin/env node
// Writes map files in the one shape DiffKit accepts, so the structure is never
// typed by hand. It refuses to write anything the checker would reject.
//
// Start a map:
//   node scaffold.mjs init --pitch "One sentence: what the product is." \
//     [--description "One or two more sentences."]
//
// Add an area and place it in a group (the band and group are created when
// they do not exist yet):
//   node scaffold.mjs area <area-id> --name "Sign-in" \
//     --tagline "A few words" --summary "What it does for a user." \
//     --paths "src/auth/**,src/routes/login.tsx" \
//     --band screens --band-name "What people use" \
//     --group account --group-name "Your account" [--icon lock]
//
// Add --root <repository root> to either when not run from it. Fill in the
// rest of an area (flow, features, dependsOn, outside) by editing its file.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  MAP_AREAS_PATH,
  MAP_FILE_PATH,
  MAP_FILE_VERSION,
  parseMapFolder,
} from "./lib/map-file.mjs";
import { canonicalText, parseArgs, readMapFolder } from "./shared.mjs";

const { positional, options } = parseArgs(process.argv.slice(2));
const [command, areaId] = positional;
const root = path.resolve(typeof options.root === "string" ? options.root : ".");
const indexPath = path.join(root, MAP_FILE_PATH);

function stop(message) {
  console.error(message);
  process.exit(1);
}

function need(name) {
  const value = options[name];
  if (typeof value !== "string" || value.trim() === "") stop(`Missing --${name}.`);
  return value;
}

if (command === "init") {
  if (existsSync(indexPath)) stop(`${MAP_FILE_PATH} already exists.`);
  const index = {
    version: MAP_FILE_VERSION,
    pitch: need("pitch"),
    ...(typeof options.description === "string" ? { description: options.description } : {}),
    bands: [],
    ignore: [],
    outside: [],
    tour: [],
  };
  mkdirSync(path.join(root, MAP_AREAS_PATH), { recursive: true });
  writeFileSync(indexPath, canonicalText(index, "index"));
  console.log(`Wrote ${MAP_FILE_PATH}. Add areas with: scaffold.mjs area <id> …`);
} else if (command === "area") {
  if (!areaId) stop("Usage: scaffold.mjs area <area-id> --name … (see the top of this file).");
  const source = readMapFolder(root);
  if (!source) stop(`No ${MAP_FILE_PATH} yet. Run: scaffold.mjs init --pitch "…"`);
  const areaFile = `${areaId}.json`;
  if (source.areas.some((file) => file.name === areaFile))
    stop(`${MAP_AREAS_PATH}/${areaFile} already exists. Edit it instead.`);

  const area = {
    name: need("name"),
    ...(typeof options.icon === "string" ? { icon: options.icon } : {}),
    tagline: need("tagline"),
    summary: need("summary"),
    paths: need("paths").split(",").map((pattern) => pattern.trim()).filter(Boolean),
    flow: [],
    features: [],
    dependsOn: [],
    outside: [],
  };

  const index = JSON.parse(source.index);
  const bandId = need("band");
  const groupId = need("group");
  index.bands ??= [];
  let band = index.bands.find((candidate) => candidate.id === bandId);
  if (!band) {
    band = { id: bandId, name: need("band-name"), groups: [] };
    index.bands.push(band);
  }
  let group = band.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    group = { id: groupId, name: need("group-name"), areas: [] };
    band.groups.push(group);
  }
  group.areas.push(areaId);

  const indexText = canonicalText(index, "index", source.index);
  const areaText = canonicalText(area, "area", source.areas[0]?.text ?? source.index);
  const parsed = parseMapFolder({
    index: indexText,
    areas: [...source.areas, { name: areaFile, text: areaText }],
  });
  // Areas added earlier may still be unplaced or incomplete; only this area's
  // own problems stop it from being written.
  const mine = parsed.ok
    ? []
    : parsed.problems.filter(
        (problem) => problem.includes(`areas/${areaFile}`) || problem.includes(`"${areaId}"`)
      );
  if (mine.length > 0)
    stop(["Nothing written. This area would be rejected:", ...mine.map((problem) => `  - ${problem}`)].join("\n"));

  mkdirSync(path.join(root, MAP_AREAS_PATH), { recursive: true });
  writeFileSync(path.join(root, MAP_AREAS_PATH, areaFile), areaText);
  writeFileSync(indexPath, indexText);
  console.log(`Wrote ${MAP_AREAS_PATH}/${areaFile} and placed "${areaId}" in ${bandId} / ${groupId}.`);
} else {
  stop(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 19).map((line) => line.replace(/^\/\/ ?/, "")).join("\n"));
}

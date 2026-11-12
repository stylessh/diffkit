// What the product-map scripts share: reading the folder, listing the
// repository's files, and writing a map file in its one canonical shape.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  MAP_AREAS_PATH,
  MAP_FIELDS,
  MAP_FILE_PATH,
  parseMapFolder,
} from "./lib/map-file.mjs";

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

/** `--name value` and `--flag` pairs after the positional arguments. */
export function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) options[arg.slice(2)] = true;
    else {
      options[arg.slice(2)] = next;
      index += 1;
    }
  }
  return { positional, options };
}

export function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
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
export function repositoryFiles(root) {
  try {
    return git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  } catch {
    return walk(root);
  }
}

/** The folder's files as text, or null when there is no map.json. */
export function readMapFolder(root) {
  const indexPath = path.join(root, MAP_FILE_PATH);
  if (!existsSync(indexPath)) return null;
  const areasPath = path.join(root, MAP_AREAS_PATH);
  const names =
    existsSync(areasPath) && statSync(areasPath).isDirectory()
      ? readdirSync(areasPath).sort()
      : [];
  return {
    index: readFileSync(indexPath, "utf8"),
    areas: names.map((name) => ({
      name,
      text: readFileSync(path.join(areasPath, name), "utf8"),
    })),
  };
}

/** The parsed map, or exits with what is wrong. */
export function loadMap(root) {
  const source = readMapFolder(root);
  if (!source) {
    console.error(`No ${MAP_FILE_PATH} in ${root}. There is no product map yet.`);
    process.exit(1);
  }
  const parsed = parseMapFolder(source);
  if (!parsed.ok) {
    console.error(
      ["DiffKit would reject this map. Run check.mjs for details:", ...parsed.problems.map((problem) => `  - ${problem}`)].join("\n")
    );
    process.exit(1);
  }
  return parsed.map;
}

const NESTED = {
  index: { bands: "band", outside: "outsideSystem", tour: "tourStop" },
  band: { groups: "group" },
  area: {
    screen: "screen",
    flow: "flowStep",
    features: "feature",
    entryPoints: "reference",
    issues: "issueHint",
  },
  feature: { entry: "reference" },
};

/**
 * The same object with its keys in the format's order, all the way down.
 * Keys the format does not know go last, so nothing is lost and the checker
 * still reports them.
 */
export function canonical(value, kind) {
  if (Array.isArray(value)) return value.map((item) => canonical(item, kind));
  if (typeof value !== "object" || value === null) return value;
  const fields = MAP_FIELDS[kind] ?? [];
  const keys = [
    ...fields.filter((key) => key in value),
    ...Object.keys(value).filter((key) => !fields.includes(key)),
  ];
  return Object.fromEntries(
    keys.map((key) => {
      const child = NESTED[kind]?.[key];
      return [key, child ? canonical(value[key], child) : value[key]];
    })
  );
}

function indentOf(text) {
  return /^([ \t]+)"/m.exec(text)?.[1] ?? "  ";
}

/** A map file's canonical text, keeping the indentation the file already has. */
export function canonicalText(value, kind, previousText = "") {
  return `${JSON.stringify(canonical(value, kind), null, indentOf(previousText))}\n`;
}

/** Puts one map file's keys in the format's order. Returns whether it changed. */
export function rewriteCanonical(file, kind) {
  const text = readFileSync(file, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return false;
  }
  // Only key order counts. A file that is already in order is left exactly as
  // it is, so this never fights the repository's own JSON formatter.
  if (JSON.stringify(canonical(value, kind)) === JSON.stringify(value))
    return false;
  writeFileSync(file, canonicalText(value, kind, text));
  return true;
}

/** Groups paths by their first `depth` folders, most files first. */
export function byDirectory(files, depth = 3) {
  const counts = new Map();
  for (const file of files) {
    const parts = file.split("/");
    const directory =
      parts.length === 1 ? "(root)" : parts.slice(0, Math.min(depth, parts.length - 1)).join("/");
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const DEFINITION =
  /\b(function|const|let|var|class|type|interface|enum|def|fn|func|struct|trait|impl|export|public|private|protected)\b/;

function symbolWord(symbol) {
  return /[A-Za-z_$][\w$]*/.exec(symbol)?.[0] ?? null;
}

/** Where `word` is most likely defined now, or null when the file no longer has it. */
function anchorFor(lines, word, previousLine) {
  const whole = new RegExp(`(^|[^\\w$])${word.replace(/\$/g, "\\$")}([^\\w$]|$)`);
  const found = lines.flatMap((text, index) => (whole.test(text) ? [index + 1] : []));
  if (found.length === 0) return null;
  const defined = found.filter((line) => DEFINITION.test(lines[line - 1]));
  const pool = defined.length > 0 ? defined : found;
  return pool.reduce((best, line) =>
    Math.abs(line - previousLine) < Math.abs(best - previousLine) ? line : best
  );
}

/**
 * Code links whose line no longer shows the symbol they name: the file was
 * edited above it. With `fix`, each is moved to where the symbol is now.
 * Returns what moved and what could not be found.
 */
export function anchorLines(root, { fix }) {
  const areasPath = path.join(root, MAP_AREAS_PATH);
  const sources = new Map();
  const linesOf = (file) => {
    if (!sources.has(file)) {
      const full = path.join(root, file);
      sources.set(file, existsSync(full) ? readFileSync(full, "utf8").split("\n") : null);
    }
    return sources.get(file);
  };
  const moved = [];
  const lost = [];
  if (!existsSync(areasPath)) return { moved, lost };
  for (const name of readdirSync(areasPath).sort()) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(areasPath, name);
    const text = readFileSync(file, "utf8");
    let area;
    try {
      area = JSON.parse(text);
    } catch {
      continue;
    }
    const references = [
      ...(Array.isArray(area.entryPoints) ? area.entryPoints : []),
      ...(Array.isArray(area.features) ? area.features : []).flatMap((feature) =>
        Array.isArray(feature?.entry) ? feature.entry : []
      ),
    ];
    let changed = false;
    for (const reference of references) {
      if (!(Number.isInteger(reference?.line) && typeof reference.symbol === "string")) continue;
      const word = symbolWord(reference.symbol);
      const lines = typeof reference.path === "string" ? linesOf(reference.path) : null;
      if (!(word && lines)) continue;
      if ((lines[reference.line - 1] ?? "").includes(word)) continue;
      const where = `areas/${name}: ${reference.path}:${reference.line} (${reference.symbol})`;
      const line = anchorFor(lines, word, reference.line);
      if (line === null) lost.push(where);
      else {
        moved.push(`${where} is now line ${line}`);
        if (fix) {
          reference.line = line;
          changed = true;
        }
      }
    }
    if (changed) writeFileSync(file, canonicalText(area, "area", text));
  }
  return { moved, lost };
}

#!/usr/bin/env node
// The product-map skill ships a checker that must agree with DiffKit about
// what a valid map is. Rather than keep two validators, this turns the
// dashboard's own TypeScript modules into the plain JavaScript the skill
// runs. Run from the repo root after changing those modules:
//   node scripts/build-map-skill.mjs
// A dashboard test fails when the committed copies are stale.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = "apps/dashboard/src/lib/product-map";
const outDir = "skills/product-map/scripts/lib";
const modules = ["path-rules", "map-file"];

/** Repo-relative output path to file text, for every generated module. */
export function renderSkillLib() {
  const files = {};
  for (const name of modules) {
    const source = readFileSync(
      path.join(root, sourceDir, `${name}.ts`),
      "utf8"
    );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        newLine: ts.NewLineKind.LineFeed,
      },
    });
    const withExtensions = outputText.replace(
      /from "\.\/([a-z-]+)"/g,
      'from "./$1.mjs"'
    );
    files[`${outDir}/${name}.mjs`] =
      `// Generated from ${sourceDir}/${name}.ts by scripts/build-map-skill.mjs. Do not edit.\n${withExtensions}`;
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [file, text] of Object.entries(renderSkillLib())) {
    writeFileSync(path.join(root, file), text);
    console.log(`wrote ${file}`);
  }
}

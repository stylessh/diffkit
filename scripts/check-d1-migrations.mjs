import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const DASHBOARD_DIR = join(REPO_ROOT, "apps/dashboard");
const MIGRATIONS_DIR = join(DASHBOARD_DIR, "db/migrations");
const MIGRATIONS_PATH = "apps/dashboard/db/migrations/";

const DESTRUCTIVE_MARKER = /migration-destructive:\s*approved/i;
const EDIT_MARKER = /migration-edit:\s*approved/i;

const DESTRUCTIVE_PATTERNS = [
  { label: "DROP", pattern: /\bDROP\s+(TABLE|INDEX|VIEW|TRIGGER)\b/i },
  { label: "ALTER ... DROP COLUMN", pattern: /\bALTER\s+TABLE\b[^;]*\bDROP\s+COLUMN\b/i },
  { label: "ALTER ... RENAME", pattern: /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i },
  { label: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
  { label: "UPDATE without WHERE", pattern: /^\s*UPDATE\b(?![\s\S]*\bWHERE\b)/i },
  { label: "DELETE without WHERE", pattern: /\bDELETE\s+FROM\s+[`"\w.]+\s*(;|$)/i },
];

// Tables still created by 0001–0004 but removed from the Drizzle schema in
// #193. They exist in production until the drop migration (#198) ships; the
// check reports when an entry here is no longer needed.
const KNOWN_LEGACY_TABLES = new Set([
  "github_response_cache",
  "github_revalidation_signal",
  "github_cache_namespace",
  "github_webhook_event",
]);

const OUTCOME_ICON = { pass: "✅", fail: "❌", skip: "⏭️" };

const PLATFORM_TABLE = /^(sqlite_|_cf_|d1_migrations$)/;

const { values: options } = parseArgs({ options: { base: { type: "string" } } });
const prBody = process.env.PR_BODY ?? "";
const scratch = mkdtempSync(join(tmpdir(), "d1-migration-check-"));

const applied = guarded("Apply to fresh local D1", checkMigrationsApplyToFreshD1);
const results = [
  guarded("Changed migrations", () => checkChangedMigrations(options.base)),
  applied,
  guarded("drizzle-kit check", checkDrizzleSnapshots),
  applied.outcome === "pass"
    ? guarded("Drizzle schema matches migrations", checkSchemaDrift)
    : skip("Drizzle schema matches migrations", "migrations did not apply"),
];

writeSummary(results);
process.exit(results.some((result) => result.outcome === "fail") ? 1 : 0);

function guarded(name, check) {
  try {
    return check();
  } catch (error) {
    return fail(name, [error instanceof Error ? error.message : String(error)]);
  }
}

function run(command, args, cwd = DASHBOARD_DIR) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function pass(name, details = []) {
  return { name, outcome: "pass", details };
}

function fail(name, details) {
  return { name, outcome: "fail", details };
}

function skip(name, reason) {
  return { name, outcome: "skip", details: [`Skipped: ${reason}.`] };
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function changedMigrationFiles(base) {
  const diff = run("git", ["diff", "--name-status", `${base}...HEAD`, "--", MIGRATIONS_PATH], REPO_ROOT);
  if (!diff.ok) throw new Error(`git diff against ${base} failed:\n${diff.output}`);
  return diff.output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return { status: status[0], path: paths.at(-1) };
    })
    .filter(({ path }) => path.endsWith(".sql"));
}

function checkChangedMigrations(base) {
  const name = "Changed migrations";
  if (!base) return pass(name, ["No --base given; scanning skipped."]);

  const changes = changedMigrationFiles(base);
  if (changes.length === 0) return pass(name, ["No migration files changed."]);

  const edits = EDIT_MARKER.test(prBody)
    ? []
    : changes
        .filter(({ status }) => status !== "A")
        .map(
          ({ status, path }) =>
            `${path} (${status}): migrations already applied in production are never re-run. Add a new migration instead, or put \`migration-edit: approved\` in the PR body.`,
        );

  const destructive = changes
    .filter(({ status }) => status !== "D")
    .flatMap(({ path }) => destructiveStatements(path));
  const destructiveApproved = DESTRUCTIVE_MARKER.test(prBody);
  const unapproved = destructiveApproved || destructive.length === 0
    ? []
    : [
        ...destructive,
        "Destructive statements need `migration-destructive: approved` in the PR body. Large tables: purge in throttled batches first (docs/runbooks/d1-full.md).",
      ];

  const problems = [...edits, ...unapproved];
  if (problems.length > 0) return fail(name, problems);
  return pass(name, [
    `${changes.length} file(s) changed.`,
    ...(destructiveApproved ? destructive.map((line) => `approved: ${line}`) : []),
  ]);
}

function destructiveStatements(path) {
  const sql = stripSqlComments(readFileSync(join(REPO_ROOT, path), "utf8"));
  return sql.split(/;|--> statement-breakpoint/).flatMap((statement) =>
    DESTRUCTIVE_PATTERNS.filter(({ pattern }) => pattern.test(statement)).map(
      ({ label }) => `${path}: ${label}: ${statement.trim().replace(/\s+/g, " ").slice(0, 120)}`,
    ),
  );
}

function checkMigrationsApplyToFreshD1() {
  const name = "Apply to fresh local D1";
  const persistDir = join(scratch, "state");
  const configPath = join(scratch, "wrangler.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      name: "migration-check",
      compatibility_date: "2025-09-02",
      d1_databases: [
        {
          binding: "DB",
          database_name: "migration-check",
          database_id: "00000000-0000-0000-0000-000000000000",
          migrations_dir: MIGRATIONS_DIR,
        },
      ],
    }),
  );

  const startedAt = Date.now();
  const applied = run("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "-c",
    configPath,
    "--persist-to",
    persistDir,
  ]);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (!applied.ok) return fail(name, [`wrangler failed after ${seconds}s:`, applied.output]);

  const migrationCount = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).length;
  return pass(name, [`${migrationCount} migrations applied in ${seconds}s.`]);
}

function checkDrizzleSnapshots() {
  const name = "drizzle-kit check";
  const checked = run("pnpm", ["exec", "drizzle-kit", "check"]);
  return checked.ok ? pass(name) : fail(name, [checked.output]);
}

function findLocalD1File() {
  const dir = join(scratch, "state", "v3", "d1", "miniflare-D1DatabaseObject");
  const file = readdirSync(dir).find((entry) => entry.endsWith(".sqlite"));
  if (!file) throw new Error(`No local D1 database found in ${dir}`);
  return join(dir, file);
}

function generatedSchemaDatabase() {
  const outDir = join(scratch, "generated");
  const generated = run("pnpm", [
    "exec",
    "drizzle-kit",
    "generate",
    "--dialect",
    "sqlite",
    "--schema",
    "./src/db/schema.ts",
    "--out",
    outDir,
    "--name",
    "schema",
  ]);
  if (!generated.ok) throw new Error(`drizzle-kit generate failed:\n${generated.output}`);

  const db = new DatabaseSync(":memory:");
  const sqlFile = readdirSync(outDir).find((file) => file.endsWith(".sql"));
  for (const statement of readFileSync(join(outDir, sqlFile), "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
  return db;
}

// SQLite stores TRUE/FALSE defaults as 1/0; drizzle's boolean mode emits the keywords.
function normalizeDefault(value) {
  const boolean = { true: "1", false: "0" }[String(value).toLowerCase()];
  return boolean ?? value;
}

function describeSchema(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map(({ name }) => name)
    .filter((name) => !PLATFORM_TABLE.test(name));

  const describe = (table) => {
    const quoted = `"${table.replaceAll('"', '""')}"`;
    const columns = db
      .prepare(`PRAGMA table_xinfo(${quoted})`)
      .all()
      .map((c) => `${c.name} ${String(c.type).toLowerCase()} notnull=${c.notnull} default=${normalizeDefault(c.dflt_value)} pk=${c.pk}`);
    const indexes = db
      .prepare(`PRAGMA index_list(${quoted})`)
      .all()
      .filter((index) => index.origin === "c")
      .map((index) => {
        const cols = db
          .prepare(`PRAGMA index_xinfo("${index.name}")`)
          .all()
          .filter((c) => c.key === 1)
          .map((c) => `${c.name ?? "<expr>"}${c.desc ? " desc" : ""}`)
          .join(",");
        return `index ${index.name} unique=${index.unique} partial=${index.partial} (${cols})`;
      });
    const foreignKeys = db
      .prepare(`PRAGMA foreign_key_list(${quoted})`)
      .all()
      .map((fk) => `fk ${fk.from} -> ${fk.table}.${fk.to} update=${fk.on_update} delete=${fk.on_delete}`);
    return [...columns, ...indexes, ...foreignKeys].sort();
  };

  return new Map(tables.map((table) => [table, describe(table)]));
}

function checkSchemaDrift() {
  const name = "Drizzle schema matches migrations";
  const fromSchema = describeSchema(generatedSchemaDatabase());
  const fromMigrations = describeSchema(new DatabaseSync(findLocalD1File(), { readOnly: true }));

  const drift = [];
  const notes = [];

  for (const [table, definition] of fromMigrations) {
    if (fromSchema.has(table)) continue;
    if (KNOWN_LEGACY_TABLES.has(table)) notes.push(`legacy table \`${table}\` still created by migrations (dropped by #198).`);
    else drift.push(`\`${table}\` exists after migrations but not in src/db/schema.ts.`);
  }
  for (const legacy of KNOWN_LEGACY_TABLES) {
    if (!fromMigrations.has(legacy)) notes.push(`\`${legacy}\` is gone; remove it from KNOWN_LEGACY_TABLES.`);
  }
  for (const [table, expected] of fromSchema) {
    const actual = fromMigrations.get(table);
    if (!actual) {
      drift.push(`\`${table}\` is in src/db/schema.ts but no migration creates it. Run \`pnpm exec drizzle-kit generate\` or add a migration.`);
      continue;
    }
    const missing = expected.filter((line) => !actual.includes(line));
    const extra = actual.filter((line) => !expected.includes(line));
    for (const line of missing) drift.push(`\`${table}\`: schema has \`${line}\`, migrations do not.`);
    for (const line of extra) drift.push(`\`${table}\`: migrations have \`${line}\`, schema does not.`);
  }

  return drift.length > 0 ? fail(name, [...drift, ...notes]) : pass(name, notes);
}

function writeSummary(checks) {
  const lines = ["## D1 migration check", ""];
  for (const check of checks) {
    lines.push(`### ${OUTCOME_ICON[check.outcome]} ${check.name}`);
    for (const detail of check.details) lines.push(detail.includes("\n") ? `\n\`\`\`\n${detail}\n\`\`\`` : `- ${detail}`);
    lines.push("");
  }
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`, { flag: "a" });
}

#!/usr/bin/env node
// Joins the authored area descriptions with git history and a GitHub snapshot
// into the static file the product map renders. Run from the repo root:
//   node docs/experiments/product-map/pipeline/build.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const outPath = path.join(
  root,
  "apps/dashboard/src/components/product-map/data/diffkit.json"
);

const readJson = (name) => JSON.parse(readFileSync(path.join(here, name), "utf8"));
const git = (...args) =>
  execFileSync("git", args, { cwd: root, maxBuffer: 256 * 1024 * 1024 }).toString();

const authored = readJson("areas.json");
const pathConfig = readJson("area-paths.json");
const snapshot = readJson("github-snapshot.json");
const issueAreas = readJson("issue-areas.json");

const ignore = pathConfig.ignore.map((source) => new RegExp(source));
const rules = pathConfig.rules.map(([area, source]) => [area, new RegExp(source)]);
const areaIds = new Set(authored.areas.map((area) => area.id));

function areaOf(file) {
  if (ignore.some((pattern) => pattern.test(file))) return "ignored";
  for (const [area, pattern] of rules) if (pattern.test(file)) return area;
  return "unmapped";
}

const problems = [];
for (const [area] of rules)
  if (!areaIds.has(area)) problems.push(`rule points at unknown area ${area}`);

// --- Current tree: size of each area ------------------------------------

const SOURCE = /\.(ts|tsx|js|mjs|css)$/;
const TEST = /(\.test\.|\.spec\.|__tests__\/|^apps\/e2e\/tests\/)/;
const tree = new Map();
const lineCounts = new Map();
let unmappedFiles = 0;

for (const file of git("ls-files").split("\n").filter(Boolean)) {
  const area = areaOf(file);
  if (area === "ignored") continue;
  if (area === "unmapped") {
    unmappedFiles += 1;
    continue;
  }
  const entry = tree.get(area) ?? { files: 0, loc: 0, testFiles: 0, largest: null };
  entry.files += 1;
  if (TEST.test(file)) entry.testFiles += 1;
  else if (SOURCE.test(file)) {
    const lines = readFileSync(path.join(root, file), "utf8").split("\n").length;
    lineCounts.set(file, lines);
    entry.loc += lines;
    if (!entry.largest || lines > entry.largest.lines)
      entry.largest = { path: file, lines };
  }
  tree.set(area, entry);
}

// --- History: commits, pull requests, people ----------------------------

const pullsByNumber = new Map(snapshot.pulls.map((pull) => [pull.number, pull]));
const commits = [];
let current = null;
for (const line of git(
  "log",
  "--no-merges",
  "--no-renames",
  "--date=iso-strict",
  "--format=@@%H\t%aI\t%an\t%s",
  "--name-only"
).split("\n")) {
  if (line.startsWith("@@")) {
    const [sha, date, author, subject] = line.slice(2).split("\t");
    const number = Number(/\(#(\d+)\)\s*$/.exec(subject)?.[1] ?? 0) || null;
    current = { sha, date, author, subject, number, files: [] };
    commits.push(current);
  } else if (line && current) current.files.push(line);
}

const loginByAuthorName = new Map(Object.entries(authored.authorLogins ?? {}));
for (const commit of commits) {
  const pull = commit.number ? pullsByNumber.get(commit.number) : null;
  if (pull && !loginByAuthorName.has(commit.author))
    loginByAuthorName.set(commit.author, pull.author);
}
const loginOf = (commit) => {
  const login = loginByAuthorName.get(commit.author);
  if (!login) problems.push(`no GitHub login for git author "${commit.author}"`);
  return login ?? commit.author;
};

function areaShares(files) {
  const counts = new Map();
  let mapped = 0;
  for (const file of files) {
    const area = areaOf(file);
    if (area === "ignored" || area === "unmapped") continue;
    counts.set(area, (counts.get(area) ?? 0) + 1);
    mapped += 1;
  }
  return [...counts]
    .map(([area, count]) => ({ area, share: count / mapped }))
    .sort((a, b) => b.share - a.share);
}

const PRIMARY_SHARE = 0.2;
const primaryAreas = (files) =>
  areaShares(files)
    .filter((entry, index) => index === 0 || entry.share >= PRIMARY_SHARE)
    .map((entry) => entry.area);

const newest = commits[0];
const oldest = commits.at(-1);
const analysedAt = new Date(newest.date);
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const EPOCH_MONDAY = 4 * DAY;
const firstWeek =
  Date.parse(oldest.date) - ((Date.parse(oldest.date) - EPOCH_MONDAY) % WEEK);
const weekCount = Math.floor((analysedAt.getTime() - firstWeek) / WEEK) + 1;
const weekIndex = (date) => Math.floor((Date.parse(date) - firstWeek) / WEEK);
const isRecent = (date) => analysedAt.getTime() - Date.parse(date) <= 30 * DAY;

const history = new Map(
  authored.areas.map((area) => [
    area.id,
    {
      weekly: new Array(weekCount).fill(0),
      commits: 0,
      commitsLast30: 0,
      lastTouched: null,
      people: new Map(),
      churn: new Map(),
      merged: [],
      open: [],
    },
  ])
);

const pulls = {};
const people = new Map();

for (const commit of commits) {
  const login = loginOf(commit);
  const person = people.get(login) ?? { login, commits: 0, firstCommit: commit.date };
  person.commits += 1;
  person.firstCommit = commit.date;
  people.set(login, person);

  const touched = new Set();
  for (const file of commit.files) {
    const area = areaOf(file);
    const entry = history.get(area);
    if (!entry) continue;
    touched.add(area);
    if (existsSync(path.join(root, file)))
      entry.churn.set(file, (entry.churn.get(file) ?? 0) + 1);
  }
  for (const area of touched) {
    const entry = history.get(area);
    entry.commits += 1;
    entry.weekly[weekIndex(commit.date)] += 1;
    if (isRecent(commit.date)) entry.commitsLast30 += 1;
    entry.lastTouched ??= commit.date;
    entry.people.set(login, (entry.people.get(login) ?? 0) + 1);
  }

  const pull = commit.number ? pullsByNumber.get(commit.number) : null;
  if (!pull) continue;
  const areas = primaryAreas(commit.files);
  pulls[pull.number] = {
    number: pull.number,
    title: pull.title,
    state: "merged",
    author: pull.author,
    date: pull.mergedAt ?? commit.date,
    additions: pull.additions,
    deletions: pull.deletions,
    areas,
  };
  for (const area of areas) history.get(area)?.merged.push(pull.number);
}

// Pull requests whose commits carry no "(#123)" suffix (rebase merges, open
// pull requests) get their file list from the snapshot instead of git.
for (const pull of snapshot.pulls) {
  if (pulls[pull.number] || pull.state === "closed" || !pull.files) continue;
  const areas = primaryAreas(pull.files);
  const merged = pull.state === "merged";
  pulls[pull.number] = {
    number: pull.number,
    title: pull.title,
    state: pull.state,
    author: pull.author,
    date: merged ? pull.mergedAt : pull.createdAt,
    additions: pull.additions,
    deletions: pull.deletions,
    areas,
  };
  for (const area of areas)
    history.get(area)?.[merged ? "merged" : "open"].push(pull.number);
  if (!people.has(pull.author))
    people.set(pull.author, { login: pull.author, commits: 0, firstCommit: null });
}

// --- Issues: mapped by judgment in issue-areas.json ----------------------

const issues = {};
const issuesByArea = new Map();
for (const issue of snapshot.issues) {
  const mapping = issueAreas[issue.number];
  if (!mapping) continue;
  for (const area of mapping.areas)
    if (!areaIds.has(area)) problems.push(`issue #${issue.number} maps to unknown area ${area}`);
  issues[issue.number] = {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.author,
    date: issue.createdAt,
    labels: issue.labels,
    areas: mapping.areas,
    ...(mapping.note ? { note: mapping.note } : {}),
  };
  for (const area of mapping.areas) {
    const list = issuesByArea.get(area) ?? { open: [], closed: [] };
    list[issue.state === "open" ? "open" : "closed"].push(issue.number);
    issuesByArea.set(area, list);
  }
  if (!people.has(issue.author))
    people.set(issue.author, { login: issue.author, commits: 0, firstCommit: null });
}

// --- Code references: every path must exist, every line must hold its symbol

function checkReference(reference, where) {
  if (!reference.path) return reference;
  const absolute = path.join(root, reference.path);
  if (!existsSync(absolute)) {
    problems.push(`${where}: missing file ${reference.path}`);
    return reference;
  }
  if (!reference.symbol) return reference;
  const lines = readFileSync(absolute, "utf8").split("\n");
  const symbol = reference.symbol.replace(/\(\)$/, "");
  const holds = (index) => lines[index]?.includes(symbol);
  if (reference.line && holds(reference.line - 1)) return reference;
  const declared = lines.findIndex((text) =>
    new RegExp(
      `(function|const|class|type|interface|export default|export)\\s+.*\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
    ).test(text)
  );
  const anywhere = declared >= 0 ? declared : lines.findIndex((text) => text.includes(symbol));
  if (anywhere < 0) {
    problems.push(`${where}: symbol ${reference.symbol} not found in ${reference.path}`);
    const { line: _line, symbol: _symbol, ...rest } = reference;
    return rest;
  }
  return { ...reference, line: anywhere + 1 };
}

// --- Assemble ------------------------------------------------------------

const usedBy = new Map();
for (const area of authored.areas)
  for (const dependency of area.dependsOn ?? []) {
    if (!areaIds.has(dependency)) {
      problems.push(`${area.id} depends on unknown area ${dependency}`);
      continue;
    }
    usedBy.set(dependency, [...(usedBy.get(dependency) ?? []), area.id]);
  }

const byDateDesc = (a, b) => Date.parse(pulls[b].date) - Date.parse(pulls[a].date);

const areas = authored.areas.map((area) => {
  const size = tree.get(area.id) ?? { files: 0, loc: 0, testFiles: 0, largest: null };
  const past = history.get(area.id);
  const merged = [...past.merged].sort(byDateDesc);
  const areaIssues = issuesByArea.get(area.id) ?? { open: [], closed: [] };
  return {
    ...area,
    dependsOn: (area.dependsOn ?? []).filter((id) => areaIds.has(id) && id !== area.id),
    usedBy: usedBy.get(area.id) ?? [],
    flow: area.flow.map((step) => checkReference(step, `${area.id} flow`)),
    features: area.features.map((feature) => ({
      ...feature,
      entry: feature.entry.map((entry) => checkReference(entry, `${area.id} feature`)),
    })),
    entryPoints: area.entryPoints.map((entry) => checkReference(entry, `${area.id} entry`)),
    stats: {
      files: size.files,
      loc: size.loc,
      testFiles: size.testFiles,
      largestFile: size.largest,
      commits: past.commits,
      commitsLast30: past.commitsLast30,
      mergedPulls: merged.length,
      mergedLast30: merged.filter((number) => isRecent(pulls[number].date)).length,
      openPulls: past.open.length,
      openIssues: areaIssues.open.length,
      lastTouched: past.lastTouched,
      weekly: past.weekly,
    },
    hotFiles: [...past.churn]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([file, changes]) => ({ path: file, changes, lines: lineCounts.get(file) ?? null })),
    pulls: { merged, open: past.open },
    issues: areaIssues,
    people: [...past.people]
      .sort((a, b) => b[1] - a[1])
      .map(([login, count]) => ({ login, commits: count })),
  };
});

for (const band of authored.bands)
  for (const group of band.groups)
    for (const id of group.areas)
      if (!areaIds.has(id)) problems.push(`band ${band.id} lists unknown area ${id}`);
const placed = new Set(authored.bands.flatMap((band) => band.groups.flatMap((group) => group.areas)));
for (const id of areaIds) if (!placed.has(id)) problems.push(`area ${id} is not placed in any band`);
for (const stop of authored.tour)
  for (const id of stop.areas)
    if (!areaIds.has(id)) problems.push(`tour stop "${stop.title}" lists unknown area ${id}`);

const bots = new Set(authored.bots ?? []);
const output = {
  repo: {
    ...authored.repo,
    analysedAt: newest.date,
    commit: newest.sha.slice(0, 7),
    firstCommit: oldest.date,
    weekStart: new Date(firstWeek).toISOString(),
    totals: {
      commits: commits.length,
      mergedPulls: Object.values(pulls).filter((pull) => pull.state === "merged").length,
      openPulls: Object.values(pulls).filter((pull) => pull.state === "open").length,
      openIssues: snapshot.issues.filter((issue) => issue.state === "open").length,
      contributors: [...people.values()].filter((person) => person.commits > 0 && !bots.has(person.login)).length,
      files: areas.reduce((sum, area) => sum + area.stats.files, 0),
      loc: areas.reduce((sum, area) => sum + area.stats.loc, 0),
      unmappedFiles,
    },
  },
  bands: authored.bands,
  outside: authored.outside,
  tour: authored.tour,
  areas,
  people: Object.fromEntries(
    [...people.values()].map((person) => [
      person.login,
      { ...person, name: authored.names?.[person.login] ?? person.login, bot: bots.has(person.login) },
    ])
  ),
  pulls,
  issues,
};

writeFileSync(outPath, `${JSON.stringify(output, null, "\t")}\n`);

const unique = [...new Set(problems)];
console.log(`wrote ${path.relative(root, outPath)}: ${areas.length} areas, ${Object.keys(pulls).length} pull requests, ${Object.keys(issues).length} issues`);
if (unique.length > 0) {
  console.log(`\n${unique.length} problem(s):`);
  for (const problem of unique) console.log(`  - ${problem}`);
  process.exitCode = 1;
}

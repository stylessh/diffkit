import type { FileChanges, RepoSpec } from "../types.ts";

/**
 * A generated monorepo whose two open PRs stress the diff viewer: one with
 * about 250 files and 40k+ changed lines (GitHub's diff media type still
 * serves it), one with 400 files (past GitHub's 300-file diff limit, so the
 * dashboard has to fall back to the paginated files API).
 */

function createRandom(seed: number) {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
	return {
		int: (min: number, max: number) =>
			min + Math.floor(next() * (max - min + 1)),
		pick: <T>(items: readonly T[]) =>
			items[Math.floor(next() * items.length)] as T,
		chance: (probability: number) => next() < probability,
	};
}

type Random = ReturnType<typeof createRandom>;

const NOUNS = [
	"channel",
	"session",
	"cursor",
	"buffer",
	"frame",
	"packet",
	"route",
	"token",
	"replica",
	"ledger",
	"segment",
	"shard",
	"snapshot",
	"window",
	"payload",
	"tenant",
	"region",
	"queue",
	"lease",
	"metric",
] as const;
const VERBS = [
	"resolve",
	"flush",
	"encode",
	"decode",
	"merge",
	"apply",
	"collect",
	"schedule",
	"verify",
	"compact",
	"replay",
	"partition",
	"hydrate",
	"evict",
	"stream",
] as const;
const PACKAGES = [
	"core",
	"transport",
	"storage",
	"scheduler",
	"telemetry",
	"auth",
	"ui",
	"cli",
] as const;

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

function identifier(random: Random) {
	return `${random.pick(VERBS)}${capitalize(random.pick(NOUNS))}`;
}

function statement(random: Random, indent: string) {
	const noun = random.pick(NOUNS);
	const other = random.pick(NOUNS);
	switch (random.int(0, 9)) {
		case 0:
			return `${indent}const ${noun}Count = ${other}s.filter((item) => item.active).length;`;
		case 1:
			return `${indent}if (${noun}.expiresAt < Date.now()) return ${random.pick(["null", "undefined", "false"])};`;
		case 2:
			return `${indent}await ${identifier(random)}(${noun}, { timeoutMs: ${random.int(1, 30) * 100} });`;
		case 3:
			return `${indent}${noun}.version += ${random.int(1, 4)};`;
		case 4:
			return `${indent}logger.debug("${random.pick(VERBS)} ${noun}", { id: ${noun}.id });`;
		case 5:
			return `${indent}const ${other}Key = \`\${${noun}.tenant}:\${${noun}.id}\`;`;
		case 6:
			return `${indent}for (const ${other} of ${noun}.${other}s) ${identifier(random)}(${other});`;
		case 7:
			return `${indent}metrics.increment("atlas.${noun}.${random.pick(VERBS)}");`;
		case 8:
			return `${indent}// ${capitalize(random.pick(VERBS))} before the ${other} is visible to readers.`;
		default:
			return `${indent}return { ...${noun}, ${other}: ${identifier(random)}(${noun}) };`;
	}
}

function functionBlock(random: Random) {
	const name = identifier(random);
	const noun = random.pick(NOUNS);
	const lines = [
		`export async function ${name}(${noun}: ${capitalize(noun)}, options: ${capitalize(random.pick(VERBS))}Options = {}) {`,
	];
	for (let index = random.int(3, 9); index > 0; index--) {
		lines.push(statement(random, "\t"));
	}
	lines.push("}", "");
	return lines;
}

function typeBlock(random: Random) {
	const noun = random.pick(NOUNS);
	const lines = [`export interface ${capitalize(noun)} {`, "\tid: string;"];
	for (let index = random.int(2, 6); index > 0; index--) {
		lines.push(
			`\t${random.pick(NOUNS)}${capitalize(random.pick(NOUNS))}: ${random.pick(["string", "number", "boolean", "Date", "string[]", `${capitalize(random.pick(NOUNS))} | null`])};`,
		);
	}
	lines.push("}", "");
	return lines;
}

function tsModule(random: Random, lineTarget: number) {
	const lines = [
		`import { logger, metrics } from "@atlas/${random.pick(PACKAGES)}";`,
		`import type { ${capitalize(random.pick(NOUNS))} } from "./types";`,
		"",
	];
	while (lines.length < lineTarget) {
		lines.push(
			...(random.chance(0.25) ? typeBlock(random) : functionBlock(random)),
		);
	}
	return lines;
}

function tsxModule(random: Random, lineTarget: number) {
	const component = `${capitalize(random.pick(NOUNS))}${capitalize(random.pick(["Panel", "List", "Badge", "Card", "Toolbar"]))}`;
	const lines = [
		`import { useMemo, useState } from "react";`,
		`import styles from "./${component}.module.css";`,
		"",
		`export function ${component}({ items }: { items: ${capitalize(random.pick(NOUNS))}[] }) {`,
		'\tconst [query, setQuery] = useState("");',
		"\tconst visible = useMemo(() => items.filter((item) => item.id.includes(query)), [items, query]);",
		"\treturn (",
		`\t\t<section className={styles.root} aria-label="${component}">`,
	];
	while (lines.length < lineTarget - 4) {
		const noun = random.pick(NOUNS);
		lines.push(
			`\t\t\t<div className={styles.${noun}} data-${noun}={visible.length}>`,
			`\t\t\t\t<span>{${random.chance(0.5) ? `visible[0]?.${noun}` : `"${capitalize(noun)}"`}}</span>`,
			"\t\t\t</div>",
		);
	}
	lines.push("\t\t</section>", "\t);", "}", "");
	return lines;
}

function cssModule(random: Random, lineTarget: number) {
	const lines: string[] = [];
	while (lines.length < lineTarget) {
		lines.push(
			`.${random.pick(NOUNS)} {`,
			`\tdisplay: ${random.pick(["flex", "grid", "block", "inline-flex"])};`,
			`\tgap: ${random.int(1, 6) * 4}px;`,
			`\tcolor: var(--atlas-${random.pick(["fg", "muted", "accent", "danger"])});`,
			"}",
			"",
		);
	}
	return lines;
}

function markdownDoc(random: Random, lineTarget: number) {
	const lines = [
		`# ${capitalize(random.pick(NOUNS))} ${random.pick(VERBS)}`,
		"",
	];
	while (lines.length < lineTarget) {
		const noun = random.pick(NOUNS);
		lines.push(
			`## ${capitalize(random.pick(VERBS))} the ${noun}`,
			"",
			`The ${noun} is ${random.pick(VERBS)}d before any ${random.pick(NOUNS)} reads it, so readers never observe a partial ${random.pick(NOUNS)}.`,
			"",
			"```ts",
			statement(random, ""),
			"```",
			"",
		);
	}
	return lines;
}

type FileKind = "ts" | "tsx" | "css" | "md";

function render(kind: FileKind, random: Random, lineTarget: number) {
	const lines =
		kind === "ts"
			? tsModule(random, lineTarget)
			: kind === "tsx"
				? tsxModule(random, lineTarget)
				: kind === "css"
					? cssModule(random, lineTarget)
					: markdownDoc(random, lineTarget);
	return `${lines.join("\n")}\n`;
}

function pathFor(kind: FileKind, pkg: string, index: number) {
	switch (kind) {
		case "ts":
			return `packages/${pkg}/src/${NOUNS[index % NOUNS.length]}-${index}.ts`;
		case "tsx":
			return `packages/${pkg}/src/components/${capitalize(NOUNS[index % NOUNS.length])}View${index}.tsx`;
		case "css":
			return `packages/${pkg}/src/components/${capitalize(NOUNS[index % NOUNS.length])}View${index}.module.css`;
		case "md":
			return `docs/${pkg}/${VERBS[index % VERBS.length]}-${index}.md`;
	}
}

const KINDS: readonly FileKind[] = ["ts", "ts", "ts", "tsx", "css", "md"];

type BaseFile = { path: string; kind: FileKind; content: string };

function buildBase(random: Random): BaseFile[] {
	const files: BaseFile[] = [];
	for (let index = 0; index < 260; index++) {
		const kind = KINDS[index % KINDS.length];
		files.push({
			path: pathFor(kind, PACKAGES[index % PACKAGES.length], index),
			kind,
			content: render(kind, random, random.int(60, 260)),
		});
	}
	return files;
}

/** Rewrites a few regions of a file: replaced lines, inserted blocks, removed blocks. */
function edit(random: Random, file: BaseFile, heavy: boolean) {
	const lines = file.content.trimEnd().split("\n");
	const regions = heavy ? random.int(25, 45) : random.int(1, 5);
	for (let region = 0; region < regions; region++) {
		const at = random.int(3, Math.max(3, lines.length - 2));
		const removed = random.int(0, heavy ? 40 : 6);
		const inserted =
			file.kind === "ts"
				? Array.from({ length: random.int(1, heavy ? 60 : 10) }, () =>
						statement(random, "\t"),
					)
				: render(file.kind, random, random.int(4, heavy ? 60 : 12))
						.trimEnd()
						.split("\n");
		lines.splice(at, removed, ...inserted);
	}
	return `${lines.join("\n")}\n`;
}

function buildRefactor(random: Random, base: BaseFile[]): FileChanges {
	const changes: FileChanges = {};
	const pool = [...base];
	const take = () =>
		pool.splice(random.int(0, pool.length - 1), 1)[0] as BaseFile;

	for (let index = 0; index < 120; index++) {
		const file = take();
		changes[file.path] = edit(random, file, index < 6);
	}
	for (let index = 0; index < 30; index++) {
		changes[take().path] = null;
	}
	for (let index = 0; index < 30; index++) {
		const file = take();
		changes[file.path] = null;
		changes[file.path.replace(/^(packages|docs)\//u, "$1/legacy/")] =
			file.content;
	}
	for (let index = 0; index < 70; index++) {
		const kind = KINDS[index % KINDS.length];
		const large = index < 10;
		changes[
			pathFor(kind, `${PACKAGES[index % PACKAGES.length]}-next`, 1000 + index)
		] = render(
			kind,
			random,
			large ? random.int(1500, 3000) : random.int(40, 220),
		);
	}
	return changes;
}

function buildVendorSweep(random: Random): FileChanges {
	const changes: FileChanges = {};
	for (let index = 0; index < 400; index++) {
		const locale = `${String.fromCharCode(97 + (index % 26))}${String.fromCharCode(97 + ((index * 7) % 26))}`;
		changes[`vendor/locales/${locale}-${index}.ts`] = render(
			"ts",
			random,
			random.int(12, 40),
		);
	}
	return changes;
}

const random = createRandom(0x41_71_a5);
const base = buildBase(random);
const refactorChanges = buildRefactor(random, base);
const vendorChanges = buildVendorSweep(random);

export const atlas: RepoSpec = {
	owner: "lumen-labs",
	name: "atlas",
	description: "Lumen Labs' realtime data plane, as one big monorepo.",
	language: "TypeScript",
	languages: { TypeScript: 820_000, CSS: 64_000, Markdown: 41_000 },
	topics: ["monorepo", "realtime"],
	stars: 18,
	forks: 1,
	watchers: 6,
	commits: [
		{
			message: "Import atlas",
			author: "nova",
			at: { d: 40 },
			files: Object.fromEntries(base.map((file) => [file.path, file.content])),
		},
	],
	branches: [
		{
			name: "refactor/atlas-v2",
			commits: [
				{
					message: "Atlas v2: split packages, move legacy modules",
					author: "jun-park",
					at: { d: 2, h: 5 },
					files: refactorChanges,
				},
			],
		},
		{
			name: "chore/vendor-locales",
			commits: [
				{
					message: "Vendor every locale bundle",
					author: "sam-okafor",
					at: { d: 1, h: 9 },
					files: vendorChanges,
				},
			],
		},
	],
	pulls: [
		{
			head: "refactor/atlas-v2",
			title: "Atlas v2: split packages and move legacy modules",
			body: "Moves the v1 modules under `packages/legacy`, adds the `-next` packages and rewrites the hot paths.\n\nThis is the big one: about 250 files.",
			author: "jun-park",
			at: { d: 2, h: 4 },
		},
		{
			head: "chore/vendor-locales",
			title: "Vendor every locale bundle",
			body: "Checks in all 400 locale bundles so builds stop fetching them.",
			author: "sam-okafor",
			at: { d: 1, h: 8 },
		},
	],
};

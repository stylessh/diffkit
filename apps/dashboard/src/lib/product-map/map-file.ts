import { compileGlob, expandBraces, type PathRule } from "./path-rules";

/**
 * The `.diffkit` folder: the part of a product map a repository owns.
 * `map.json` lays out the overview and each file in `areas/` describes one
 * area and says which files belong to it. Everything countable (sizes, pull
 * requests, people) is computed from GitHub when the map is opened and is
 * never stored here.
 */
export const MAP_FILE_PATH = ".diffkit/map.json";
export const MAP_AREAS_PATH = ".diffkit/areas";
export const MAP_FILE_VERSION = 1;

export type CodeReference = {
	path: string;
	line?: number;
	symbol?: string;
	role: string;
};

export type FlowStep = {
	kind: string;
	label: string;
	note: string;
	path?: string;
};

export type AreaFeature = {
	name: string;
	summary: string;
	entry: CodeReference[];
};

export type MapFileArea = {
	id: string;
	name: string;
	icon: string;
	tagline: string;
	summary: string;
	/** Which files belong to the area, as path patterns. */
	paths: string[];
	flow: FlowStep[];
	features: AreaFeature[];
	entryPoints: CodeReference[];
	dependsOn: string[];
	outside: string[];
	goodParts: string[];
	watch: string[];
	/** Repository paths of a screenshot of this area, one per theme. */
	screen?: { light: string; dark: string };
};

export type MapGroup = { id: string; name: string; areas: string[] };
export type MapBand = {
	id: string;
	name: string;
	caption: string;
	groups: MapGroup[];
};
export type OutsideSystem = {
	id: string;
	name: string;
	owner: string;
	role: string;
};
export type TourStop = {
	title: string;
	text: string;
	areas: string[];
	outside: string[];
};
/** Which areas an issue is about; only shown while the issue is open. */
export type IssueHint = { number: number; areas: string[]; note?: string };

/** The whole folder, read and joined. */
export type MapFile = {
	version: typeof MAP_FILE_VERSION;
	pitch: string;
	description: string;
	bands: MapBand[];
	areas: MapFileArea[];
	/** Every area's patterns as one list; the matcher picks the most specific. */
	rules: PathRule[];
	ignore: string[];
	outside: OutsideSystem[];
	tour: TourStop[];
	issues: IssueHint[];
};

/** The folder as text: `map.json` and each file found in `areas/`. */
export type MapFolderSource = {
	index: string;
	areas: readonly { name: string; text: string }[];
};

export type ParsedMapFile =
	| { ok: true; map: MapFile }
	| { ok: false; problems: string[] };

export const MAX_AREAS = 200;
const MAX_PATTERNS_PER_AREA = 100;
const MAX_TEXT = 2000;
const MAX_PROBLEMS = 20;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(text: string): Json | null {
	try {
		const value: unknown = JSON.parse(text);
		return isObject(value) ? value : null;
	} catch {
		return null;
	}
}

/**
 * Reads the folder. Any problem makes the whole map invalid: a map that is
 * half right would show areas with nothing in them and no hint why.
 */
export function parseMapFolder(source: MapFolderSource): ParsedMapFile {
	const index = readJson(source.index);
	if (!index)
		return { ok: false, problems: ["map.json is not a JSON object."] };
	if (index.version !== MAP_FILE_VERSION)
		return {
			ok: false,
			problems: [`map.json: "version" must be ${MAP_FILE_VERSION}.`],
		};

	const problems: string[] = [];
	const problem = (message: string) => {
		if (problems.length < MAX_PROBLEMS) problems.push(message);
	};

	const textOf = (from: Json, key: string, where: string, optional = false) => {
		const value = from[key];
		if (value === undefined && optional) return "";
		if (typeof value !== "string" || value.length > MAX_TEXT) {
			problem(
				`${where}: "${key}" must be text of at most ${MAX_TEXT} characters.`,
			);
			return "";
		}
		return value;
	};
	const list = (from: Json, key: string, where: string, max = 100) => {
		const value = from[key];
		if (value === undefined) return [];
		if (!Array.isArray(value) || value.length > max) {
			problem(`${where}: "${key}" must be a list of at most ${max} items.`);
			return [];
		}
		return value as unknown[];
	};
	const objects = (from: Json, key: string, where: string, max = 100) =>
		list(from, key, where, max).flatMap((item, at) => {
			if (isObject(item)) return [{ item, at: `${where}: ${key}[${at}]` }];
			problem(`${where}: ${key}[${at}] must be an object.`);
			return [];
		});
	const strings = (from: Json, key: string, where: string, max = 100) =>
		list(from, key, where, max).flatMap((item, at) => {
			if (typeof item === "string" && item.length <= MAX_TEXT) return [item];
			problem(`${where}: ${key}[${at}] must be text.`);
			return [];
		});
	const idOf = (from: Json, where: string) => {
		const value = from.id;
		if (typeof value === "string" && ID.test(value)) return value;
		problem(`${where}: "id" must be lowercase letters, digits and dashes.`);
		return "";
	};
	const repoPath = (value: unknown, where: string) => {
		if (
			typeof value === "string" &&
			value.length > 0 &&
			value.length <= 400 &&
			!value.startsWith("/") &&
			!value.split("/").includes("..")
		)
			return value;
		problem(`${where} must be a path inside the repository.`);
		return "";
	};
	const reference = (item: Json, at: string): CodeReference => ({
		path: repoPath(item.path, `${at}.path`),
		role: textOf(item, "role", at, true),
		...(typeof item.symbol === "string" ? { symbol: item.symbol } : {}),
		...(Number.isInteger(item.line) && (item.line as number) > 0
			? { line: item.line as number }
			: {}),
	});
	const glob = (value: unknown, where: string) => {
		if (typeof value !== "string") {
			problem(`${where} must be a path pattern.`);
			return "";
		}
		try {
			compileGlob(value);
			expandBraces(value);
		} catch (error) {
			problem(`${where} "${value}": ${(error as Error).message}.`);
		}
		return value;
	};

	if (source.areas.length > MAX_AREAS)
		problem(`areas/ holds more than ${MAX_AREAS} files.`);
	const issues = new Map<number, IssueHint>();
	const areas = source.areas
		.slice(0, MAX_AREAS)
		.flatMap((file): MapFileArea[] => {
			const where = `areas/${file.name}`;
			const id = file.name.replace(/\.json$/, "");
			if (!(file.name.endsWith(".json") && ID.test(id))) {
				problem(
					`${where}: name the file after the area, in lowercase letters, digits and dashes, ending in .json.`,
				);
				return [];
			}
			const item = readJson(file.text);
			if (!item) {
				problem(`${where} is not a JSON object.`);
				return [];
			}
			const screen = item.screen;
			const paths = list(item, "paths", where, MAX_PATTERNS_PER_AREA).map(
				(value, at) => glob(value, `${where}: paths[${at}]`),
			);
			if (paths.length === 0)
				problem(`${where}: "paths" must list at least one path pattern.`);
			for (const { item: hint, at } of objects(item, "issues", where, 50)) {
				if (!Number.isInteger(hint.number)) {
					problem(`${at}.number must be an issue number.`);
					continue;
				}
				const number = hint.number as number;
				const known = issues.get(number) ?? { number, areas: [] };
				known.areas.push(id);
				if (typeof hint.note === "string") known.note = hint.note;
				issues.set(number, known);
			}
			return [
				{
					id,
					name: textOf(item, "name", where),
					icon: textOf(item, "icon", where, true),
					tagline: textOf(item, "tagline", where),
					summary: textOf(item, "summary", where),
					paths,
					flow: objects(item, "flow", where, 12).map(({ item: step, at }) => ({
						kind: textOf(step, "kind", at),
						label: textOf(step, "label", at),
						note: textOf(step, "note", at),
						...(step.path === undefined
							? {}
							: { path: repoPath(step.path, `${at}.path`) }),
					})),
					features: objects(item, "features", where, 30).map(
						({ item: feature, at }) => ({
							name: textOf(feature, "name", at),
							summary: textOf(feature, "summary", at),
							entry: objects(feature, "entry", at, 10).map((entry) =>
								reference(entry.item, entry.at),
							),
						}),
					),
					entryPoints: objects(item, "entryPoints", where, 20).map((entry) =>
						reference(entry.item, entry.at),
					),
					dependsOn: strings(item, "dependsOn", where),
					outside: strings(item, "outside", where),
					goodParts: strings(item, "goodParts", where, 20),
					watch: strings(item, "watch", where, 20),
					...(isObject(screen)
						? {
								screen: {
									light: repoPath(screen.light, `${where}: screen.light`),
									dark: repoPath(screen.dark, `${where}: screen.dark`),
								},
							}
						: {}),
				},
			];
		});
	if (areas.length === 0) problem("areas/ must hold at least one area file.");
	const areaIds = new Set(areas.map((area) => area.id));
	const knownArea = (value: string, where: string) => {
		if (!areaIds.has(value))
			problem(`${where} names an unknown area "${value}".`);
	};
	for (const area of areas)
		for (const other of area.dependsOn)
			knownArea(other, `areas/${area.id}.json: dependsOn`);

	const placed = new Set<string>();
	const bands = objects(index, "bands", "map.json", 20).map(
		({ item, at }): MapBand => ({
			id: idOf(item, at),
			name: textOf(item, "name", at),
			caption: textOf(item, "caption", at, true),
			groups: objects(item, "groups", at, 30).map(
				({ item: group, at: groupAt }) => {
					const members = strings(group, "areas", groupAt, MAX_AREAS);
					for (const member of members) {
						knownArea(member, groupAt);
						if (placed.has(member))
							problem(`Area "${member}" is in more than one group.`);
						placed.add(member);
					}
					return {
						id: idOf(group, groupAt),
						name: textOf(group, "name", groupAt),
						areas: members,
					};
				},
			),
		}),
	);
	for (const area of areas)
		if (!placed.has(area.id))
			problem(
				`Area "${area.id}" is not in any group in map.json, so it would not show.`,
			);

	const map: MapFile = {
		version: MAP_FILE_VERSION,
		pitch: textOf(index, "pitch", "map.json"),
		description: textOf(index, "description", "map.json", true),
		bands,
		areas,
		rules: areas.flatMap((area) =>
			area.paths.map((path) => ({ path, area: area.id })),
		),
		ignore: list(index, "ignore", "map.json", 200).map((value, at) =>
			glob(value, `map.json: ignore[${at}]`),
		),
		outside: objects(index, "outside", "map.json", 50).map(({ item, at }) => ({
			id: idOf(item, at),
			name: textOf(item, "name", at),
			owner: textOf(item, "owner", at),
			role: textOf(item, "role", at, true),
		})),
		tour: objects(index, "tour", "map.json", 20).map(({ item, at }) => {
			const stopAreas = strings(item, "areas", at);
			for (const area of stopAreas) knownArea(area, at);
			return {
				title: textOf(item, "title", at),
				text: textOf(item, "text", at),
				areas: stopAreas,
				outside: strings(item, "outside", at),
			};
		}),
		issues: [...issues.values()],
	};
	return problems.length > 0 ? { ok: false, problems } : { ok: true, map };
}

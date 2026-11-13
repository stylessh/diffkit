import { compilePatterns, type PathRule } from "./path-rules";

/**
 * The `.diffkit` folder: the part of a product map a repository owns.
 * `map.json` lays out the overview and each file in `areas/` describes one
 * area and says which files belong to it. They hold only what someone has to
 * say: what an area is and how it works. Everything that can be counted or
 * looked up (file counts, pull requests, people, the files that change most, line
 * numbers) is computed from GitHub when the map is opened and never stored.
 *
 * The format is closed: a field, icon or step kind that is not listed below
 * is an error, never ignored. An agent writes these files, and the only way
 * to keep what it writes inside what the page can draw is to refuse the rest.
 */
export const MAP_FILE_PATH = ".diffkit/map.json";
export const MAP_AREAS_PATH = ".diffkit/areas";
export const MAP_FILE_VERSION = 1;

/** Every icon an area may name. */
export const AREA_ICONS = [
	"actions",
	"cache",
	"code",
	"command",
	"comment",
	"commit",
	"compare",
	"computer",
	"display",
	"github",
	"globe",
	"home",
	"inbox",
	"issues",
	"kit",
	"layers",
	"lock",
	"package",
	"pull",
	"refresh",
	"repo",
	"reviews",
	"settings",
	"shell",
	"tag",
] as const;
export type AreaIcon = (typeof AREA_ICONS)[number];

/** Every kind a flow step may have; the kind picks its lane and icon. */
export const FLOW_KINDS = [
	"page",
	"component",
	"client",
	"server",
	"route",
	"github",
	"storage",
	"external",
	"tool",
] as const;
export type FlowKind = (typeof FLOW_KINDS)[number];

/**
 * The fields each object may have, in the order they are written. The parser
 * rejects anything else, and the skill's checker sorts keys into this order.
 */
export const MAP_FIELDS = {
	index: [
		"version",
		"pitch",
		"description",
		"bands",
		"ignore",
		"outside",
		"tour",
	],
	band: ["id", "name", "caption", "groups"],
	group: ["id", "name", "areas"],
	outsideSystem: ["id", "name", "owner", "role"],
	tourStop: ["title", "text", "areas", "outside"],
	area: [
		"name",
		"icon",
		"tagline",
		"summary",
		"paths",
		"screen",
		"flow",
		"features",
		"dependsOn",
		"outside",
		"issues",
	],
	screen: ["light", "dark"],
	flowStep: ["kind", "label", "note", "path"],
	feature: ["name", "summary", "path"],
	issueHint: ["number", "note"],
} as const;

export type FlowStep = {
	kind: FlowKind;
	label: string;
	note: string;
	path?: string;
};

export type AreaFeature = {
	name: string;
	summary: string;
	/** The one file to open first, when there is an obvious one. */
	path?: string;
};

export type MapFileArea = {
	id: string;
	name: string;
	/** Empty when the file names none; the page then draws a neutral icon. */
	icon: AreaIcon | "";
	tagline: string;
	summary: string;
	/** Which files belong to the area, as path patterns. */
	paths: string[];
	flow: FlowStep[];
	features: AreaFeature[];
	dependsOn: string[];
	outside: string[];
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
const MAX_PROBLEMS = 30;
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

	const onlyKnown = (from: Json, where: string, fields: readonly string[]) => {
		for (const key of Object.keys(from))
			if (!fields.includes(key))
				problem(
					`${where}: unknown field "${key}". Allowed: ${fields.join(", ")}.`,
				);
	};
	const textOf = (from: Json, key: string, where: string, optional = false) => {
		const value = from[key];
		if (value === undefined && optional) return "";
		if (
			typeof value !== "string" ||
			value.trim().length === 0 ||
			value.length > MAX_TEXT
		) {
			problem(
				`${where}: "${key}" must be text of 1 to ${MAX_TEXT} characters.`,
			);
			return "";
		}
		return value;
	};
	const oneOf = <T extends string>(
		from: Json,
		key: string,
		where: string,
		allowed: readonly T[],
		optional = false,
	): T | "" => {
		const value = from[key];
		if (value === undefined && optional) return "";
		if (allowed.includes(value as T)) return value as T;
		problem(`${where}: "${key}" must be one of: ${allowed.join(", ")}.`);
		return "";
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
	const objects = (
		from: Json,
		key: string,
		where: string,
		fields: readonly string[],
		max = 100,
	) =>
		list(from, key, where, max).flatMap((item, at) => {
			const here = `${where}: ${key}[${at}]`;
			if (!isObject(item)) {
				problem(`${here} must be an object.`);
				return [];
			}
			onlyKnown(item, here, fields);
			return [{ item, at: here }];
		});
	const strings = (from: Json, key: string, where: string, max = 100) =>
		list(from, key, where, max).flatMap((item, at) => {
			if (
				typeof item === "string" &&
				item.trim().length > 0 &&
				item.length <= MAX_TEXT
			)
				return [item];
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
	const glob = (value: unknown, where: string) => {
		if (typeof value !== "string") {
			problem(`${where} must be a path pattern.`);
			return "";
		}
		try {
			compilePatterns(value);
		} catch (error) {
			problem(`${where} "${value}": ${(error as Error).message}.`);
		}
		return value;
	};

	const uniquelyNamed = (features: AreaFeature[], where: string) => {
		const names = new Set<string>();
		for (const feature of features) {
			if (feature.name && names.has(feature.name))
				problem(`${where}: two features are named "${feature.name}".`);
			names.add(feature.name);
		}
		return features;
	};

	onlyKnown(index, "map.json", MAP_FIELDS.index);
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
			onlyKnown(item, where, MAP_FIELDS.area);
			const paths = list(item, "paths", where, MAX_PATTERNS_PER_AREA).map(
				(value, at) => glob(value, `${where}: paths[${at}]`),
			);
			if (paths.length === 0)
				problem(`${where}: "paths" must list at least one path pattern.`);
			for (const { item: hint, at } of objects(
				item,
				"issues",
				where,
				MAP_FIELDS.issueHint,
				50,
			)) {
				if (!(Number.isInteger(hint.number) && (hint.number as number) > 0)) {
					problem(`${at}: "number" must be an issue number.`);
					continue;
				}
				if (hint.note !== undefined && typeof hint.note !== "string")
					problem(`${at}: "note" must be text.`);
				const number = hint.number as number;
				const known = issues.get(number) ?? { number, areas: [] };
				known.areas.push(id);
				if (typeof hint.note === "string") known.note = hint.note;
				issues.set(number, known);
			}
			const { screen } = item;
			if (screen !== undefined && !isObject(screen))
				problem(`${where}: "screen" must be an object with light and dark.`);
			if (isObject(screen))
				onlyKnown(screen, `${where}: screen`, MAP_FIELDS.screen);
			return [
				{
					id,
					name: textOf(item, "name", where),
					icon: oneOf(item, "icon", where, AREA_ICONS, true),
					tagline: textOf(item, "tagline", where),
					summary: textOf(item, "summary", where),
					paths,
					flow: objects(item, "flow", where, MAP_FIELDS.flowStep, 12).flatMap(
						({ item: step, at }): FlowStep[] => {
							const kind = oneOf(step, "kind", at, FLOW_KINDS);
							const label = textOf(step, "label", at);
							const note = textOf(step, "note", at);
							const path =
								step.path === undefined
									? {}
									: { path: repoPath(step.path, `${at}.path`) };
							return kind ? [{ kind, label, note, ...path }] : [];
						},
					),
					features: uniquelyNamed(
						objects(item, "features", where, MAP_FIELDS.feature, 30).map(
							({ item: feature, at }) => ({
								name: textOf(feature, "name", at),
								summary: textOf(feature, "summary", at),
								...(feature.path === undefined
									? {}
									: { path: repoPath(feature.path, `${at}.path`) }),
							}),
						),
						where,
					),
					dependsOn: strings(item, "dependsOn", where),
					outside: strings(item, "outside", where),
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
	const bands = objects(index, "bands", "map.json", MAP_FIELDS.band, 20).map(
		({ item, at }): MapBand => ({
			id: idOf(item, at),
			name: textOf(item, "name", at),
			caption: textOf(item, "caption", at, true),
			groups: objects(item, "groups", at, MAP_FIELDS.group, 30).map(
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

	const outside = objects(
		index,
		"outside",
		"map.json",
		MAP_FIELDS.outsideSystem,
		50,
	).map(({ item, at }) => ({
		id: idOf(item, at),
		name: textOf(item, "name", at),
		owner: textOf(item, "owner", at),
		role: textOf(item, "role", at, true),
	}));
	const outsideIds = new Set(outside.map((system) => system.id));
	const knownOutside = (value: string, where: string) => {
		if (!outsideIds.has(value))
			problem(
				`${where} names an outside system "${value}" that map.json does not list.`,
			);
	};
	for (const area of areas)
		for (const system of area.outside)
			knownOutside(system, `areas/${area.id}.json: outside`);

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
		outside,
		tour: objects(index, "tour", "map.json", MAP_FIELDS.tourStop, 20).map(
			({ item, at }) => {
				const stopAreas = strings(item, "areas", at);
				for (const area of stopAreas) knownArea(area, at);
				const stopOutside = strings(item, "outside", at);
				for (const system of stopOutside) knownOutside(system, at);
				return {
					title: textOf(item, "title", at),
					text: textOf(item, "text", at),
					areas: stopAreas,
					outside: stopOutside,
				};
			},
		),
		issues: [...issues.values()],
	};
	return problems.length > 0 ? { ok: false, problems } : { ok: true, map };
}

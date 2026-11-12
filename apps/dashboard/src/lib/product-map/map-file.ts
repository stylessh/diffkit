import { compileGlob, type PathRule } from "./path-rules";

/**
 * `.diffkit/map.json`: the part of a product map a repository owns. It says
 * what the product's areas are, which files belong to each and how each one
 * works. Everything countable (sizes, pull requests, people) is computed from
 * GitHub when the map is opened and is never stored here.
 */
export const MAP_FILE_PATH = ".diffkit/map.json";
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

export type MapFile = {
	version: typeof MAP_FILE_VERSION;
	pitch: string;
	description: string;
	bands: MapBand[];
	areas: MapFileArea[];
	rules: PathRule[];
	ignore: string[];
	outside: OutsideSystem[];
	tour: TourStop[];
	issues: IssueHint[];
};

export type ParsedMapFile =
	| { ok: true; map: MapFile }
	| { ok: false; problems: string[] };

const MAX_AREAS = 200;
const MAX_RULES = 2000;
const MAX_TEXT = 2000;
const MAX_PROBLEMS = 20;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads one map file. Any problem makes the whole file invalid: a map that is
 * half right would show areas with nothing in them and no hint why.
 */
export function parseMapFile(content: string): ParsedMapFile {
	let raw: unknown;
	try {
		raw = JSON.parse(content);
	} catch {
		return { ok: false, problems: ["The file is not valid JSON."] };
	}
	if (!isObject(raw))
		return { ok: false, problems: ["The file must be a JSON object."] };
	if (raw.version !== MAP_FILE_VERSION)
		return {
			ok: false,
			problems: [`"version" must be ${MAP_FILE_VERSION}.`],
		};

	const problems: string[] = [];
	const problem = (message: string) => {
		if (problems.length < MAX_PROBLEMS) problems.push(message);
	};

	const textOf = (
		source: Json,
		key: string,
		where: string,
		optional = false,
	) => {
		const value = source[key];
		if (value === undefined && optional) return "";
		if (typeof value !== "string" || value.length > MAX_TEXT) {
			problem(
				`${where}.${key} must be text of at most ${MAX_TEXT} characters.`,
			);
			return "";
		}
		return value;
	};
	const list = (source: Json, key: string, where: string, max = 100) => {
		const value = source[key];
		if (value === undefined) return [];
		if (!Array.isArray(value) || value.length > max) {
			problem(`${where}.${key} must be a list of at most ${max} items.`);
			return [];
		}
		return value as unknown[];
	};
	const objects = (source: Json, key: string, where: string, max = 100) =>
		list(source, key, where, max).flatMap((item, index) => {
			if (isObject(item)) return [{ item, at: `${where}.${key}[${index}]` }];
			problem(`${where}.${key}[${index}] must be an object.`);
			return [];
		});
	const strings = (source: Json, key: string, where: string, max = 100) =>
		list(source, key, where, max).flatMap((item, index) => {
			if (typeof item === "string" && item.length <= MAX_TEXT) return [item];
			problem(`${where}.${key}[${index}] must be text.`);
			return [];
		});
	const id = (source: Json, where: string) => {
		const value = source.id;
		if (typeof value === "string" && ID.test(value)) return value;
		problem(`${where}.id must be lowercase letters, digits and dashes.`);
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

	const areas = objects(raw, "areas", "map", MAX_AREAS).map(
		({ item, at }): MapFileArea => {
			const screen = item.screen;
			return {
				id: id(item, at),
				name: textOf(item, "name", at),
				icon: textOf(item, "icon", at, true),
				tagline: textOf(item, "tagline", at),
				summary: textOf(item, "summary", at),
				flow: objects(item, "flow", at, 12).map(
					({ item: step, at: stepAt }) => ({
						kind: textOf(step, "kind", stepAt),
						label: textOf(step, "label", stepAt),
						note: textOf(step, "note", stepAt),
						...(step.path === undefined
							? {}
							: { path: repoPath(step.path, `${stepAt}.path`) }),
					}),
				),
				features: objects(item, "features", at, 30).map(
					({ item: feature, at: featureAt }) => ({
						name: textOf(feature, "name", featureAt),
						summary: textOf(feature, "summary", featureAt),
						entry: objects(feature, "entry", featureAt, 10).map((entry) =>
							reference(entry.item, entry.at),
						),
					}),
				),
				entryPoints: objects(item, "entryPoints", at, 20).map((entry) =>
					reference(entry.item, entry.at),
				),
				dependsOn: strings(item, "dependsOn", at),
				outside: strings(item, "outside", at),
				goodParts: strings(item, "goodParts", at, 20),
				watch: strings(item, "watch", at, 20),
				...(isObject(screen)
					? {
							screen: {
								light: repoPath(screen.light, `${at}.screen.light`),
								dark: repoPath(screen.dark, `${at}.screen.dark`),
							},
						}
					: {}),
			};
		},
	);
	if (areas.length === 0) problem("map.areas must list at least one area.");
	const areaIds = new Set<string>();
	for (const area of areas) {
		if (areaIds.has(area.id)) problem(`Area "${area.id}" is defined twice.`);
		areaIds.add(area.id);
	}
	const knownArea = (value: string, where: string) => {
		if (!areaIds.has(value))
			problem(`${where} names an unknown area "${value}".`);
	};
	for (const area of areas)
		for (const other of area.dependsOn)
			knownArea(other, `Area "${area.id}" dependsOn`);

	const placed = new Set<string>();
	const bands = objects(raw, "bands", "map", 20).map(
		({ item, at }): MapBand => ({
			id: id(item, at),
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
						id: id(group, groupAt),
						name: textOf(group, "name", groupAt),
						areas: members,
					};
				},
			),
		}),
	);
	for (const area of areas)
		if (area.id && !placed.has(area.id))
			problem(`Area "${area.id}" is not in any group, so it would not show.`);

	const glob = (value: unknown, where: string) => {
		if (typeof value !== "string") {
			problem(`${where} must be a path pattern.`);
			return "";
		}
		try {
			compileGlob(value);
		} catch (error) {
			problem(`${where} "${value}": ${(error as Error).message}.`);
		}
		return value;
	};
	const rules = objects(raw, "rules", "map", MAX_RULES).map(
		({ item, at }): PathRule => {
			const area = textOf(item, "area", at);
			knownArea(area, at);
			return { path: glob(item.path, `${at}.path`), area };
		},
	);
	if (rules.length === 0) problem("map.rules must assign at least one path.");
	const ignore = list(raw, "ignore", "map", 200).map((value, index) =>
		glob(value, `map.ignore[${index}]`),
	);

	const map: MapFile = {
		version: MAP_FILE_VERSION,
		pitch: textOf(raw, "pitch", "map"),
		description: textOf(raw, "description", "map", true),
		bands,
		areas,
		rules,
		ignore,
		outside: objects(raw, "outside", "map", 50).map(({ item, at }) => ({
			id: id(item, at),
			name: textOf(item, "name", at),
			owner: textOf(item, "owner", at),
			role: textOf(item, "role", at, true),
		})),
		tour: objects(raw, "tour", "map", 20).map(({ item, at }) => {
			const stopAreas = strings(item, "areas", at);
			for (const area of stopAreas) knownArea(area, at);
			return {
				title: textOf(item, "title", at),
				text: textOf(item, "text", at),
				areas: stopAreas,
				outside: strings(item, "outside", at),
			};
		}),
		issues: objects(raw, "issues", "map", 500).flatMap(({ item, at }) => {
			if (!Number.isInteger(item.number)) {
				problem(`${at}.number must be an issue number.`);
				return [];
			}
			const issueAreas = strings(item, "areas", at);
			for (const area of issueAreas) knownArea(area, at);
			return [
				{
					number: item.number as number,
					areas: issueAreas,
					...(typeof item.note === "string" ? { note: item.note } : {}),
				},
			];
		}),
	};
	return problems.length > 0 ? { ok: false, problems } : { ok: true, map };
}

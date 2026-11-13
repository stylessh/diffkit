import {
	buildMapActivity,
	type MapActivity,
	type PullInput,
} from "#/lib/product-map/activity";
import { type MapFile, parseMapFolder } from "#/lib/product-map/map-file";
import { type LoadedProductMap, loadProductMap } from "./product-map-data";

/** Fixed rather than `Date.now()`, so the sample draws the same every time. */
const SAMPLE_NOW = new Date(Date.UTC(2026, 9, 1));

const daysAgo = (days: number) =>
	new Date(SAMPLE_NOW.getTime() - days * 86_400_000).toISOString();

const SAMPLE_INDEX = {
	version: 1,
	pitch: "A shared inbox for everything your team ships.",
	description:
		"One place to see what needs you, answer it and follow it until it lands.",
	bands: [
		{
			id: "product",
			name: "What people use",
			caption: "The screens someone opens every day.",
			groups: [
				{ id: "in", name: "Getting in", areas: ["sign-in"] },
				{ id: "daily", name: "Every day", areas: ["inbox", "search"] },
			],
		},
		{
			id: "platform",
			name: "Behind the screens",
			caption: "What the screens stand on.",
			groups: [{ id: "data", name: "Data", areas: ["storage", "sync"] }],
		},
	],
	ignore: [],
	outside: [
		{
			id: "mail",
			name: "Mail",
			owner: "Your mail host",
			role: "Notifications",
		},
		{ id: "files", name: "Files", owner: "Object storage", role: "Uploads" },
	],
	tour: [],
};

const SAMPLE_AREAS: Record<string, object> = {
	"sign-in": {
		name: "Sign-in",
		icon: "lock",
		tagline: "Accounts, sessions and invitations",
		summary: "How someone gets an account and stays signed in.",
		paths: ["src/auth/**"],
		flow: [],
		features: [],
		dependsOn: ["storage"],
		outside: [],
	},
	inbox: {
		name: "Inbox",
		icon: "inbox",
		tagline: "Everything waiting on you, newest first",
		summary:
			"The list someone opens first. It gathers what was assigned, mentioned or replied to, and keeps each item until it is answered or set aside.",
		paths: ["src/inbox/**"],
		flow: [
			{
				kind: "page",
				label: "Inbox page",
				note: "Reads the saved filter and asks for the first page of items.",
				path: "src/inbox/page.tsx",
			},
			{
				kind: "server",
				label: "List items",
				note: "Joins assignments, mentions and replies into one ordered list.",
				path: "src/inbox/list.ts",
			},
			{
				kind: "storage",
				label: "Items table",
				note: "Keeps one row per item and who it is waiting on.",
			},
		],
		features: [
			{
				name: "Filters",
				summary: "Narrow the list by kind, person or project, and save it.",
				path: "src/inbox/filters.ts",
			},
			{
				name: "Snooze",
				summary: "Hide an item until a day you choose.",
				path: "src/inbox/snooze.ts",
			},
			{
				name: "Bulk actions",
				summary: "Answer or archive several items at once.",
			},
		],
		dependsOn: ["storage", "sync"],
		outside: ["mail"],
	},
	search: {
		name: "Search",
		icon: "command",
		tagline: "Find anything by a few letters",
		summary: "One box that finds items, people and projects.",
		paths: ["src/search/**"],
		flow: [],
		features: [],
		dependsOn: ["storage"],
		outside: [],
	},
	storage: {
		name: "Storage",
		icon: "layers",
		tagline: "Tables and uploads",
		summary: "Where items, people and files are kept.",
		paths: ["src/storage/**"],
		flow: [],
		features: [],
		dependsOn: [],
		outside: ["files"],
	},
	sync: {
		name: "Sync",
		icon: "refresh",
		tagline: "Keeps every open tab current",
		summary: "Sends each change to the people looking at it.",
		paths: ["src/sync/**"],
		flow: [],
		features: [],
		dependsOn: ["storage"],
		outside: [],
	},
};

const SAMPLE_TREE = [
	{ path: "src/auth/session.ts" },
	{ path: "src/inbox/page.tsx" },
	{ path: "src/inbox/list.ts" },
	{ path: "src/inbox/list.test.ts" },
	{ path: "src/inbox/filters.ts" },
	{ path: "src/inbox/snooze.ts" },
	{ path: "src/search/index.ts" },
	{ path: "src/storage/tables.ts" },
	{ path: "src/sync/channel.ts" },
];

const samplePull = (
	number: number,
	title: string,
	daysOld: number,
	paths: string[],
	state: PullInput["state"] = "merged",
): PullInput => ({
	number,
	title,
	state,
	author: number % 2 === 0 ? "octocat" : "hubot",
	authorAvatarUrl: null,
	bot: false,
	date: daysAgo(daysOld),
	files: paths.map((path) => ({ path, additions: 24, deletions: 6 })),
	filesTruncated: false,
});

const SAMPLE_PULLS: PullInput[] = [
	samplePull(41, "Save the inbox filter between visits", 44, [
		"src/inbox/filters.ts",
		"src/storage/tables.ts",
	]),
	samplePull(44, "Snooze an item until a chosen day", 30, [
		"src/inbox/snooze.ts",
		"src/inbox/list.ts",
	]),
	samplePull(47, "Fix the unread count after archiving", 16, [
		"src/inbox/list.ts",
		"src/inbox/list.test.ts",
	]),
	samplePull(52, "Search people as well as items", 9, ["src/search/index.ts"]),
	samplePull(55, "Keep the list in place while it refreshes", 3, [
		"src/inbox/page.tsx",
		"src/sync/channel.ts",
	]),
	samplePull(
		58,
		"Bulk archive from the inbox",
		1,
		["src/inbox/page.tsx", "src/inbox/list.ts"],
		"open",
	),
];

function parseSampleMap(): MapFile {
	const parsed = parseMapFolder({
		index: JSON.stringify(SAMPLE_INDEX),
		areas: Object.entries(SAMPLE_AREAS).map(([id, area]) => ({
			name: `${id}.json`,
			text: JSON.stringify(area),
		})),
	});
	if (!parsed.ok)
		throw new Error(`The sample product map is invalid: ${parsed.problems[0]}`);
	return parsed.map;
}

type SampleSource = { file: MapFile; activity: MapActivity };

let source: SampleSource | undefined;

function sampleSource(): SampleSource {
	if (source) return source;
	const file = parseSampleMap();
	source = {
		file,
		activity: buildMapActivity({
			map: file,
			tree: SAMPLE_TREE,
			pulls: SAMPLE_PULLS,
			issues: [],
			now: SAMPLE_NOW,
			limits: { treeTruncated: false, pullsTruncated: false },
		}),
	};
	return source;
}

/** The area a sample area page shows: the one with a flow, parts and work. */
export const SAMPLE_AREA_ID = "inbox";

/**
 * A made-up product's map with its counts, for skeletons to measure. Built
 * by the same parser and counter as a real one, so it cannot drift from them.
 */
export function sampleProductMap(
	owner: string,
	repo: string,
): LoadedProductMap {
	const { file, activity } = sampleSource();
	return loadProductMap(file, { owner, name: repo, branch: "main" }, activity);
}

/** The sample map's worked area, for the parts of a page that wait on counts. */
export function sampleArea(map: LoadedProductMap) {
	const area = map.areaById.get(SAMPLE_AREA_ID);
	if (!area) throw new Error("The sample product map lost its sample area.");
	return area;
}

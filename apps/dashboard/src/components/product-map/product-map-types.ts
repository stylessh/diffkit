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

export type AreaStats = {
	files: number;
	loc: number;
	testFiles: number;
	largestFile: { path: string; lines: number } | null;
	commits: number;
	commitsLast30: number;
	mergedPulls: number;
	mergedLast30: number;
	openPulls: number;
	openIssues: number;
	lastTouched: string | null;
	weekly: number[];
};

export type ProductArea = {
	id: string;
	name: string;
	icon: string;
	tagline: string;
	summary: string;
	how: string;
	flow: FlowStep[];
	features: AreaFeature[];
	entryPoints: CodeReference[];
	screen?: { path: string };
	dependsOn: string[];
	usedBy: string[];
	outside: string[];
	goodParts: string[];
	watch: string[];
	stats: AreaStats;
	hotFiles: { path: string; changes: number; lines: number | null }[];
	pulls: { merged: number[]; open: number[] };
	issues: { open: number[]; closed: number[] };
	people: { login: string; commits: number }[];
};

export type MapGroup = {
	id: string;
	name: string;
	areas: string[];
};

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
	outside?: string[];
};

export type PullReference = {
	number: number;
	title: string;
	state: string;
	author: string;
	date: string;
	additions: number;
	deletions: number;
	areas: string[];
};

export type IssueReference = {
	number: number;
	title: string;
	state: string;
	author: string;
	date: string;
	labels: string[];
	areas: string[];
	note?: string;
};

export type Person = {
	login: string;
	name: string;
	commits: number;
	firstCommit: string | null;
	bot: boolean;
};

export type ProductMap = {
	repo: {
		owner: string;
		name: string;
		pitch: string;
		description: string;
		url: string;
		defaultBranch: string;
		analysedAt: string;
		commit: string;
		firstCommit: string;
		weekStart: string;
		totals: {
			commits: number;
			mergedPulls: number;
			openPulls: number;
			openIssues: number;
			contributors: number;
			files: number;
			loc: number;
			unmappedFiles: number;
		};
	};
	bands: MapBand[];
	outside: OutsideSystem[];
	tour: TourStop[];
	areas: ProductArea[];
	people: Record<string, Person>;
	pulls: Record<string, PullReference>;
	issues: Record<string, IssueReference>;
};

export type MapLens = "structure" | "activity" | "size" | "open";

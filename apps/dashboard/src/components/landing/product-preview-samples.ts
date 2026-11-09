import type { ShellUser } from "#/components/shell/account-menu";
import type { ShellCounts } from "#/components/shell/workspace-nav";
import type {
	GitHubActor,
	GitHubLabel,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	NotificationItem,
	PullSummary,
	RepositoryRef,
} from "#/lib/github.types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

const ORG = "lumen-labs";
const ORG_AVATAR_URL = "/landing/lumen-labs.svg";

/** Lorelei by Lisa Wischofsky (CC0), rendered through DiceBear into public/landing. */
function person(login: string) {
	return {
		login,
		avatarUrl: `/landing/avatars/${login}.webp`,
		url: "",
		type: "User",
	} satisfies GitHubActor;
}

export const PREVIEW_PEOPLE = {
	nova: person("nova"),
	theo: person("theo-martin"),
	priya: person("priya-rao"),
	jun: person("jun-park"),
	lena: person("lena-fischer"),
	sam: person("sam-okafor"),
	mika: person("mika-tanaka"),
};

function repository(name: string) {
	return {
		name,
		owner: ORG,
		fullName: `${ORG}/${name}`,
		url: "",
		isPrivate: false,
		ownerAvatarUrl: ORG_AVATAR_URL,
	} satisfies RepositoryRef;
}

const REPOS = {
	beacon: repository("beacon"),
	orbit: repository("orbit"),
	handbook: repository("handbook"),
};

function label(name: string, color: string) {
	return { name, color, description: null } satisfies GitHubLabel;
}

const LABELS = {
	bug: label("bug", "d73a4a"),
	component: label("component", "5319e7"),
	docs: label("docs", "0075ca"),
	enhancement: label("enhancement", "a2eeef"),
	experimental: label("experimental", "c5def5"),
	performance: label("performance", "d93f0b"),
	process: label("process", "c2e0c6"),
	question: label("question", "d876e3"),
	reliability: label("reliability", "fbca04"),
	transport: label("transport", "1d76db"),
};

/**
 * `ageMs` sits half a unit past the label it should show ("2h" is 2.5 hours
 * old), so the server render and the hydrating client never fall on different
 * labels.
 */
type PreviewEntry = {
	number: number;
	title: string;
	repository: RepositoryRef;
	author: GitHubActor;
	labels: GitHubLabel[];
	comments: number;
	ageMs: number;
};

type PreviewPull = PreviewEntry & {
	additions: number;
	deletions: number;
	isDraft?: boolean;
};

const PULLS = {
	sseHeaders: {
		number: 15,
		title: "Support custom headers on the SSE transport",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.theo,
		labels: [LABELS.enhancement, LABELS.transport],
		comments: 4,
		additions: 44,
		deletions: 17,
		ageMs: 2.5 * HOUR_MS,
	},
	buttonLoading: {
		number: 7,
		title: "Add a loading state to Button",
		repository: REPOS.orbit,
		author: PREVIEW_PEOPLE.priya,
		labels: [LABELS.component],
		comments: 2,
		additions: 28,
		deletions: 2,
		ageMs: 5.5 * HOUR_MS,
	},
	webhookRetry: {
		number: 31,
		title: "Retry webhook deliveries with backoff",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.jun,
		labels: [LABELS.reliability],
		comments: 7,
		additions: 126,
		deletions: 38,
		ageMs: 1.5 * DAY_MS,
	},
	webTransport: {
		number: 20,
		title: "Stack 3/3: Experimental WebTransport transport",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.nova,
		labels: [LABELS.experimental, LABELS.transport],
		comments: 0,
		additions: 42,
		deletions: 0,
		isDraft: true,
		ageMs: 3.5 * HOUR_MS,
	},
	transportRegistry: {
		number: 19,
		title: "Stack 2/3: Add a transport registry",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.nova,
		labels: [LABELS.transport],
		comments: 1,
		additions: 18,
		deletions: 0,
		ageMs: 1.5 * DAY_MS,
	},
	transportInterface: {
		number: 16,
		title: "Stack 1/3: Extract a Transport interface",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.nova,
		labels: [LABELS.transport],
		comments: 3,
		additions: 13,
		deletions: 0,
		ageMs: 2.5 * DAY_MS,
	},
	onCall: {
		number: 3,
		title: "Document on-call escalation",
		repository: REPOS.handbook,
		author: PREVIEW_PEOPLE.lena,
		labels: [LABELS.docs, LABELS.process],
		comments: 1,
		additions: 16,
		deletions: 0,
		ageMs: 3.5 * DAY_MS,
	},
	tabScroll: {
		number: 12,
		title: "Keep scroll position when switching tabs",
		repository: REPOS.orbit,
		author: PREVIEW_PEOPLE.sam,
		labels: [LABELS.bug],
		comments: 5,
		additions: 61,
		deletions: 24,
		ageMs: 4.5 * DAY_MS,
	},
	channelCache: {
		number: 28,
		title: "Cache channel listings per connection",
		repository: REPOS.beacon,
		author: PREVIEW_PEOPLE.mika,
		labels: [LABELS.performance],
		comments: 9,
		additions: 203,
		deletions: 71,
		ageMs: 6.5 * DAY_MS,
	},
	themeTokens: {
		number: 9,
		title: "Move tokens into a shared theme package",
		repository: REPOS.orbit,
		author: PREVIEW_PEOPLE.priya,
		labels: [LABELS.component],
		comments: 2,
		additions: 310,
		deletions: 288,
		ageMs: 8.5 * DAY_MS,
	},
	incidentTemplate: {
		number: 5,
		title: "Tidy the incident review template",
		repository: REPOS.handbook,
		author: PREVIEW_PEOPLE.lena,
		labels: [LABELS.docs],
		comments: 0,
		additions: 22,
		deletions: 9,
		ageMs: 11.5 * DAY_MS,
	},
} satisfies Record<string, PreviewPull>;

const PULL_GROUPS = {
	reviewRequested: [PULLS.sseHeaders, PULLS.buttonLoading, PULLS.webhookRetry],
	assigned: [],
	authored: [
		PULLS.webTransport,
		PULLS.transportRegistry,
		PULLS.transportInterface,
	],
	mentioned: [PULLS.onCall, PULLS.tabScroll],
	involved: [PULLS.channelCache, PULLS.themeTokens, PULLS.incidentTemplate],
} satisfies Record<string, PreviewPull[]>;

const ISSUE_GROUPS = {
	assigned: [
		{
			number: 34,
			title: "Reconnect drops queued messages after a network change",
			repository: REPOS.beacon,
			author: PREVIEW_PEOPLE.mika,
			labels: [LABELS.bug, LABELS.transport],
			comments: 6,
			ageMs: 1.5 * HOUR_MS,
		},
		{
			number: 14,
			title: "Tooltip stays open after its trigger unmounts",
			repository: REPOS.orbit,
			author: PREVIEW_PEOPLE.sam,
			labels: [LABELS.bug],
			comments: 2,
			ageMs: 7.5 * HOUR_MS,
		},
		{
			number: 29,
			title: "Expose delivery latency in the debug overlay",
			repository: REPOS.beacon,
			author: PREVIEW_PEOPLE.jun,
			labels: [LABELS.enhancement],
			comments: 3,
			ageMs: 2.5 * DAY_MS,
		},
		{
			number: 6,
			title: "Write the release checklist",
			repository: REPOS.handbook,
			author: PREVIEW_PEOPLE.lena,
			labels: [LABELS.docs, LABELS.process],
			comments: 0,
			ageMs: 5.5 * DAY_MS,
		},
		{
			number: 11,
			title: "Menu items lose focus rings in high contrast mode",
			repository: REPOS.orbit,
			author: PREVIEW_PEOPLE.priya,
			labels: [LABELS.bug, LABELS.component],
			comments: 4,
			ageMs: 9.5 * DAY_MS,
		},
	],
	authored: [
		{
			number: 33,
			title: "Decide on a default heartbeat interval",
			repository: REPOS.beacon,
			author: PREVIEW_PEOPLE.nova,
			labels: [LABELS.question, LABELS.transport],
			comments: 8,
			ageMs: 1.5 * DAY_MS,
		},
		{
			number: 13,
			title: "Document the density scale",
			repository: REPOS.orbit,
			author: PREVIEW_PEOPLE.nova,
			labels: [LABELS.docs],
			comments: 1,
			ageMs: 6.5 * DAY_MS,
		},
	],
	mentioned: [
		{
			number: 27,
			title: "Presence counts drift on long-lived connections",
			repository: REPOS.beacon,
			author: PREVIEW_PEOPLE.theo,
			labels: [LABELS.bug, LABELS.reliability],
			comments: 5,
			ageMs: 3.5 * DAY_MS,
		},
	],
} satisfies Record<string, PreviewEntry[]>;

type PreviewNotification = {
	pull: PreviewPull;
	reason: NotificationItem["reason"];
	from: GitHubActor;
	unread: boolean;
	ageMs: number;
};

const NOTIFICATIONS: PreviewNotification[] = [
	{
		pull: PULLS.sseHeaders,
		reason: "review_requested",
		from: PREVIEW_PEOPLE.theo,
		unread: true,
		ageMs: 2.5 * HOUR_MS,
	},
	{
		pull: PULLS.transportRegistry,
		reason: "comment",
		from: PREVIEW_PEOPLE.jun,
		unread: true,
		ageMs: 4.5 * HOUR_MS,
	},
	{
		pull: PULLS.buttonLoading,
		reason: "review_requested",
		from: PREVIEW_PEOPLE.priya,
		unread: true,
		ageMs: 5.5 * HOUR_MS,
	},
	{
		pull: PULLS.onCall,
		reason: "mention",
		from: PREVIEW_PEOPLE.lena,
		unread: true,
		ageMs: 1.5 * DAY_MS,
	},
	{
		pull: PULLS.webhookRetry,
		reason: "review_requested",
		from: PREVIEW_PEOPLE.jun,
		unread: false,
		ageMs: 1.5 * DAY_MS,
	},
	{
		pull: PULLS.transportInterface,
		reason: "comment",
		from: PREVIEW_PEOPLE.theo,
		unread: false,
		ageMs: 2.5 * DAY_MS,
	},
	{
		pull: PULLS.tabScroll,
		reason: "mention",
		from: PREVIEW_PEOPLE.sam,
		unread: false,
		ageMs: 4.5 * DAY_MS,
	},
];

function toPullSummary(pull: PreviewPull, now: number): PullSummary {
	const { ageMs, isDraft = false, ...rest } = pull;
	const updatedAt = new Date(now - ageMs).toISOString();
	return {
		...rest,
		id: pull.number,
		state: "open",
		isDraft,
		createdAt: updatedAt,
		updatedAt,
		closedAt: null,
		mergedAt: null,
		url: "",
	};
}

function toIssueSummary(issue: PreviewEntry, now: number): IssueSummary {
	const { ageMs, ...rest } = issue;
	const updatedAt = new Date(now - ageMs).toISOString();
	return {
		...rest,
		id: issue.number,
		state: "open",
		stateReason: null,
		createdAt: updatedAt,
		updatedAt,
		closedAt: null,
		url: "",
	};
}

function toNotification(
	{ pull, reason, from, unread, ageMs }: PreviewNotification,
	index: number,
	now: number,
): NotificationItem {
	return {
		id: `preview-${index}`,
		unread,
		reason,
		subject: {
			title: pull.title,
			url: `https://api.github.com/repos/${pull.repository.fullName}/pulls/${pull.number}`,
			latestCommentUrl: null,
			type: "PullRequest",
		},
		repository: {
			id: index,
			name: pull.repository.name,
			fullName: pull.repository.fullName,
			owner: {
				login: ORG,
				avatarUrl: ORG_AVATAR_URL,
				url: "",
				type: "Organization",
			},
			private: false,
		},
		participants: [{ login: from.login, avatarUrl: from.avatarUrl }],
		subjectState: "open",
		updatedAt: new Date(now - ageMs).toISOString(),
		lastReadAt: null,
		url: "",
	};
}

export type PreviewWorkspace = {
	pulls: MyPullsResult;
	issues: MyIssuesResult;
	notifications: NotificationItem[];
};

export function previewWorkspace(now: number): PreviewWorkspace {
	const pulls = (group: PreviewPull[]) =>
		group.map((pull) => toPullSummary(pull, now));
	const issues = (group: PreviewEntry[]) =>
		group.map((issue) => toIssueSummary(issue, now));
	return {
		pulls: {
			reviewRequested: pulls(PULL_GROUPS.reviewRequested),
			assigned: pulls(PULL_GROUPS.assigned),
			authored: pulls(PULL_GROUPS.authored),
			mentioned: pulls(PULL_GROUPS.mentioned),
			involved: pulls(PULL_GROUPS.involved),
		},
		issues: {
			assigned: issues(ISSUE_GROUPS.assigned),
			authored: issues(ISSUE_GROUPS.authored),
			mentioned: issues(ISSUE_GROUPS.mentioned),
		},
		notifications: NOTIFICATIONS.map((notification, index) =>
			toNotification(notification, index, now),
		),
	};
}

export function allPreviewPulls(pulls: MyPullsResult) {
	return [
		...pulls.reviewRequested,
		...pulls.assigned,
		...pulls.authored,
		...pulls.mentioned,
		...pulls.involved,
	];
}

export const PREVIEW_VIEWER: ShellUser = {
	id: "preview",
	name: "Nova Reyes",
	email: "nova@lumen-labs.dev",
	image: PREVIEW_PEOPLE.nova.avatarUrl,
};

export const PREVIEW_VIEWER_LOGIN = PREVIEW_PEOPLE.nova.login;

export const PREVIEW_COUNTS: ShellCounts = {
	pulls: Object.values(PULL_GROUPS).flat().length,
	reviews: PULL_GROUPS.reviewRequested.length,
	issues: Object.values(ISSUE_GROUPS).flat().length,
};

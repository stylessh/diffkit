import type {
	GitHubActor,
	PullDetail,
	PullPageData,
	PullSummary,
} from "#/lib/github.types";
import { HOUR_MS, PREVIEW_PEOPLE } from "./product-preview-samples";

/**
 * Story text stays free of `@mentions` and `#references`: both render as
 * links that look themselves up for the signed-in viewer.
 */
type PullStory = {
	branch: string;
	base?: string;
	files: number;
	body: string;
	commits: string[];
	comments: [author: GitHubActor, body: string][];
};

const { nova, theo, priya, jun, lena, sam, mika } = PREVIEW_PEOPLE;

const STORIES: Record<number, PullStory> = {
	15: {
		branch: "feat/sse-headers",
		files: 2,
		body: "`EventSource` can't send headers, so this streams the event source over `fetch` and parses frames manually.\n\n- [x] Parses multi-line `data:` frames\n- [x] README updated\n- [ ] Abort handling",
		commits: [
			"Stream SSE over fetch so custom headers work",
			"Document SSE headers",
		],
		comments: [
			[
				theo,
				"Nova, could you take a look when you have a moment? We're blocked on this for the edge rollout.",
			],
		],
	},
	7: {
		branch: "button-loading",
		files: 3,
		body: "Adds a `loading` prop to `Button`. It swaps the icon for a spinner, keeps the label, and holds the button's width so toolbars don't jump.\n\nThe button stays focusable while loading and announces the state with `aria-busy`.",
		commits: ["Add loading state to Button", "Keep width while loading"],
		comments: [
			[
				sam,
				"Nice. Does the spinner respect reduced motion, or should it fall back to a static icon?",
			],
			[priya, "It falls back to the static icon. Added a story for it."],
		],
	},
	31: {
		branch: "webhook-backoff",
		files: 6,
		body: "Deliveries that fail with a 5xx or time out are now retried up to five times with exponential backoff and jitter.\n\nA delivery that exhausts its retries is parked, and shows up in the delivery log with the last response.",
		commits: [
			"Retry failed deliveries with backoff",
			"Park deliveries that exhaust their retries",
			"Cover the retry schedule in tests",
		],
		comments: [
			[
				mika,
				"Should a `429` count as retryable too? Some receivers rate limit bursts.",
			],
			[jun, "Good point. It does now, and it honours `Retry-After`."],
		],
	},
	20: {
		branch: "stack/webtransport",
		base: "stack/transport-registry",
		files: 2,
		body: "Third in the stack. Adds a WebTransport transport behind `experimental.webTransport`, registered through the new registry.\n\nStill a draft: datagram support and reconnects are missing.",
		commits: ["Add an experimental WebTransport transport"],
		comments: [],
	},
	19: {
		branch: "stack/transport-registry",
		base: "stack/transport-interface",
		files: 2,
		body: "Second in the stack. Transports register themselves by name, so the client picks one from configuration instead of a hard-coded switch.",
		commits: ["Add a transport registry"],
		comments: [
			[
				jun,
				"Could the registry reject duplicate names? A silent override would be painful to debug.",
			],
		],
	},
	16: {
		branch: "stack/transport-interface",
		files: 1,
		body: "First in the stack. Pulls the methods the client actually calls into a `Transport` interface, with no behaviour change, so the next two pull requests stay small.",
		commits: ["Extract a Transport interface"],
		comments: [
			[theo, "This reads much better. Approving once CI is green."],
			[nova, "Thanks, it's green now."],
		],
	},
	3: {
		branch: "docs/on-call-escalation",
		files: 1,
		body: "Writes down who to page, in which order, and when to escalate.\n\nNova, you're listed as the second escalation for `beacon`. Shout if that's wrong.",
		commits: ["Document on-call escalation"],
		comments: [[nova, "That's right. One typo fix suggested inline."]],
	},
	12: {
		branch: "fix/tab-scroll",
		files: 4,
		body: "Each tab panel now remembers its scroll offset and restores it when the tab is shown again.\n\nNova, this touches the roving focus you added, so a second pair of eyes would help.",
		commits: [
			"Remember scroll offset per tab panel",
			"Restore the offset after the panel mounts",
		],
		comments: [
			[
				priya,
				"Works for me with keyboard navigation and with the tabs in a dialog.",
			],
		],
	},
	28: {
		branch: "perf/channel-cache",
		files: 9,
		body: "Channel listings were fetched on every subscribe. They are now cached per connection and invalidated when a channel is created or removed.\n\nOn the benchmark this takes a cold subscribe from 41 ms to 6 ms.",
		commits: [
			"Cache channel listings per connection",
			"Invalidate the cache on channel changes",
			"Add a subscribe benchmark",
		],
		comments: [
			[theo, "What happens to the cache when the connection is resumed?"],
			[mika, "It's dropped and rebuilt. Added a test for that path."],
		],
	},
	9: {
		branch: "theme-package",
		files: 31,
		body: "Moves the colour, spacing and radius tokens out of `orbit` into `lumen-theme`, so `beacon`'s dashboard can share them.\n\nMostly file moves. The only behaviour change is that tokens are now read from CSS variables at runtime.",
		commits: ["Move tokens into lumen-theme", "Read tokens from CSS variables"],
		comments: [[lena, "The handbook site can drop its copy of these too."]],
	},
	5: {
		branch: "docs/incident-template",
		files: 1,
		body: "Shortens the incident review template: one timeline, one list of follow-ups, and no more duplicate summary sections.",
		commits: ["Tidy the incident review template"],
		comments: [],
	},
};

export function previewPullPage(
	pull: PullSummary,
	reviewRequested: boolean,
	now: number,
): { detail: PullDetail; page: PullPageData } {
	const story = STORIES[pull.number];
	const updatedAt = Date.parse(pull.updatedAt);
	const hoursBeforeUpdate = (hours: number) =>
		new Date(Math.min(updatedAt - hours * HOUR_MS, now)).toISOString();

	const detail: PullDetail = {
		...pull,
		createdAt: hoursBeforeUpdate(30),
		body: story.body,
		additions: pull.additions ?? 0,
		deletions: pull.deletions ?? 0,
		changedFiles: story.files,
		commits: story.commits.length,
		reviewComments: 0,
		headRefName: story.branch,
		headSha: "0000000",
		headRepoOwner: null,
		baseRefName: story.base ?? "main",
		isMerged: false,
		mergeCommitSha: null,
		mergedBy: null,
		mergeable: true,
		requestedReviewers: reviewRequested ? [nova] : [],
		requestedTeams: [],
	};

	return {
		detail,
		page: {
			detail,
			commits: story.commits.map((message, index) => ({
				sha: `${pull.number}c${index}`.padEnd(7, "0"),
				message,
				createdAt: hoursBeforeUpdate(28 - index * 6),
				author: pull.author,
			})),
			comments: story.comments.map(([author, body], index) => ({
				id: pull.number * 100 + index,
				body,
				createdAt: hoursBeforeUpdate(10 - index * 5),
				author,
			})),
			events: pull.labels.slice(0, 1).map((label, index) => ({
				id: pull.number * 100 + 50 + index,
				event: "labeled",
				createdAt: hoursBeforeUpdate(29),
				actor: pull.author,
				label: { name: label.name, color: label.color },
			})),
			commentPagination: {
				totalCount: story.comments.length,
				perPage: 30,
				loadedPages: [1],
			},
			eventPagination: { loadedPages: [1], hasMore: false },
			headRefDeleted: false,
		},
	};
}

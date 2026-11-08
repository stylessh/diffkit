import type { IssueComment, TimelineEvent } from "../github.types";
import { executeGitHubGraphQL } from "./client";
import { restEditedAt } from "./mappers";
import type { GitHubContext } from "./shared";

export function getLoadedCommentPages(totalComments: number) {
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	return totalPages === 1 ? [1] : [1, totalPages];
}

export const COMMENTS_PER_PAGE = 30;

export type CommentPageInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	page: number;
};

export async function getCommentsPageResult(
	context: GitHubContext,
	data: CommentPageInput,
): Promise<{
	comments: IssueComment[];
	total: number;
}> {
	const response = await context.octokit.rest.issues.listComments({
		owner: data.owner,
		repo: data.repo,
		issue_number: data.issueNumber,
		per_page: COMMENTS_PER_PAGE,
		page: data.page,
	});

	const linkHeader = response.headers.link ?? "";
	let total = response.data.length + (data.page - 1) * COMMENTS_PER_PAGE;
	const lastMatch = linkHeader.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
	if (lastMatch) {
		total = Number(lastMatch[1]) * COMMENTS_PER_PAGE;
	}

	return {
		comments: response.data.map((c) => {
			const nodeId =
				"node_id" in c &&
				typeof (c as { node_id?: unknown }).node_id === "string"
					? (c as { node_id: string }).node_id
					: undefined;
			return {
				id: c.id,
				...(nodeId ? { graphqlId: nodeId } : {}),
				body: c.body ?? "",
				createdAt: c.created_at,
				editedAt: restEditedAt(c),
				author: c.user
					? {
							login: c.user.login,
							avatarUrl: c.user.avatar_url,
							url: c.user.html_url,
							type: c.user.type ?? "User",
						}
					: null,
			};
		}),
		total,
	};
}

const TIMELINE_EVENT_TYPES = new Set([
	"labeled",
	"unlabeled",
	"assigned",
	"unassigned",
	"review_requested",
	"review_request_removed",
	"renamed",
	"closed",
	"reopened",
	"milestoned",
	"demilestoned",
	"cross-referenced",
	"referenced",
	"reviewed",
	"convert_to_draft",
	"ready_for_review",
	"head_ref_deleted",
	"head_ref_restored",
]);

function mapTimelineEvents(rawEvents: unknown[]): TimelineEvent[] {
	return rawEvents
		.filter((e) => {
			const event = (e as Record<string, unknown>).event as string | undefined;
			return event && TIMELINE_EVENT_TYPES.has(event);
		})
		.map((e) => {
			const raw = e as Record<string, unknown>;
			// "reviewed" events use `user` instead of `actor`
			const actor = (raw.actor ?? raw.user) as
				| Record<string, unknown>
				| null
				| undefined;
			const label = raw.label as Record<string, unknown> | null | undefined;
			const assignee = raw.assignee as
				| Record<string, unknown>
				| null
				| undefined;
			const reviewer = raw.requested_reviewer as
				| Record<string, unknown>
				| null
				| undefined;
			const team = raw.requested_team as
				| Record<string, unknown>
				| null
				| undefined;
			const rename = raw.rename as Record<string, unknown> | null | undefined;
			const milestone = raw.milestone as
				| Record<string, unknown>
				| null
				| undefined;
			const source = raw.source as Record<string, unknown> | null | undefined;
			const issueSnapshot = raw.issue as Record<string, unknown> | undefined;
			const eventType = raw.event as string;

			let mappedSource: TimelineEvent["source"] = null;
			if (source) {
				const issue = source.issue as Record<string, unknown> | undefined;
				if (issue) {
					const repo = issue.repository as Record<string, unknown> | undefined;
					mappedSource = {
						type: issue.pull_request ? "pull_request" : "issue",
						number: issue.number as number,
						title: (issue.title as string) ?? "",
						state: (issue.state as string) ?? "",
						url: (issue.html_url as string) ?? "",
						repository: (repo?.full_name as string) ?? null,
					};
				}
			}

			return {
				id: (raw.id as number) ?? 0,
				event: raw.event as string,
				createdAt:
					(raw.created_at as string) ?? (raw.submitted_at as string) ?? "",
				actor: actor
					? {
							login: (actor.login as string) ?? "",
							avatarUrl: (actor.avatar_url as string) ?? "",
							url: (actor.html_url as string) ?? "",
							type: (actor.type as string) ?? "User",
						}
					: null,
				label: label
					? {
							name: (label.name as string) ?? "",
							color: (label.color as string) ?? "",
						}
					: undefined,
				assignee: assignee
					? {
							login: (assignee.login as string) ?? "",
							avatarUrl: (assignee.avatar_url as string) ?? "",
							url: (assignee.html_url as string) ?? "",
							type: (assignee.type as string) ?? "User",
						}
					: undefined,
				requestedReviewer: reviewer
					? {
							login: (reviewer.login as string) ?? "",
							avatarUrl: (reviewer.avatar_url as string) ?? "",
							url: (reviewer.html_url as string) ?? "",
							type: (reviewer.type as string) ?? "User",
						}
					: undefined,
				requestedTeam: team
					? {
							name: (team.name as string) ?? "",
							slug: (team.slug as string) ?? "",
						}
					: undefined,
				rename: rename
					? {
							from: (rename.from as string) ?? "",
							to: (rename.to as string) ?? "",
						}
					: undefined,
				milestone: milestone
					? { title: (milestone.title as string) ?? "" }
					: undefined,
				source: mappedSource,
				reviewState:
					eventType === "reviewed"
						? ((raw.state as string) ?? undefined)
						: undefined,
				stateReason: (() => {
					const top =
						(raw.state_reason as string) ?? (raw.stateReason as string);
					if (top) {
						return top;
					}
					if (eventType === "closed" && issueSnapshot) {
						return (
							(issueSnapshot.state_reason as string) ??
							(issueSnapshot.stateReason as string) ??
							undefined
						);
					}
					return undefined;
				})(),
				body: (raw.body as string) ?? undefined,
			};
		});
}

export function deriveHeadRefDeleted(events: TimelineEvent[]): boolean {
	for (let i = events.length - 1; i >= 0; i--) {
		if (events[i].event === "head_ref_restored") return false;
		if (events[i].event === "head_ref_deleted") return true;
	}
	return false;
}

type GraphQLCrossRefResponse = {
	repository: {
		issueOrPullRequest: {
			timelineItems: {
				nodes: Array<{
					actor: { login: string; avatarUrl: string; url: string } | null;
					createdAt: string;
					source: {
						__typename: string;
						number: number;
						title: string;
						state: string;
						url: string;
						repository: { nameWithOwner: string };
					};
				}>;
			};
		} | null;
	};
};

async function getCrossReferencesViaGraphQL(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
): Promise<TimelineEvent[]> {
	try {
		const response = await executeGitHubGraphQL<GraphQLCrossRefResponse>(
			context,
			`github cross references ${data.owner}/${data.repo}#${data.issueNumber}`,
			`query ($owner: String!, $repo: String!, $number: Int!) {
				repository(owner: $owner, name: $repo) {
					issueOrPullRequest(number: $number) {
						... on Issue {
							timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
								nodes {
									... on CrossReferencedEvent {
										actor { login avatarUrl url }
										createdAt
										source {
											__typename
											... on Issue {
												number title state url
												repository { nameWithOwner }
											}
											... on PullRequest {
												number title state url
												repository { nameWithOwner }
											}
										}
									}
								}
							}
						}
						... on PullRequest {
							timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
								nodes {
									... on CrossReferencedEvent {
										actor { login avatarUrl url }
										createdAt
										source {
											__typename
											... on Issue {
												number title state url
												repository { nameWithOwner }
											}
											... on PullRequest {
												number title state url
												repository { nameWithOwner }
											}
										}
									}
								}
							}
						}
					}
				}
			}`,
			{
				owner: data.owner,
				repo: data.repo,
				number: data.issueNumber,
			},
		);

		const issueOrPR = response.repository.issueOrPullRequest;
		const nodes = issueOrPR?.timelineItems.nodes ?? [];

		return nodes
			.filter((node) => node.source)
			.map((node) => ({
				id: 0,
				event: "cross-referenced",
				createdAt: node.createdAt,
				actor: node.actor
					? {
							login: node.actor.login,
							avatarUrl: node.actor.avatarUrl,
							url: node.actor.url,
							type: "User",
						}
					: null,
				source: {
					type:
						node.source.__typename === "PullRequest"
							? ("pull_request" as const)
							: ("issue" as const),
					number: node.source.number,
					title: node.source.title,
					state: node.source.state.toLowerCase(),
					url: node.source.url,
					repository: node.source.repository.nameWithOwner,
				},
			}));
	} catch (error) {
		console.error(
			"[timeline:graphql] ERROR:",
			error instanceof Error ? error.message : error,
		);
		return [];
	}
}

const TIMELINE_EVENTS_PER_PAGE = 100;

type TimelineEventsResult = {
	events: TimelineEvent[];
	hasMore: boolean;
};

export async function getTimelineEventsResult(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
): Promise<TimelineEventsResult> {
	const [restResult, crossRefs] = await Promise.all([
		getRestTimelineEventsPage(context, data, 1),
		getCrossReferencesViaGraphQL(context, data),
	]);

	const restCrossRefKeys = new Set(
		restResult.events
			.filter((e) => e.event === "cross-referenced" && e.source)
			.map((e) => `${e.source?.repository ?? ""}#${e.source?.number}`),
	);

	const uniqueCrossRefs = crossRefs.filter(
		(e) =>
			!restCrossRefKeys.has(
				`${e.source?.repository ?? ""}#${e.source?.number}`,
			),
	);

	return {
		events: [...restResult.events, ...uniqueCrossRefs],
		hasMore: restResult.hasMore,
	};
}

export async function getRestTimelineEventsPage(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
	page: number,
): Promise<TimelineEventsResult> {
	try {
		const response = await context.octokit.request(
			"GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
			{
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				per_page: TIMELINE_EVENTS_PER_PAGE,
				page,
				headers: {
					accept: "application/vnd.github.v3+json",
				},
			},
		);

		const items = response.data as unknown[];

		return {
			events: mapTimelineEvents(items),
			hasMore: items.length >= TIMELINE_EVENTS_PER_PAGE,
		};
	} catch (error) {
		console.error(
			"[timeline:rest] ERROR:",
			error instanceof Error ? error.message : error,
		);
		return { events: [], hasMore: false };
	}
}

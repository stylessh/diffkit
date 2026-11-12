import { getGitHubStore } from "@emulators/github";
import { type OperationDefinitionNode, parse } from "graphql";
import { Octokit } from "octokit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workspace } from "../seed/content/index.ts";
import { seedTokenFor } from "../seed/identity.ts";
import { seedWorkspace } from "../seed/seed-workspace.ts";
import { createDiffkitEmulator, type DiffkitEmulator } from "../server.ts";
import { encodeNodeId } from "../shims/enrich.ts";
import {
	extractDocuments,
	renderDynamicDocument,
} from "./dashboard-documents.ts";

const ANCHOR = new Date("2026-11-02T17:00:00.000Z");
const documents = extractDocuments();

let emulator: DiffkitEmulator;
let octokit: Octokit;
const ids = {
	pullNumber: 0,
	draftPullNumber: 0,
	draftPullId: "",
	issueNumber: 0,
	threadId: "",
	commentId: "",
};

function searchQuery(type: "pr" | "issue", qualifier: string) {
	return `is:${type} is:open ${qualifier} archived:false`;
}

/** Inputs keyed by GraphQL variable name, as DiffKit would send them. */
function variablesFor(
	template: string,
	query: string,
	extra: Record<string, unknown>,
) {
	const operation = parse(query).definitions.find(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === "OperationDefinition",
	);
	const number = /\bissue\(number|issueOrPullRequest/u.test(template)
		? ids.issueNumber
		: ids.pullNumber;
	const values: Record<string, unknown> = {
		owner: "lumen-labs",
		name: "beacon",
		repo: "beacon",
		number,
		username: "nova",
		ref: "main",
		path: "src/client.ts",
		first: 20,
		after: null,
		cursor: null,
		refQuery: null,
		pullRequestId: ids.draftPullId,
		threadId: ids.threadId,
		subjectId: ids.commentId,
		id: ids.commentId,
		content: "HEART",
		classifier: "OUTDATED",
		reviewRequestedQuery: searchQuery("pr", "user-review-requested:nova"),
		assignedQuery: searchQuery(
			template.includes("PullSearchFields") ? "pr" : "issue",
			"assignee:nova",
		),
		authoredQuery: searchQuery(
			template.includes("PullSearchFields") ? "pr" : "issue",
			"author:nova",
		),
		mentionedQuery: searchQuery(
			template.includes("PullSearchFields") ? "pr" : "issue",
			"mentions:nova",
		),
		involvedQuery: searchQuery("pr", "involves:nova"),
		...extra,
	};
	const variables: Record<string, unknown> = {};
	for (const definition of operation?.variableDefinitions ?? []) {
		const key = definition.variable.name.value;
		if (!(key in values)) {
			throw new Error(`no test value for GraphQL variable $${key}`);
		}
		variables[key] = values[key];
	}
	return variables;
}

beforeAll(async () => {
	emulator = await createDiffkitEmulator({ port: 0, persistence: null });
	await seedWorkspace(emulator, workspace, { anchor: ANCHOR });
	octokit = new Octokit({
		auth: seedTokenFor("nova"),
		baseUrl: emulator.url,
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	const gh = getGitHubStore(emulator.store);
	const beacon = gh.repos.findOneBy("full_name", "lumen-labs/beacon");
	if (!beacon) throw new Error("beacon was not seeded");
	const pulls = gh.pullRequests.findBy("repo_id", beacon.id);
	const sseHeaders = pulls.find((pull) => pull.head_ref === "feat/sse-headers");
	const draft = pulls.find((pull) => pull.draft);
	const issue = gh.issues
		.findBy("repo_id", beacon.id)
		.find((row) => row.title === "SSE transport ignores custom headers");
	const thread = gh.comments
		.findBy("repo_id", beacon.id)
		.find(
			(comment) =>
				comment.pull_number === sseHeaders?.number &&
				comment.comment_type === "review" &&
				!comment.in_reply_to_id,
		);
	const comment = gh.comments
		.findBy("repo_id", beacon.id)
		.find(
			(row) =>
				row.comment_type === "issue" && row.issue_number === issue?.number,
		);
	if (!sseHeaders || !draft || !issue || !thread || !comment) {
		throw new Error("seed is missing fixtures the GraphQL tests rely on");
	}
	ids.pullNumber = sseHeaders.number;
	ids.draftPullNumber = draft.number;
	ids.draftPullId = draft.node_id;
	ids.issueNumber = issue.number;
	ids.threadId = encodeNodeId("PullRequestReviewThread", thread.id);
	ids.commentId = comment.node_id;
}, 60_000);

afterAll(async () => {
	await emulator?.close();
});

describe("DiffKit GraphQL documents", () => {
	it("finds every document in the dashboard GitHub modules", () => {
		// Bump this when DiffKit adds a query, and make sure it runs below.
		expect(documents.length).toBe(27);
	});

	it.each(
		documents.map(
			(document) =>
				[`${document.name} (line ${document.line})`, document] as const,
		),
	)("%s executes against the seeded emulator", async (_label, document) => {
		const rendered = document.dynamic
			? renderDynamicDocument(document, {
					pullNumbers: [ids.pullNumber, ids.draftPullNumber],
				})
			: { query: document.template, variables: {} };
		const variables = variablesFor(
			document.template,
			rendered.query,
			rendered.variables,
		);
		const data = await octokit.graphql<Record<string, unknown>>(
			rendered.query,
			variables,
		);
		expect(data).toBeTruthy();
		expect(Object.keys(data).length).toBeGreaterThan(0);
	});
});

describe("GraphQL behaviour DiffKit depends on", () => {
	it("blames every line of a file to the commit that last changed it", async () => {
		const { repository } = await octokit.graphql<{
			repository: {
				object: {
					blame: {
						ranges: Array<{
							startingLine: number;
							endingLine: number;
							commit: { messageHeadline: string };
						}>;
					};
				};
			};
		}>(
			`query { repository(owner: "lumen-labs", name: "beacon") { object(expression: "main") { ... on Commit { blame(path: "src/client.ts") { ranges { startingLine endingLine commit { messageHeadline } } } } } } }`,
		);
		const ranges = repository.object.blame.ranges;
		ranges.forEach((range, index) => {
			expect(range.startingLine).toBe(
				index === 0 ? 1 : (ranges[index - 1]?.endingLine ?? 0) + 1,
			);
		});
		const headlines = new Set(
			ranges.map((range) => range.commit.messageHeadline),
		);
		expect(headlines.size).toBeGreaterThan(1);
		expect(headlines).toContain("Expose connection status through onStatus");
	});

	it("returns NOT_FOUND typed errors for missing repositories", async () => {
		const response = await fetch(`${emulator.url}/graphql`, {
			method: "POST",
			headers: {
				Authorization: `token ${seedTokenFor("nova")}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: '{ repository(owner: "lumen-labs", name: "nope") { name } }',
			}),
		});
		const body = (await response.json()) as {
			data: unknown;
			errors: Array<{ type: string }>;
		};
		expect(body.errors[0].type).toBe("NOT_FOUND");
		expect(body.data).toEqual({ repository: null });
	});

	it("search finds PRs awaiting the viewer's review", async () => {
		const data = await octokit.graphql<{
			search: { issueCount: number; nodes: Array<{ title: string }> };
		}>(
			`query($q: String!) { search(type: ISSUE, first: 30, query: $q) { issueCount nodes { ... on PullRequest { title } } } }`,
			{ q: searchQuery("pr", "user-review-requested:nova") },
		);
		expect(data.search.nodes.map((node) => node.title)).toContain(
			"Support custom headers on the SSE transport",
		);
	});

	it("rejects unauthenticated requests", async () => {
		const response = await fetch(`${emulator.url}/graphql`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: "{ viewer { login } }" }),
		});
		expect(response.status).toBe(401);
	});
});

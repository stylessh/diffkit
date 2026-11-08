/**
 * Builds the demo workspace inside a running emulator.
 *
 * Content goes through emulate's own REST API (as the user who "did" it) so
 * its invariants hold; afterwards we pin timestamps and fill in what emulate
 * cannot create over REST (workflow runs, check runs, release assets,
 * reactions, stars, notifications, discussions).
 */
import { type GitHubStore, getGitHubStore } from "@emulators/github";
import { Octokit } from "octokit";
import { commitsBetween } from "../graphql/git";
import type { DiffkitEmulator } from "../server";
import { encodeNodeId } from "../shims/enrich";
import { upsertNotification } from "../shims/notifications";
import {
	type ExtrasStore,
	getExtrasStore,
	setTimestamps,
} from "../store-extras";
import { type Clock, createClock } from "./anchor";
import { DEMO_GITHUB_APP, seedTokenFor } from "./identity";
import type {
	CommentSpec,
	CommitSpec,
	FileChanges,
	IssueSpec,
	PullSpec,
	Reactions,
	RepoSpec,
	WorkflowRunSpec,
	WorkspaceSpec,
} from "./types";

type Api = Octokit;

type RepoState = {
	spec: RepoSpec;
	owner: string;
	fullName: string;
	repoId: number;
	tips: Map<string, string>;
	mainShas: string[];
	branchChanges: Map<string, FileChanges[]>;
	issueNumbers: Map<string, number>;
	pullNumbers: Map<string, number>;
};

type TimelineEvent =
	| {
			kind: "commit";
			at: string;
			branch: string;
			from?: string;
			spec: CommitSpec;
			mainIndex?: number;
	  }
	| { kind: "issue"; at: string; spec: IssueSpec }
	| { kind: "pull"; at: string; spec: PullSpec }
	| { kind: "merge"; at: string; spec: PullSpec };

const EVENT_ORDER = { commit: 0, issue: 1, pull: 2, merge: 3 } as const;

export type SeedLogger = (message: string) => void;

export async function seedWorkspace(
	emulator: DiffkitEmulator,
	workspace: WorkspaceSpec,
	options: { anchor: Date; log?: SeedLogger },
) {
	const log = options.log ?? (() => {});
	const clock = createClock(options.anchor);
	const gh = getGitHubStore(emulator.store);
	const extras = getExtrasStore(emulator.store);
	const started = Date.now();

	const clients = new Map<string, Api>();
	const api = (login: string): Api => {
		let client = clients.get(login);
		if (!client) {
			client = new Octokit({
				auth: seedTokenFor(login),
				baseUrl: emulator.url,
				retry: { enabled: false },
				throttle: { enabled: false },
				request: {
					fetch: (url: string, init: RequestInit) =>
						emulator.fetch(new Request(url, init)),
				},
			});
			clients.set(login, client);
		}
		return client;
	};
	const userId = (login: string) => {
		const user = gh.users.findOneBy("login", login);
		if (!user) throw new Error(`seed references unknown user ${login}`);
		return user.id;
	};

	// Seeding must not page the dashboard or fan out notifications.
	emulator.store.setData("diffkit.seeding", true);
	const app = gh.apps.all().find((row) => row.app_id === DEMO_GITHUB_APP.appId);
	const webhookUrl = app?.webhook_url ?? null;
	if (app) gh.apps.update(app.id, { webhook_url: null });

	try {
		seedPeople(gh, workspace, clock);
		await seedTeams(api, workspace);

		const states: RepoState[] = [];
		for (const spec of workspace.repos) {
			states.push(await createRepo(api, gh, spec, clock));
		}
		for (const state of states) {
			assignNumbers(state);
		}
		const resolveText = (state: RepoState, text: string) =>
			text.replace(
				/#\{(issue|pull):([^}@]+)(?:@([^}]+))?\}/gu,
				(_match, kind, key, repoName) => {
					const target = repoName
						? states.find(
								(candidate) =>
									candidate.spec.name === repoName &&
									candidate.owner === state.owner,
							)
						: state;
					const number = (
						kind === "issue" ? target?.issueNumbers : target?.pullNumbers
					)?.get(key);
					if (!number)
						throw new Error(
							`unresolved reference #{${kind}:${key}} in ${state.fullName}`,
						);
					return `#${number}`;
				},
			);

		for (const state of states) {
			await seedHistoryAndItems(api, gh, state, clock, resolveText, userId);
			log(
				`  ${state.fullName}: history, ${state.spec.pulls?.length ?? 0} PRs, ${state.spec.issues?.length ?? 0} issues`,
			);
		}
		for (const state of states) {
			await seedConversation(
				api,
				gh,
				extras,
				state,
				clock,
				resolveText,
				userId,
			);
			await seedTagsAndReleases(api, gh, state, clock, resolveText, userId);
			seedActions(gh, extras, state, clock, userId);
			seedStatuses(extras, state, clock, userId);
			seedDiscussions(gh, extras, state, clock, userId);
		}
		for (const state of states) {
			await finalizePulls(emulator, gh, state, clock);
			finalizeRepo(gh, state, clock);
		}
		await seedForks(api, gh, workspace, clock);
		seedStarsAndPins(gh, extras, workspace, clock, userId);
		seedNotifications(emulator, workspace, states, clock, userId);
	} finally {
		emulator.store.setData("diffkit.seeding", false);
		if (app) gh.apps.update(app.id, { webhook_url: webhookUrl });
	}
	log(`  seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

function seedPeople(gh: GitHubStore, workspace: WorkspaceSpec, clock: Clock) {
	workspace.people.forEach((person, index) => {
		const user = gh.users.findOneBy("login", person.login);
		if (!user) return;
		gh.users.update(user.id, {
			followers: person.followers ?? 0,
			following: person.following ?? 0,
		});
		setTimestamps(
			gh.users.get(user.id),
			clock({ d: 900 - index * 60 }),
			clock({ d: 1 }),
		);
	});
	const org = gh.orgs.findOneBy("login", workspace.org.login);
	if (org) {
		// Base permission "write": every member can push, like most small teams.
		gh.orgs.update(org.id, { default_repository_permission: "write" });
		setTimestamps(gh.orgs.get(org.id), clock({ d: 820 }), clock({ d: 3 }));
	}
}

async function seedTeams(
	api: (login: string) => Api,
	workspace: WorkspaceSpec,
) {
	const admin =
		workspace.org.members.find((member) => member.role === "admin")?.login ??
		"admin";
	for (const team of workspace.org.teams) {
		await api(admin).request("POST /orgs/{org}/teams", {
			org: workspace.org.login,
			name: team.name,
			description: team.description,
			privacy: "closed",
		});
		for (const member of team.members) {
			await api(admin).request(
				"PUT /orgs/{org}/teams/{team_slug}/memberships/{username}",
				{
					org: workspace.org.login,
					team_slug: team.slug,
					username: member,
					role: "member",
				},
			);
		}
	}
}

function ownerAdmin(spec: RepoSpec, gh: GitHubStore) {
	if (gh.users.findOneBy("login", spec.owner)) return spec.owner;
	return "nova";
}

async function createRepo(
	api: (login: string) => Api,
	gh: GitHubStore,
	spec: RepoSpec,
	clock: Clock,
): Promise<RepoState> {
	const admin = ownerAdmin(spec, gh);
	const isUser = Boolean(gh.users.findOneBy("login", spec.owner));
	const body = {
		name: spec.name,
		description: spec.description,
		private: spec.private ?? false,
		homepage: spec.homepage,
		has_discussions: spec.hasDiscussions ?? false,
		auto_init: false,
	};
	const created = isUser
		? await api(admin).request("POST /user/repos", body)
		: await api(admin).request("POST /orgs/{org}/repos", {
				org: spec.owner,
				...body,
			});
	const repoId = created.data.id as number;
	gh.repos.update(repoId, {
		language: spec.language,
		languages: spec.languages ?? { [spec.language]: 10_000 },
		topics: spec.topics ?? [],
		license: spec.license ?? null,
		stargazers_count: spec.stars,
		forks_count: spec.forks,
		watchers_count: spec.watchers,
		has_discussions: spec.hasDiscussions ?? false,
		homepage: spec.homepage ?? null,
	});
	setTimestamps(gh.repos.get(repoId), clock(spec.commits[0]?.at ?? { d: 90 }));

	for (const collaborator of spec.collaborators ?? []) {
		await api(admin).request(
			"PUT /repos/{owner}/{repo}/collaborators/{username}",
			{
				owner: spec.owner,
				repo: spec.name,
				username: collaborator.login,
				permission: collaborator.permission,
			},
		);
	}
	for (const label of spec.labels ?? []) {
		await api(admin).request("POST /repos/{owner}/{repo}/labels", {
			owner: spec.owner,
			repo: spec.name,
			name: label.name,
			color: label.color,
			description: label.description,
		});
	}
	for (const milestone of spec.milestones ?? []) {
		await api(admin).request("POST /repos/{owner}/{repo}/milestones", {
			owner: spec.owner,
			repo: spec.name,
			title: milestone.title,
			description: milestone.description,
			state: milestone.state ?? "open",
			due_on: milestone.dueIn
				? new Date(
						Date.parse(clock({ d: 0 })) + milestone.dueIn * 86_400_000,
					).toISOString()
				: undefined,
		});
	}

	return {
		spec,
		owner: spec.owner,
		fullName: `${spec.owner}/${spec.name}`,
		repoId,
		tips: new Map(),
		mainShas: [],
		branchChanges: new Map(),
		issueNumbers: new Map(),
		pullNumbers: new Map(),
	};
}

function timeline(state: RepoState, clock: Clock): TimelineEvent[] {
	const { spec } = state;
	const events: TimelineEvent[] = [];
	spec.commits.forEach((commit, index) => {
		events.push({
			kind: "commit",
			at: clock(commit.at),
			branch: "main",
			spec: commit,
			mainIndex: index,
		});
	});
	for (const branch of spec.branches ?? []) {
		for (const commit of branch.commits) {
			events.push({
				kind: "commit",
				at: clock(commit.at),
				branch: branch.name,
				from: branch.from,
				spec: commit,
			});
		}
	}
	for (const issue of spec.issues ?? []) {
		events.push({ kind: "issue", at: clock(issue.at), spec: issue });
	}
	for (const pull of spec.pulls ?? []) {
		events.push({ kind: "pull", at: clock(pull.at), spec: pull });
		if (pull.state === "merged") {
			if (!pull.closedAt)
				throw new Error(`merged PR ${pull.head} needs closedAt`);
			events.push({ kind: "merge", at: clock(pull.closedAt), spec: pull });
		}
	}
	return events.sort(
		(a, b) =>
			a.at.localeCompare(b.at) || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind],
	);
}

/** Issue and PR numbers are shared and chronological, like on GitHub. */
function assignNumbers(state: RepoState) {
	const clock = createClock(new Date(0));
	let next = 1;
	for (const event of timeline(state, clock)) {
		if (event.kind === "issue") state.issueNumbers.set(event.spec.key, next++);
		if (event.kind === "pull") state.pullNumbers.set(event.spec.head, next++);
	}
}

function authorIdentity(gh: GitHubStore, login: string) {
	const user = gh.users.findOneBy("login", login);
	return {
		name: user?.name ?? login,
		email: user?.email ?? `${login}@users.noreply.github.com`,
	};
}

async function writeCommit(
	api: (login: string) => Api,
	gh: GitHubStore,
	state: RepoState,
	input: {
		author: string;
		message: string;
		date: string;
		parents: string[];
		baseTree?: string;
		changes: FileChanges;
	},
) {
	const client = api(input.author);
	const repoParams = { owner: state.owner, repo: state.spec.name };
	const tree = await client.request("POST /repos/{owner}/{repo}/git/trees", {
		...repoParams,
		...(input.baseTree ? { base_tree: input.baseTree } : {}),
		tree: Object.entries(input.changes).map(([path, content]) =>
			content === null
				? { path, mode: "100644" as const, type: "blob" as const, sha: null }
				: { path, mode: "100644" as const, type: "blob" as const, content },
		),
	});
	const identity = { ...authorIdentity(gh, input.author), date: input.date };
	const commit = await client.request(
		"POST /repos/{owner}/{repo}/git/commits",
		{
			...repoParams,
			message: input.message,
			tree: tree.data.sha,
			parents: input.parents,
			author: identity,
			committer: identity,
		},
	);
	const row = gh.commits
		.findBy("repo_id", state.repoId)
		.find((candidate) => candidate.sha === commit.data.sha);
	setTimestamps(row, input.date);
	return { sha: commit.data.sha as string, tree: tree.data.sha as string };
}

async function moveBranch(
	api: (login: string) => Api,
	state: RepoState,
	login: string,
	branch: string,
	sha: string,
) {
	const params = { owner: state.owner, repo: state.spec.name };
	if (state.tips.has(branch)) {
		await api(login).request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
			...params,
			ref: `heads/${branch}`,
			sha,
			force: true,
		});
	} else {
		await api(login).request("POST /repos/{owner}/{repo}/git/refs", {
			...params,
			ref: `refs/heads/${branch}`,
			sha,
		});
	}
	state.tips.set(branch, sha);
}

function treeOf(gh: GitHubStore, state: RepoState, sha: string | undefined) {
	if (!sha) return undefined;
	return gh.commits
		.findBy("repo_id", state.repoId)
		.find((commit) => commit.sha === sha)?.tree_sha;
}

async function seedHistoryAndItems(
	api: (login: string) => Api,
	gh: GitHubStore,
	state: RepoState,
	clock: Clock,
	resolveText: (state: RepoState, text: string) => string,
	userId: (login: string) => number,
) {
	const { spec } = state;
	const params = { owner: state.owner, repo: spec.name };
	const admin = ownerAdmin(spec, gh);

	for (const event of timeline(state, clock)) {
		if (event.kind === "commit") {
			const parentSha =
				state.tips.get(event.branch) ?? state.tips.get(event.from ?? "main");
			const { sha } = await writeCommit(api, gh, state, {
				author: event.spec.author,
				message: event.spec.message,
				date: event.at,
				parents: parentSha ? [parentSha] : [],
				baseTree: treeOf(gh, state, parentSha),
				changes: event.spec.files,
			});
			await moveBranch(api, state, event.spec.author, event.branch, sha);
			if (event.mainIndex !== undefined) state.mainShas[event.mainIndex] = sha;
			if (event.branch !== "main") {
				const changes = state.branchChanges.get(event.branch) ?? [];
				changes.push(event.spec.files);
				state.branchChanges.set(event.branch, changes);
			}
			continue;
		}

		if (event.kind === "issue") {
			const issue = event.spec;
			const created = await api(issue.author).request(
				"POST /repos/{owner}/{repo}/issues",
				{
					...params,
					title: issue.title,
					body: resolveText(state, issue.body),
				},
			);
			const number = created.data.number;
			if (number !== state.issueNumbers.get(issue.key)) {
				throw new Error(
					`issue numbering drifted for ${state.fullName} ${issue.key}`,
				);
			}
			await applyIssueMeta(api, gh, state, admin, number, issue);
			pinIssue(gh, state, number, event.at);
			continue;
		}

		if (event.kind === "pull") {
			const pull = event.spec;
			const base = pull.base ?? "main";
			const created = await api(pull.author).request(
				"POST /repos/{owner}/{repo}/pulls",
				{
					...params,
					title: pull.title,
					head: pull.head,
					base,
					body: resolveText(state, pull.body),
					draft: pull.draft ?? false,
				},
			);
			const number = created.data.number;
			if (number !== state.pullNumbers.get(pull.head)) {
				throw new Error(
					`PR numbering drifted for ${state.fullName} ${pull.head}`,
				);
			}
			if (pull.reviewers?.length) {
				await api(pull.author).request(
					"POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
					{ ...params, pull_number: number, reviewers: pull.reviewers },
				);
			}
			await applyIssueMeta(api, gh, state, admin, number, pull);
			pinIssue(gh, state, number, event.at);
			continue;
		}

		// merge
		const pull = event.spec;
		const number = state.pullNumbers.get(pull.head) as number;
		const base = pull.base ?? "main";
		const baseSha = state.tips.get(base) as string;
		const headSha = state.tips.get(pull.head) as string;
		const merged: FileChanges = Object.assign(
			{},
			...(state.branchChanges.get(pull.head) ?? []),
		);
		const mergedBy = pull.mergedBy ?? "nova";
		const { sha } = await writeCommit(api, gh, state, {
			author: mergedBy,
			message: `Merge pull request #${number} from ${state.owner}/${pull.head}\n\n${pull.title}`,
			date: event.at,
			parents: [baseSha, headSha],
			baseTree: treeOf(gh, state, baseSha),
			changes: merged,
		});
		await moveBranch(api, state, mergedBy, base, sha);
		const pr = gh.pullRequests
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);
		const issueRow = gh.issues
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);
		if (pr) {
			gh.pullRequests.update(pr.id, {
				state: "closed",
				merged: true,
				merged_at: event.at,
				merged_by_id: userId(mergedBy),
				merge_commit_sha: sha,
				closed_at: event.at,
				mergeable: null,
				mergeable_state: "unknown",
			});
		}
		if (issueRow) {
			gh.issues.update(issueRow.id, {
				state: "closed",
				state_reason: "completed",
				closed_at: event.at,
				closed_by_id: userId(mergedBy),
			});
		}
		insertIssueEvent(
			gh,
			state,
			number,
			"merged",
			userId(mergedBy),
			event.at,
			sha,
		);
		insertIssueEvent(
			gh,
			state,
			number,
			"closed",
			userId(mergedBy),
			event.at,
			null,
		);
	}
}

function insertIssueEvent(
	gh: GitHubStore,
	state: RepoState,
	number: number,
	event: string,
	actorId: number,
	at: string,
	commitId: string | null,
) {
	const row = gh.issueEvents.insert({
		node_id: "",
		repo_id: state.repoId,
		issue_number: number,
		event,
		actor_id: actorId,
		commit_id: commitId,
		commit_url: null,
		label_name: null,
		assignee_id: null,
		milestone_title: null,
		rename: null,
	});
	gh.issueEvents.update(row.id, {
		node_id: encodeNodeId("IssueEvent", row.id),
	});
	setTimestamps(gh.issueEvents.get(row.id), at);
}

async function applyIssueMeta(
	api: (login: string) => Api,
	gh: GitHubStore,
	state: RepoState,
	admin: string,
	number: number,
	item: IssueSpec | PullSpec,
) {
	const params = {
		owner: state.owner,
		repo: state.spec.name,
		issue_number: number,
	};
	if (item.labels?.length) {
		await api(admin).request(
			"POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
			{
				...params,
				labels: item.labels,
			},
		);
	}
	const issueRow = gh.issues
		.findBy("repo_id", state.repoId)
		.find((row) => row.number === number);
	const pullRow = gh.pullRequests
		.findBy("repo_id", state.repoId)
		.find((row) => row.number === number);
	if (item.assignees?.length && issueRow) {
		const ids = item.assignees
			.map((login) => gh.users.findOneBy("login", login)?.id)
			.filter((id): id is number => typeof id === "number");
		gh.issues.update(issueRow.id, { assignee_ids: ids });
		if (pullRow) gh.pullRequests.update(pullRow.id, { assignee_ids: ids });
	}
	if (item.milestone && issueRow) {
		const milestone = gh.milestones
			.findBy("repo_id", state.repoId)
			.find((row) => row.title === item.milestone);
		if (milestone) {
			gh.issues.update(issueRow.id, { milestone_id: milestone.id });
			if (pullRow)
				gh.pullRequests.update(pullRow.id, { milestone_id: milestone.id });
		}
	}
}

function pinIssue(
	gh: GitHubStore,
	state: RepoState,
	number: number,
	at: string,
) {
	const issueRow = gh.issues
		.findBy("repo_id", state.repoId)
		.find((row) => row.number === number);
	setTimestamps(issueRow, at);
	const pullRow = gh.pullRequests
		.findBy("repo_id", state.repoId)
		.find((row) => row.number === number);
	setTimestamps(pullRow, at);
	for (const event of gh.issueEvents.findBy("repo_id", state.repoId)) {
		if (event.issue_number === number)
			setTimestamps(gh.issueEvents.get(event.id), at);
	}
}

function seedReactions(
	extras: ExtrasStore,
	subject: {
		subject_type: "issue" | "issue_comment" | "review_comment";
		subject_id: number;
	},
	reactions: Reactions | undefined,
	at: string,
	userId: (login: string) => number,
) {
	for (const [content, logins] of Object.entries(reactions ?? {})) {
		for (const login of logins ?? []) {
			const row = extras.reactions.insert({
				...subject,
				user_id: userId(login),
				content,
			});
			setTimestamps(extras.reactions.get(row.id), at);
		}
	}
}

/** Comments, reviews, review threads and state changes, oldest first. */
async function seedConversation(
	api: (login: string) => Api,
	gh: GitHubStore,
	extras: ExtrasStore,
	state: RepoState,
	clock: Clock,
	resolveText: (state: RepoState, text: string) => string,
	userId: (login: string) => number,
) {
	const params = { owner: state.owner, repo: state.spec.name };
	type Step = { at: string; run: () => Promise<void> };
	const steps: Step[] = [];
	const issueRowFor = (number: number) =>
		gh.issues
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);

	const addComments = (number: number, comments: CommentSpec[] | undefined) => {
		for (const comment of comments ?? []) {
			steps.push({
				at: clock(comment.at),
				run: async () => {
					const created = await api(comment.author).request(
						"POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
						{
							...params,
							issue_number: number,
							body: resolveText(state, comment.body),
						},
					);
					const at = clock(comment.at);
					setTimestamps(gh.comments.get(created.data.id), at);
					seedReactions(
						extras,
						{ subject_type: "issue_comment", subject_id: created.data.id },
						comment.reactions,
						at,
						userId,
					);
				},
			});
		}
	};

	for (const issue of state.spec.issues ?? []) {
		const number = state.issueNumbers.get(issue.key) as number;
		addComments(number, issue.comments);
		const row = issueRowFor(number);
		if (row)
			seedReactions(
				extras,
				{ subject_type: "issue", subject_id: row.id },
				issue.reactions,
				clock(issue.at),
				userId,
			);
		if (issue.state === "closed") {
			const closedAt = clock(issue.closedAt ?? issue.at);
			steps.push({
				at: closedAt,
				run: async () => {
					await api(ownerAdmin(state.spec, gh)).request(
						"PATCH /repos/{owner}/{repo}/issues/{issue_number}",
						{
							...params,
							issue_number: number,
							state: "closed",
							state_reason: issue.stateReason ?? "completed",
						},
					);
					const updated = issueRowFor(number);
					if (updated) {
						gh.issues.update(updated.id, { closed_at: closedAt });
						setTimestamps(gh.issues.get(updated.id), clock(issue.at), closedAt);
					}
					for (const event of gh.issueEvents.findBy("repo_id", state.repoId)) {
						if (event.issue_number === number && event.event === "closed") {
							setTimestamps(gh.issueEvents.get(event.id), closedAt);
						}
					}
				},
			});
		}
	}

	for (const pull of state.spec.pulls ?? []) {
		const number = state.pullNumbers.get(pull.head) as number;
		addComments(number, pull.comments);
		const row = issueRowFor(number);
		if (row)
			seedReactions(
				extras,
				{ subject_type: "issue", subject_id: row.id },
				pull.reactions,
				clock(pull.at),
				userId,
			);
		if (pull.state === "closed") {
			const closedAt = clock(pull.closedAt ?? pull.at);
			steps.push({
				at: closedAt,
				run: async () => {
					await api(pull.author).request(
						"PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
						{
							...params,
							pull_number: number,
							state: "closed",
						},
					);
					const pr = gh.pullRequests
						.findBy("repo_id", state.repoId)
						.find((r) => r.number === number);
					if (pr) gh.pullRequests.update(pr.id, { closed_at: closedAt });
					const issueRow = issueRowFor(number);
					if (issueRow)
						gh.issues.update(issueRow.id, {
							state: "closed",
							closed_at: closedAt,
						});
				},
			});
		}
		for (const review of pull.reviews ?? []) {
			const at = clock(review.at);
			steps.push({
				at,
				run: async () => {
					const created = await api(review.author).request(
						"POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
						{
							...params,
							pull_number: number,
							...(review.state === "PENDING"
								? {}
								: {
										event:
											review.state === "APPROVED"
												? ("APPROVE" as const)
												: review.state === "CHANGES_REQUESTED"
													? ("REQUEST_CHANGES" as const)
													: ("COMMENT" as const),
									}),
							body: review.body ? resolveText(state, review.body) : undefined,
							comments: (review.threads ?? []).map((thread) => ({
								path: thread.path,
								line: thread.line,
								side: thread.side ?? "RIGHT",
								...(thread.startLine
									? {
											start_line: thread.startLine,
											start_side: thread.side ?? "RIGHT",
										}
									: {}),
								body: resolveText(state, thread.body),
							})),
						},
					);
					const reviewId = created.data.id as number;
					const reviewRow = gh.reviews.get(reviewId);
					if (reviewRow) {
						setTimestamps(reviewRow, at);
						if (reviewRow.submitted_at) reviewRow.submitted_at = at;
					}
					const roots = gh.comments
						.findBy("repo_id", state.repoId)
						.filter((comment) => comment.review_id === reviewId)
						.sort((a, b) => a.id - b.id);
					for (const [index, root] of roots.entries()) {
						setTimestamps(gh.comments.get(root.id), at);
						const thread = review.threads?.[index];
						if (thread?.resolved) {
							extras.threadStates.insert({
								root_comment_id: root.id,
								resolved: true,
								resolved_by_id: userId(pull.author),
							});
						}
						for (const reply of thread?.replies ?? []) {
							const replyAt = clock(reply.at);
							const createdReply = await api(reply.author).request(
								"POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies",
								{
									...params,
									pull_number: number,
									comment_id: root.id,
									body: resolveText(state, reply.body),
								},
							);
							setTimestamps(gh.comments.get(createdReply.data.id), replyAt);
						}
					}
				},
			});
		}
	}

	steps.sort((a, b) => a.at.localeCompare(b.at));
	for (const step of steps) {
		await step.run();
	}
}

async function seedTagsAndReleases(
	api: (login: string) => Api,
	gh: GitHubStore,
	state: RepoState,
	clock: Clock,
	resolveText: (state: RepoState, text: string) => string,
	userId: (login: string) => number,
) {
	const params = { owner: state.owner, repo: state.spec.name };
	const admin = ownerAdmin(state.spec, gh);
	for (const tag of state.spec.tags ?? []) {
		const sha = state.mainShas[tag.commit];
		if (!sha)
			throw new Error(`tag ${tag.name} points at missing commit ${tag.commit}`);
		let refSha = sha;
		if (tag.annotated) {
			const tagger = {
				...authorIdentity(gh, tag.annotated.tagger),
				date: clock(tag.annotated.at),
			};
			const created = await api(tag.annotated.tagger).request(
				"POST /repos/{owner}/{repo}/git/tags",
				{
					...params,
					tag: tag.name,
					message: tag.annotated.message,
					object: sha,
					type: "commit",
					tagger,
				},
			);
			refSha = created.data.sha;
			const row = gh.tags
				.findBy("repo_id", state.repoId)
				.find((candidate) => candidate.sha === refSha);
			setTimestamps(row, tagger.date);
		}
		await api(admin).request("POST /repos/{owner}/{repo}/git/refs", {
			...params,
			ref: `refs/tags/${tag.name}`,
			sha: refSha,
		});
	}

	for (const release of state.spec.releases ?? []) {
		const at = clock(release.at);
		const created = await api(release.author).request(
			"POST /repos/{owner}/{repo}/releases",
			{
				...params,
				tag_name: release.tag,
				name: release.name,
				body: resolveText(state, release.body),
				draft: release.draft ?? false,
				prerelease: release.prerelease ?? false,
				target_commitish: "main",
			},
		);
		const row = gh.releases.get(created.data.id);
		if (row) {
			setTimestamps(row, at);
			row.published_at = release.draft ? null : at;
		}
		for (const asset of release.assets ?? []) {
			const inserted = gh.releaseAssets.insert({
				node_id: "",
				release_id: created.data.id,
				repo_id: state.repoId,
				name: asset.name,
				label: null,
				state: "uploaded",
				content_type: asset.contentType,
				size: asset.size,
				download_count: asset.downloads,
				uploader_id: userId(release.author),
			});
			gh.releaseAssets.update(inserted.id, {
				node_id: encodeNodeId("ReleaseAsset", inserted.id),
			});
			setTimestamps(gh.releaseAssets.get(inserted.id), at);
		}
	}
}

function runHead(state: RepoState, run: WorkflowRunSpec) {
	const match = run.branch.match(/^(.+)@(\d+)$/u);
	if (match) {
		return {
			branch: match[1],
			sha: state.mainShas[Number(match[2])] as string,
		};
	}
	return { branch: run.branch, sha: state.tips.get(run.branch) as string };
}

function seedActions(
	gh: GitHubStore,
	extras: ExtrasStore,
	state: RepoState,
	clock: Clock,
	userId: (login: string) => number,
) {
	const workflowIds = new Map<string, number>();
	for (const workflow of state.spec.workflows ?? []) {
		const row = gh.workflows.insert({
			node_id: "",
			repo_id: state.repoId,
			name: workflow.name,
			path: workflow.path,
			state: "active",
			badge_url: "",
		});
		gh.workflows.update(row.id, { node_id: encodeNodeId("Workflow", row.id) });
		setTimestamps(gh.workflows.get(row.id), clock(state.spec.commits[0].at));
		workflowIds.set(workflow.name, row.id);
	}

	const runNumbers = new Map<number, number>();
	const runsByKey = new Map<string, number>();
	const runStarts = new Map<number, string>();
	const sorted = [...(state.spec.runs ?? [])].sort((a, b) =>
		clock(a.at).localeCompare(clock(b.at)),
	);
	for (const spec of sorted) {
		const workflowId = workflowIds.get(spec.workflow);
		if (!workflowId)
			throw new Error(`run references unknown workflow ${spec.workflow}`);
		const head = runHead(state, spec);
		if (!head.sha) throw new Error(`run on ${spec.branch} has no commit`);
		const startedAt = clock(spec.at);
		const status = spec.status ?? "completed";
		const failed = spec.jobs.some((job) => job.conclusion === "failure");
		const conclusion =
			status === "completed"
				? (spec.conclusion ?? (failed ? "failure" : "success"))
				: null;
		const runKey = `${workflowId}:${head.branch}:${head.sha}`;

		let runId =
			spec.attempt && spec.attempt > 1 ? runsByKey.get(runKey) : undefined;
		if (runId) {
			gh.workflowRuns.update(runId, {
				run_attempt: spec.attempt,
				status,
				conclusion,
				run_started_at: startedAt,
			});
			for (const job of gh.jobs.findBy("run_id", runId)) gh.jobs.delete(job.id);
		} else {
			const runNumber = (runNumbers.get(workflowId) ?? 0) + 1;
			runNumbers.set(workflowId, runNumber);
			const row = gh.workflowRuns.insert({
				node_id: "",
				repo_id: state.repoId,
				workflow_id: workflowId,
				name: spec.workflow,
				head_branch: head.branch,
				head_sha: head.sha,
				run_number: runNumber,
				event: spec.event,
				status,
				conclusion,
				actor_id: userId(spec.actor),
				run_attempt: spec.attempt ?? 1,
				run_started_at: startedAt,
			});
			gh.workflowRuns.update(row.id, {
				node_id: encodeNodeId("WorkflowRun", row.id),
			});
			runId = row.id;
			runsByKey.set(runKey, runId);
		}

		const suite = gh.checkSuites.insert({
			node_id: "",
			repo_id: state.repoId,
			head_branch: head.branch,
			head_sha: head.sha,
			status,
			conclusion,
			before: "",
			after: head.sha,
			app_id: DEMO_GITHUB_APP.appId,
		});
		gh.checkSuites.update(suite.id, {
			node_id: encodeNodeId("CheckSuite", suite.id),
		});
		setTimestamps(gh.checkSuites.get(suite.id), startedAt);

		let cursor = Date.parse(startedAt) + 4_000;
		let runEnd = cursor;
		for (const job of spec.jobs) {
			const jobStart = cursor;
			let stepCursor = jobStart;
			const stepLogs: Record<string, string[]> = {};
			const jobDone = status === "completed" || job.conclusion !== null;
			const steps = job.steps.map((step, index) => {
				const stepStart = stepCursor;
				const stepEnd = stepStart + (step.seconds ?? 2) * 1000;
				stepCursor = stepEnd;
				const lines = step.log ?? [];
				stepLogs[String(index + 1)] = lines.map(
					(line, lineIndex) =>
						`${new Date(stepStart + Math.round(((stepEnd - stepStart) * lineIndex) / Math.max(1, lines.length))).toISOString().replace("Z", "0000Z")} ${line}`,
				);
				const stepConclusion =
					step.conclusion ??
					(job.conclusion === "skipped"
						? "skipped"
						: jobDone
							? (job.conclusion ?? "success")
							: null);
				const stepFinished = jobDone || stepConclusion !== null;
				return {
					name: step.name,
					status: stepFinished
						? "completed"
						: index === 0
							? "in_progress"
							: "queued",
					conclusion: stepFinished
						? stepConclusion === "failure" || step.conclusion
							? stepConclusion
							: "success"
						: null,
					number: index + 1,
					started_at: new Date(stepStart).toISOString(),
					completed_at: stepFinished ? new Date(stepEnd).toISOString() : null,
				};
			});
			const jobEnd = Math.max(stepCursor, jobStart + 1000);
			const jobStatus = jobDone ? "completed" : "in_progress";
			const jobRow = gh.jobs.insert({
				node_id: "",
				repo_id: state.repoId,
				run_id: runId,
				name: job.name,
				status: jobStatus,
				conclusion: jobDone ? (job.conclusion ?? "success") : null,
				started_at: new Date(jobStart).toISOString(),
				completed_at: jobDone ? new Date(jobEnd).toISOString() : null,
				runner_id: 1,
				runner_name: "GitHub Actions 2",
				steps,
			});
			gh.jobs.update(jobRow.id, { node_id: encodeNodeId("Job", jobRow.id) });
			setTimestamps(
				gh.jobs.get(jobRow.id),
				new Date(jobStart).toISOString(),
				new Date(jobEnd).toISOString(),
			);
			const logRow = extras.jobLogs.insert({
				job_id: jobRow.id,
				steps: stepLogs,
			});
			setTimestamps(
				extras.jobLogs.get(logRow.id),
				new Date(jobStart).toISOString(),
			);

			const check = gh.checkRuns.insert({
				node_id: "",
				repo_id: state.repoId,
				head_sha: head.sha,
				name: job.name,
				status: jobStatus,
				conclusion: jobDone ? (job.conclusion ?? "success") : null,
				started_at: new Date(jobStart).toISOString(),
				completed_at: jobDone ? new Date(jobEnd).toISOString() : null,
				external_id: String(jobRow.id),
				details_url: `https://github.com/${state.fullName}/actions/runs/${runId}/job/${jobRow.id}`,
				actions: null,
				output: {
					title: job.conclusion === "failure" ? `${job.name} failed` : null,
					summary: null,
					text: null,
					annotations_count: 0,
					annotations: [],
				},
				check_suite_id: suite.id,
				app_id: DEMO_GITHUB_APP.appId,
			});
			gh.checkRuns.update(check.id, {
				node_id: encodeNodeId("CheckRun", check.id),
			});
			setTimestamps(
				gh.checkRuns.get(check.id),
				new Date(jobStart).toISOString(),
				new Date(jobEnd).toISOString(),
			);
			cursor = jobStart + 1500;
			runEnd = Math.max(runEnd, jobEnd);
		}

		const firstStartedAt = runStarts.get(runId) ?? startedAt;
		runStarts.set(runId, firstStartedAt);
		setTimestamps(
			gh.workflowRuns.get(runId),
			firstStartedAt,
			new Date(runEnd).toISOString(),
		);
	}
}

function seedStatuses(
	extras: ExtrasStore,
	state: RepoState,
	clock: Clock,
	userId: (login: string) => number,
) {
	for (const status of state.spec.statuses ?? []) {
		const sha = state.tips.get(status.branch);
		if (!sha) throw new Error(`status on unknown branch ${status.branch}`);
		const row = extras.statuses.insert({
			repo_id: state.repoId,
			sha,
			context: status.context,
			state: status.state,
			description: status.description,
			target_url: `https://example.dev/${status.context}`,
			creator_id: userId("sam-okafor"),
		});
		setTimestamps(extras.statuses.get(row.id), clock(status.at));
	}
}

function seedDiscussions(
	gh: GitHubStore,
	extras: ExtrasStore,
	state: RepoState,
	clock: Clock,
	userId: (login: string) => number,
) {
	let next =
		Math.max(
			0,
			...gh.issues.findBy("repo_id", state.repoId).map((row) => row.number),
		) + 1;
	for (const discussion of state.spec.discussions ?? []) {
		const row = extras.discussions.insert({
			repo_id: state.repoId,
			number: next++,
			title: discussion.title,
			user_id: userId(discussion.author),
			category_name: discussion.category.name,
			category_emoji: discussion.category.emoji,
			comments_count: discussion.comments,
			answer_chosen_at: discussion.answered ? clock(discussion.answered) : null,
		});
		setTimestamps(
			extras.discussions.get(row.id),
			clock(discussion.at),
			clock(discussion.updated),
		);
	}
}

/** Fills in what emulate leaves at zero and pins `updated_at` to the last activity. */
async function finalizePulls(
	emulator: DiffkitEmulator,
	gh: GitHubStore,
	state: RepoState,
	clock: Clock,
) {
	for (const spec of state.spec.pulls ?? []) {
		const number = state.pullNumbers.get(spec.head) as number;
		const pr = gh.pullRequests
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);
		const issue = gh.issues
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);
		if (!pr || !issue) continue;
		const files = (await emulator
			.fetch(
				new Request(
					`${emulator.url}/repos/${state.fullName}/pulls/${number}/files?per_page=100`,
					{
						headers: { Authorization: `token ${seedTokenFor("nova")}` },
					},
				),
			)
			.then((response) => response.json())) as Array<{
			additions: number;
			deletions: number;
		}>;
		const commits = commitsBetween(gh, state.repoId, pr.base_sha, pr.head_sha);
		const latestReview = new Map<number, string>();
		for (const review of gh.reviews.findBy("repo_id", state.repoId)) {
			if (
				review.pull_number === number &&
				review.state !== "PENDING" &&
				review.state !== "COMMENTED"
			) {
				latestReview.set(review.user_id, review.state);
			}
		}
		const failingChecks = gh.checkRuns
			.findBy("repo_id", state.repoId)
			.filter((run) => run.head_sha === pr.head_sha)
			.reduce(
				(latest, run) => latest.set(run.name, run.conclusion),
				new Map<string, string | null>(),
			);
		let mergeableState = "clean";
		if (pr.merged || pr.state === "closed") mergeableState = "unknown";
		else if (spec.draft) mergeableState = "draft";
		else if (spec.conflicting) mergeableState = "dirty";
		else if ([...latestReview.values()].includes("CHANGES_REQUESTED"))
			mergeableState = "blocked";
		else if ([...failingChecks.values()].includes("failure"))
			mergeableState = "unstable";

		const activity = [
			clock(spec.at),
			...(spec.comments ?? []).map((comment) => clock(comment.at)),
			...(spec.reviews ?? []).flatMap((review) => [
				clock(review.at),
				...(review.threads ?? []).flatMap((thread) =>
					(thread.replies ?? []).map((reply) => clock(reply.at)),
				),
			]),
			...(spec.closedAt ? [clock(spec.closedAt)] : []),
		].sort();
		const updatedAt = activity.at(-1) as string;
		gh.pullRequests.update(pr.id, {
			additions: files.reduce((sum, file) => sum + file.additions, 0),
			deletions: files.reduce((sum, file) => sum + file.deletions, 0),
			changed_files: files.length,
			commits: Math.max(1, commits.length),
			mergeable: pr.merged || pr.state === "closed" ? null : !spec.conflicting,
			mergeable_state: mergeableState,
		});
		setTimestamps(gh.pullRequests.get(pr.id), clock(spec.at), updatedAt);
		setTimestamps(gh.issues.get(issue.id), clock(spec.at), updatedAt);
	}

	for (const spec of state.spec.issues ?? []) {
		const number = state.issueNumbers.get(spec.key) as number;
		const issue = gh.issues
			.findBy("repo_id", state.repoId)
			.find((row) => row.number === number);
		if (!issue) continue;
		const activity = [
			clock(spec.at),
			...(spec.comments ?? []).map((comment) => clock(comment.at)),
			...(spec.closedAt ? [clock(spec.closedAt)] : []),
		].sort();
		setTimestamps(gh.issues.get(issue.id), clock(spec.at), activity.at(-1));
	}
}

function finalizeRepo(gh: GitHubStore, state: RepoState, clock: Clock) {
	const commits = gh.commits.findBy("repo_id", state.repoId);
	const latest = commits
		.map((commit) => commit.committer_date)
		.sort()
		.at(-1);
	const repo = gh.repos.get(state.repoId);
	if (repo) {
		repo.pushed_at = latest ?? repo.pushed_at;
		repo.updated_at = latest ?? clock({ d: 1 });
	}
	for (const branch of gh.branches.findBy("repo_id", state.repoId)) {
		const commit = commits.find((candidate) => candidate.sha === branch.sha);
		if (commit)
			setTimestamps(gh.branches.get(branch.id), commit.committer_date);
	}
	for (const ref of gh.refs.findBy("repo_id", state.repoId)) {
		setTimestamps(gh.refs.get(ref.id), latest ?? clock({ d: 1 }));
	}
	for (const label of gh.labels.findBy("repo_id", state.repoId)) {
		setTimestamps(gh.labels.get(label.id), clock(state.spec.commits[0].at));
	}
	for (const milestone of gh.milestones.findBy("repo_id", state.repoId)) {
		setTimestamps(
			gh.milestones.get(milestone.id),
			clock(state.spec.commits[0].at),
		);
	}
	for (const tree of gh.trees.findBy("repo_id", state.repoId)) {
		setTimestamps(gh.trees.get(tree.id), clock(state.spec.commits[0].at));
	}
	for (const blob of gh.blobs.findBy("repo_id", state.repoId)) {
		setTimestamps(gh.blobs.get(blob.id), clock(state.spec.commits[0].at));
	}
	for (const collaborator of gh.collaborators.findBy("repo_id", state.repoId)) {
		setTimestamps(
			gh.collaborators.get(collaborator.id),
			clock(state.spec.commits[0].at),
		);
	}
}

async function seedForks(
	api: (login: string) => Api,
	gh: GitHubStore,
	workspace: WorkspaceSpec,
	clock: Clock,
) {
	for (const fork of workspace.forks) {
		const [owner, repo] = fork.from.split("/");
		const created = await api(fork.by).request(
			"POST /repos/{owner}/{repo}/forks",
			{
				owner,
				repo,
				default_branch_only: false,
			},
		);
		const row = gh.repos.get(created.data.id);
		setTimestamps(row, clock({ d: 20 }), clock({ d: 20 }));
		const parent = gh.repos.findOneBy("full_name", fork.from);
		const spec = workspace.repos.find(
			(candidate) => `${candidate.owner}/${candidate.name}` === fork.from,
		);
		if (parent && spec) gh.repos.update(parent.id, { forks_count: spec.forks });
		if (row)
			setTimestamps(gh.repos.get(row.id), clock({ d: 20 }), clock({ d: 20 }));
	}
}

function seedStarsAndPins(
	gh: GitHubStore,
	extras: ExtrasStore,
	workspace: WorkspaceSpec,
	clock: Clock,
	userId: (login: string) => number,
) {
	for (const [login, repos] of Object.entries(workspace.stars)) {
		repos.forEach((fullName, index) => {
			const repo = gh.repos.findOneBy("full_name", fullName);
			if (!repo) return;
			const row = extras.stars.insert({
				user_id: userId(login),
				repo_id: repo.id,
			});
			setTimestamps(extras.stars.get(row.id), clock({ d: 30 - index * 7 }));
		});
	}
	for (const [login, repos] of Object.entries(workspace.pinned)) {
		const repoIds = repos
			.map((fullName) => gh.repos.findOneBy("full_name", fullName)?.id)
			.filter((id): id is number => typeof id === "number");
		const row = extras.pinned.insert({
			user_id: userId(login),
			repo_ids: repoIds,
		});
		setTimestamps(extras.pinned.get(row.id), clock({ d: 10 }));
	}
}

function seedNotifications(
	emulator: DiffkitEmulator,
	workspace: WorkspaceSpec,
	states: RepoState[],
	clock: Clock,
	userId: (login: string) => number,
) {
	const viewer = workspace.people[0].login;
	const sorted = [...workspace.notifications].sort((a, b) =>
		clock(a.at).localeCompare(clock(b.at)),
	);
	for (const notification of sorted) {
		const state = states.find(
			(candidate) => candidate.fullName === notification.repo,
		);
		if (!state)
			throw new Error(
				`notification references unknown repo ${notification.repo}`,
			);
		const [kind, key] = notification.subject.split(/:(.*)/su);
		const number =
			kind === "pull"
				? state.pullNumbers.get(key)
				: state.issueNumbers.get(key);
		if (!number)
			throw new Error(
				`notification references unknown ${notification.subject}`,
			);
		upsertNotification(emulator.store, {
			userId: userId(viewer),
			repoId: state.repoId,
			subjectType: kind === "pull" ? "PullRequest" : "Issue",
			subjectNumber: number,
			reason: notification.reason,
			unread: notification.unread,
			at: clock(notification.at),
		});
	}
}

/**
 * `/users/:username/events` derived from store activity (GitHub's events API
 * is not part of emulate).
 */
import type { GitHubRepo } from "@emulators/github";
import type { ShimContext } from "../server.ts";
import { apiUserJson, GITHUB_WEB_URL, stores } from "./common.ts";

type UserEvent = {
	id: string;
	type: string;
	actor: ReturnType<typeof apiUserJson>;
	repo: { id: number; name: string; url: string };
	payload: Record<string, unknown>;
	public: boolean;
	created_at: string;
};

export function buildUserEvents(
	context: ShimContext,
	login: string,
	publicOnly: boolean,
): UserEvent[] {
	const { gh, extras } = stores(context);
	const user = gh.users.findOneBy("login", login);
	if (!user) {
		return [];
	}
	const actor = apiUserJson(user, context.baseUrl);
	const events: UserEvent[] = [];
	const repoRef = (repo: GitHubRepo) => ({
		id: repo.id,
		name: repo.full_name,
		url: `${context.baseUrl}/repos/${repo.full_name}`,
	});
	const visible = (repo: GitHubRepo | undefined): repo is GitHubRepo =>
		Boolean(repo) && !(publicOnly && repo?.private);
	const push = (
		type: string,
		repo: GitHubRepo,
		payload: Record<string, unknown>,
		createdAt: string,
		key: string,
	) => {
		events.push({
			id: key,
			type,
			actor,
			repo: repoRef(repo),
			payload,
			public: !repo.private,
			created_at: createdAt,
		});
	};

	// Group a user's commits per repo per day into push events.
	const pushes = new Map<
		string,
		{
			repo: GitHubRepo;
			commits: typeof gh.commits extends { all(): Array<infer C> }
				? C[]
				: never;
		}
	>();
	for (const commit of gh.commits.all()) {
		if (commit.user_id !== user.id || commit.parent_shas.length > 1) {
			continue;
		}
		const repo = gh.repos.get(commit.repo_id);
		if (!visible(repo)) {
			continue;
		}
		const key = `${repo.id}:${commit.committer_date.slice(0, 10)}`;
		const entry = pushes.get(key) ?? { repo, commits: [] };
		entry.commits.push(commit);
		pushes.set(key, entry);
	}
	for (const [key, { repo, commits }] of pushes) {
		commits.sort((a, b) => a.committer_date.localeCompare(b.committer_date));
		const head = commits.at(-1);
		if (!head) {
			continue;
		}
		const branch =
			gh.branches.findBy("repo_id", repo.id).find((row) => row.sha === head.sha)
				?.name ?? repo.default_branch;
		push(
			"PushEvent",
			repo,
			{
				ref: `refs/heads/${branch}`,
				head: head.sha,
				size: commits.length,
				commits: commits.map((commit) => ({
					sha: commit.sha,
					message: commit.message,
				})),
			},
			head.committer_date,
			`push-${key}`,
		);
	}

	for (const pull of gh.pullRequests.all()) {
		const repo = gh.repos.get(pull.repo_id);
		if (!visible(repo)) {
			continue;
		}
		const payloadPull = {
			title: pull.title,
			number: pull.number,
			body: pull.body,
			additions: pull.additions,
			deletions: pull.deletions,
			comments: pull.comments,
			changed_files: pull.changed_files,
			state: pull.state,
			draft: pull.draft,
			merged: pull.merged,
			html_url: `${GITHUB_WEB_URL}/${repo.full_name}/pull/${pull.number}`,
			head: { ref: pull.head_ref },
			base: { ref: pull.base_ref },
			labels: pull.label_ids
				.map((id) => gh.labels.get(id))
				.filter((label) => label !== undefined)
				.map((label) => ({ name: label.name, color: label.color })),
		};
		if (pull.user_id === user.id) {
			push(
				"PullRequestEvent",
				repo,
				{ action: "opened", number: pull.number, pull_request: payloadPull },
				pull.created_at,
				`pr-open-${pull.id}`,
			);
		}
		if (pull.merged && pull.merged_by_id === user.id && pull.merged_at) {
			push(
				"PullRequestEvent",
				repo,
				{ action: "closed", number: pull.number, pull_request: payloadPull },
				pull.merged_at,
				`pr-merge-${pull.id}`,
			);
		}
		for (const review of gh.reviews.findBy("repo_id", repo.id)) {
			if (
				review.pull_number !== pull.number ||
				review.user_id !== user.id ||
				!review.submitted_at
			) {
				continue;
			}
			push(
				"PullRequestReviewEvent",
				repo,
				{
					action: "created",
					review: { state: review.state.toLowerCase(), body: review.body },
					pull_request: payloadPull,
				},
				review.submitted_at,
				`review-${review.id}`,
			);
		}
	}

	for (const issue of gh.issues.all()) {
		const repo = gh.repos.get(issue.repo_id);
		if (issue.is_pull_request || !visible(repo) || issue.user_id !== user.id) {
			continue;
		}
		push(
			"IssuesEvent",
			repo,
			{
				action: "opened",
				issue: {
					title: issue.title,
					number: issue.number,
					state: issue.state,
					html_url: `${GITHUB_WEB_URL}/${repo.full_name}/issues/${issue.number}`,
					labels: issue.label_ids
						.map((id) => gh.labels.get(id))
						.filter((label) => label !== undefined)
						.map((label) => ({ name: label.name, color: label.color })),
				},
			},
			issue.created_at,
			`issue-${issue.id}`,
		);
	}

	for (const comment of gh.comments.all()) {
		if (comment.comment_type !== "issue" || comment.user_id !== user.id) {
			continue;
		}
		const repo = gh.repos.get(comment.repo_id);
		if (!visible(repo)) {
			continue;
		}
		const issue = gh.issues
			.findBy("repo_id", repo.id)
			.find((row) => row.number === comment.issue_number);
		push(
			"IssueCommentEvent",
			repo,
			{
				action: "created",
				issue: { title: issue?.title, number: issue?.number },
				comment: { body: comment.body },
			},
			comment.created_at,
			`comment-${comment.id}`,
		);
	}

	for (const release of gh.releases.all()) {
		const repo = gh.repos.get(release.repo_id);
		if (release.author_id !== user.id || release.draft || !visible(repo)) {
			continue;
		}
		push(
			"ReleaseEvent",
			repo,
			{
				action: "published",
				release: { tag_name: release.tag_name, name: release.name },
			},
			release.published_at ?? release.created_at,
			`release-${release.id}`,
		);
	}

	for (const star of extras.stars.findBy("user_id", user.id)) {
		const repo = gh.repos.get(star.repo_id);
		if (!visible(repo)) {
			continue;
		}
		push(
			"WatchEvent",
			repo,
			{ action: "started" },
			star.created_at,
			`star-${star.id}`,
		);
	}

	for (const repo of gh.repos.all()) {
		if (!repo.fork || repo.owner_id !== user.id || !repo.forked_from_id) {
			continue;
		}
		const parent = gh.repos.get(repo.forked_from_id);
		if (!visible(parent)) {
			continue;
		}
		push(
			"ForkEvent",
			parent,
			{ forkee: { full_name: repo.full_name } },
			repo.created_at,
			`fork-${repo.id}`,
		);
	}

	return events.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

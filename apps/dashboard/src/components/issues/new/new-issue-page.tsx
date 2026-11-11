import { IssuesIcon } from "@diffkit/icons";
import { PanelSection } from "@diffkit/ui/components/detail-layout";
import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	labelOption,
	userOption,
} from "#/components/compare/compare-properties";
import { PropertyPicker } from "#/components/compare/property-picker";
import { DetailSidebar, RepoRow } from "#/components/details/detail-sidebar";
import {
	DraftPage,
	type DraftSubmission,
} from "#/components/details/draft-page";
import { MentionSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import { createIssue } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoCollaboratorsQueryOptions,
	githubRepoLabelsQueryOptions,
	githubRepoTemplateQueryOptions,
} from "#/lib/github.query";
import type { GitHubLabel, RepoCollaborator } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	issueEntityKey,
} from "#/lib/github-query-updates";

const routeApi = getRouteApi("/_protected/$owner/$repo/issues/new");

function toggled<T>(list: T[], item: T, same: (a: T, b: T) => boolean) {
	return list.some((existing) => same(existing, item))
		? list.filter((existing) => !same(existing, item))
		: [...list, item];
}

export function NewIssuePage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo } = routeApi.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);

	return <NewIssueForm owner={owner} repo={repo} scope={scope} />;
}

function NewIssueForm({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [editedBody, setEditedBody] = useState<string | null>(null);
	const [labels, setLabels] = useState<GitHubLabel[]>([]);
	const [assignees, setAssignees] = useState<RepoCollaborator[]>([]);
	const [submission, setSubmission] = useState<DraftSubmission>({
		status: "idle",
	});

	const labelsQuery = useQuery(
		githubRepoLabelsQueryOptions(scope, { owner, repo }),
	);
	const collaboratorsQuery = useQuery(
		githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
	);
	const templateQuery = useQuery(
		githubRepoTemplateQueryOptions(scope, { owner, repo, kind: "issue" }),
	);

	const repoLabels = labelsQuery.data ?? [];
	const collaborators = collaboratorsQuery.data ?? [];
	const body = editedBody ?? templateQuery.data ?? "";

	const mentions = useMemo<MentionConfig>(
		() => ({
			candidates: (collaboratorsQuery.data ?? []).map((collaborator) => ({
				id: collaborator.login,
				label: collaborator.login,
				avatarUrl: collaborator.avatarUrl,
			})),
			isLoading: collaboratorsQuery.isPending,
			loadingPlaceholder: <MentionSkeletonRows />,
		}),
		[collaboratorsQuery.data, collaboratorsQuery.isPending],
	);

	const handleSubmit = async () => {
		setSubmission({ status: "submitting" });
		try {
			const result = await createIssue({
				data: {
					owner,
					repo,
					title: title.trim(),
					body: body.trim() || undefined,
					labels: labels.length > 0 ? labels.map((l) => l.name) : undefined,
					assignees:
						assignees.length > 0 ? assignees.map((a) => a.login) : undefined,
				},
			});
			if (!result.ok) {
				setSubmission({ status: "failed", message: result.error });
				return;
			}
			await invalidateGitHubEntities(
				queryClient,
				scope,
				[issueEntityKey({ owner, repo, issueNumber: result.issueNumber })],
				"created",
			);
			await router.navigate({
				to: "/$owner/$repo/issues/$issueId",
				params: { owner, repo, issueId: String(result.issueNumber) },
			});
		} catch {
			setSubmission({
				status: "failed",
				message: "Failed to create issue. Please try again.",
			});
		}
	};

	return (
		<DraftPage
			owner={owner}
			repo={repo}
			heading="New issue"
			title={title}
			titlePlaceholder="Issue title"
			onTitleChange={setTitle}
			body={body}
			bodyPrompt="Describe the issue"
			onBodyChange={setEditedBody}
			mentions={mentions}
			submission={submission}
			submitLabel="Create issue"
			submitIcon={<IssuesIcon size={14} strokeWidth={2} />}
			cancel={
				<Link to="/$owner/$repo/issues" params={{ owner, repo }}>
					Cancel
				</Link>
			}
			onSubmit={handleSubmit}
			panel={
				<DetailSidebar>
					<PanelSection label="Properties">
						<RepoRow owner={owner} repo={repo} />
					</PanelSection>
					<PropertyPicker
						label="Assignees"
						addLabel="Assign people"
						placeholder="Assign to…"
						emptyLabel="No collaborators"
						options={collaborators
							.filter((c) => c.type !== "Bot")
							.map(userOption)}
						selected={assignees.map(userOption)}
						loading={collaboratorsQuery.isLoading}
						onToggle={(key) => {
							const person = collaborators.find(
								(c) => `user:${c.login}` === key,
							);
							if (!person) return;
							setAssignees((current) =>
								toggled(current, person, (a, b) => a.login === b.login),
							);
						}}
					/>
					<PropertyPicker
						label="Labels"
						addLabel="Add labels"
						placeholder="Change labels…"
						emptyLabel="No labels in this repository"
						display="pills"
						options={repoLabels.map(labelOption)}
						selected={labels.map(labelOption)}
						loading={labelsQuery.isLoading}
						onToggle={(key) => {
							const label = repoLabels.find((l) => l.name === key);
							if (!label) return;
							setLabels((current) =>
								toggled(current, label, (a, b) => a.name === b.name),
							);
						}}
					/>
				</DetailSidebar>
			}
		/>
	);
}

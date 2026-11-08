import { Input } from "@diffkit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { Switch } from "@diffkit/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DangerRow } from "#/components/settings/danger-row";
import { SaveBar } from "#/components/settings/save-bar";
import {
	SettingsGroup,
	SettingsRow,
} from "#/components/settings/settings-group";
import { SettingsReadView } from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import {
	changeRepoVisibility,
	deleteRepository,
	setRepoArchived,
	updateRepoGeneralSettings,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoGeneralSettingsQueryOptions,
	githubRepoRefNamesQueryOptions,
} from "#/lib/github.query";
import { repoEntityKey } from "#/lib/github-query-updates";
import {
	changedFields,
	DESCRIPTION_MAX_LENGTH,
	draftFromSettings,
	type RepoGeneralDraft,
	type RepoGeneralSettings,
	validateRepoGeneralDraft,
} from "#/lib/settings/repo-general";

type FlagField = {
	field: keyof RepoGeneralDraft & `${"has" | "allow" | "delete"}${string}`;
	label: string;
	description: string;
};

const FEATURES: FlagField[] = [
	{
		field: "hasIssues",
		label: "Issues",
		description: "Track bugs and tasks in this repository.",
	},
	{
		field: "hasWiki",
		label: "Wiki",
		description: "Host documentation next to the code.",
	},
	{
		field: "hasDiscussions",
		label: "Discussions",
		description: "A space for conversation outside of issues.",
	},
];

const MERGE_OPTIONS: FlagField[] = [
	{
		field: "allowMergeCommit",
		label: "Allow merge commits",
		description: "Add every commit from the branch with a merge commit.",
	},
	{
		field: "allowSquashMerge",
		label: "Allow squash merging",
		description: "Combine the branch's commits into one.",
	},
	{
		field: "allowRebaseMerge",
		label: "Allow rebase merging",
		description: "Replay the branch's commits onto the base branch.",
	},
	{
		field: "allowAutoMerge",
		label: "Allow auto-merge",
		description: "Merge automatically once required checks pass.",
	},
	{
		field: "allowUpdateBranch",
		label: "Suggest updating pull request branches",
		description: "Offer to update a branch that is behind its base.",
	},
	{
		field: "deleteBranchOnMerge",
		label: "Delete head branches after merge",
		description: "Clean up the branch when its pull request is merged.",
	},
];

export function GeneralSettings({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const query = useQuery(
		githubRepoGeneralSettingsQueryOptions(scope, { owner, repo }),
	);

	return (
		<>
			<SettingsHeading
				title="General"
				description="Name, features and how pull requests are merged."
			/>
			<SettingsReadView
				query={query}
				skeletonRows={6}
				forbiddenTitle="Repository settings aren't available"
				forbiddenHint="GitHub only shows these to people with admin access to the repository."
				githubUrl={`https://github.com/${owner}/${repo}/settings`}
			>
				{(settings) => (
					<GeneralForm
						settings={settings}
						owner={owner}
						repo={repo}
						scope={scope}
					/>
				)}
			</SettingsReadView>
		</>
	);
}

function GeneralForm({
	settings,
	owner,
	repo,
	scope,
}: {
	settings: RepoGeneralSettings;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const navigate = useNavigate();
	const saved = draftFromSettings(settings);
	const [edited, setEdited] = useState<RepoGeneralDraft | null>(null);
	const draft = edited ?? saved;
	const changes = changedFields(saved, draft);
	const dirty = Object.keys(changes).length > 0;
	const problem = dirty ? validateRepoGeneralDraft(draft) : null;
	const entityKeys = [repoEntityKey({ owner, repo })];
	const { status, run } = useSettingsAction(scope, entityKeys);

	const branches = useQuery(
		githubRepoRefNamesQueryOptions(scope, { owner, repo, kind: "branches" }),
	);
	const branchNames = [
		...new Set([settings.defaultBranch, ...(branches.data?.names ?? [])]),
	];

	function update(next: Partial<RepoGeneralDraft>) {
		setEdited({ ...draft, ...next });
	}

	async function save() {
		const saved = await run(() =>
			updateRepoGeneralSettings({ data: { owner, repo, changes } }),
		);
		if (saved) setEdited(null);
	}

	const flagRows = (fields: FlagField[]) =>
		fields.map(({ field, label, description }) => (
			<SettingsRow
				key={field}
				label={label}
				description={description}
				htmlFor={`general-${field}`}
				control={
					<Switch
						id={`general-${field}`}
						checked={draft[field]}
						onCheckedChange={(checked) => update({ [field]: checked })}
					/>
				}
			/>
		));

	return (
		<>
			<SettingsGroup title="Repository">
				<SettingsRow
					label="Name"
					description="Rename the repository on GitHub."
					control={
						<span className="truncate text-[13px] text-text-strong">
							{settings.fullName}
						</span>
					}
				/>
				<SettingsRow
					label="Description"
					description={`${draft.description.trim().length}/${DESCRIPTION_MAX_LENGTH}`}
					htmlFor="general-description"
					control={
						<Input
							id="general-description"
							value={draft.description}
							onChange={(event) => update({ description: event.target.value })}
							placeholder="What is this repository for?"
						/>
					}
				/>
				<SettingsRow
					label="Website"
					htmlFor="general-homepage"
					control={
						<Input
							id="general-homepage"
							type="url"
							value={draft.homepage}
							onChange={(event) => update({ homepage: event.target.value })}
							placeholder="https://"
						/>
					}
				/>
				<SettingsRow
					label="Default branch"
					description="Pull requests target this branch unless told otherwise."
					control={
						<Select
							value={draft.defaultBranch}
							onValueChange={(value) => update({ defaultBranch: value })}
						>
							<SelectTrigger aria-label="Default branch" className="max-w-56">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{branchNames.map((name) => (
									<SelectItem key={name} value={name}>
										{name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
			</SettingsGroup>

			<SettingsGroup title="Features">{flagRows(FEATURES)}</SettingsGroup>

			<SettingsGroup
				title="Pull requests"
				description="Keep at least one merge method enabled."
			>
				{flagRows(MERGE_OPTIONS)}
			</SettingsGroup>

			<SettingsGroup title="Danger zone">
				<DangerRow
					scope={scope}
					entityKeys={entityKeys}
					title={
						settings.visibility === "public"
							? "Make this repository private"
							: "Make this repository public"
					}
					description={
						settings.visibility === "public"
							? "Only people you grant access will be able to see it."
							: "Anyone on the internet will be able to see the code."
					}
					buttonLabel="Change visibility"
					dialogTitle={`Make ${settings.fullName} ${settings.visibility === "public" ? "private" : "public"}?`}
					dialogDescription={
						settings.visibility === "public"
							? "Stars and watchers are lost, and forks become detached."
							: "The code, issues and pull requests become visible to everyone."
					}
					actionLabel="Change visibility"
					onConfirm={() =>
						changeRepoVisibility({
							data: {
								owner,
								repo,
								visibility:
									settings.visibility === "public" ? "private" : "public",
							},
						})
					}
				/>
				<DangerRow
					scope={scope}
					entityKeys={entityKeys}
					title={
						settings.isArchived ? "Unarchive repository" : "Archive repository"
					}
					description={
						settings.isArchived
							? "Make the repository writable again."
							: "Make the repository read-only. Nothing can be pushed or commented."
					}
					buttonLabel={settings.isArchived ? "Unarchive" : "Archive"}
					dialogTitle={`${settings.isArchived ? "Unarchive" : "Archive"} ${settings.fullName}?`}
					dialogDescription={
						settings.isArchived
							? "Issues, pull requests and pushes work again."
							: "It stays visible and can be unarchived later."
					}
					actionLabel={settings.isArchived ? "Unarchive" : "Archive"}
					onConfirm={() =>
						setRepoArchived({
							data: { owner, repo, archived: !settings.isArchived },
						})
					}
				/>
				<DangerRow
					scope={scope}
					entityKeys={entityKeys}
					title="Delete this repository"
					description="Permanently removes the code, issues, pull requests and settings."
					buttonLabel="Delete"
					dialogTitle={`Delete ${settings.fullName}?`}
					dialogDescription="This cannot be undone. GitHub only lets a token delete a repository when it was granted that permission."
					typedConfirmation={settings.fullName}
					actionLabel="Delete repository"
					onConfirm={() =>
						deleteRepository({
							data: { owner, repo, confirmation: settings.fullName },
						})
					}
					onDone={() => void navigate({ to: "/repos" })}
				/>
			</SettingsGroup>

			<SaveBar
				dirty={dirty}
				status={status}
				problem={problem}
				onSave={() => void save()}
				onDiscard={() => setEdited(null)}
			/>
		</>
	);
}

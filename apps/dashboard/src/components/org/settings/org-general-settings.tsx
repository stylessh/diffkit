import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Input } from "@diffkit/ui/components/input";
import { Switch } from "@diffkit/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OptionSelect } from "#/components/settings/option-select";
import { SaveBar } from "#/components/settings/save-bar";
import {
	SettingsGroup,
	SettingsRow,
} from "#/components/settings/settings-group";
import {
	EditOnGitHubLink,
	SettingsReadView,
} from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import { updateOrgSettings } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubOrgSettingsQueryOptions,
} from "#/lib/github.query";
import { orgEntityKey } from "#/lib/github-query-updates";
import {
	changedOrgFields,
	DEFAULT_PERMISSION_OPTIONS,
	type OrgProfileDraft,
	type OrgSettings,
	orgDraftFromSettings,
	validateOrgDraft,
} from "#/lib/settings/org";
import { useOrgSettingsAccess } from "./org-settings-frame";
import { SAMPLE_ORG_SETTINGS } from "./org-settings-samples";

type TextField = "name" | "description" | "email" | "blog" | "location";

const TEXT_FIELDS: { field: TextField; label: string; placeholder: string }[] =
	[
		{ field: "name", label: "Display name", placeholder: "Acme, Inc." },
		{
			field: "description",
			label: "Description",
			placeholder: "What the organization does",
		},
		{ field: "email", label: "Public email", placeholder: "hello@example.com" },
		{ field: "blog", label: "Website", placeholder: "https://" },
		{ field: "location", label: "Location", placeholder: "City, country" },
	];

export function OrgGeneralSettings({
	org,
	scope,
}: {
	org: string;
	scope: GitHubQueryScope;
}) {
	const query = useQuery(githubOrgSettingsQueryOptions(scope, { org }));
	const access = useOrgSettingsAccess(scope, org);
	const canManage = access.status === "member" && access.capabilities.manage;

	return (
		<>
			<SettingsHeading
				title="General"
				description="How the organization appears and what members can do by default."
				actions={
					<EditOnGitHubLink
						href={`https://github.com/organizations/${org}/settings/profile`}
					/>
				}
			/>
			<SettingsReadView
				query={query}
				sample={SAMPLE_ORG_SETTINGS}
				forbiddenTitle="Organization settings aren't available"
				forbiddenHint="You need to be a member of this organization."
				githubUrl={`https://github.com/${org}`}
			>
				{(settings) => (
					<OrgGeneralForm
						settings={settings}
						org={org}
						scope={scope}
						canManage={canManage}
					/>
				)}
			</SettingsReadView>
		</>
	);
}

function OrgGeneralForm({
	settings,
	org,
	scope,
	canManage,
}: {
	settings: OrgSettings;
	org: string;
	scope: GitHubQueryScope;
	canManage: boolean;
}) {
	const saved = orgDraftFromSettings(settings);
	const [edited, setEdited] = useState<OrgProfileDraft | null>(null);
	const draft = edited ?? saved;
	const changes = changedOrgFields(saved, draft);
	const dirty = Object.keys(changes).length > 0;
	const problem = dirty ? validateOrgDraft(draft) : null;
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);

	function update(next: Partial<OrgProfileDraft>) {
		setEdited({ ...draft, ...next });
	}

	async function save() {
		if (await run(() => updateOrgSettings({ data: { org, changes } }))) {
			setEdited(null);
		}
	}

	return (
		<>
			<SettingsGroup title="Profile">
				<SettingsRow
					label="Organization"
					description="The handle can be changed on GitHub."
					control={
						<span className="flex items-center gap-2 text-[13px] text-text-strong">
							<Avatar className="size-5">
								<AvatarImage src={settings.avatarUrl} alt="" />
								<AvatarFallback>{settings.login.slice(0, 2)}</AvatarFallback>
							</Avatar>
							{settings.login}
						</span>
					}
				/>
				{TEXT_FIELDS.map(({ field, label, placeholder }) => (
					<SettingsRow
						key={field}
						label={label}
						htmlFor={`org-${field}`}
						control={
							<Input
								id={`org-${field}`}
								value={draft[field]}
								disabled={!canManage}
								placeholder={placeholder}
								onChange={(event) => update({ [field]: event.target.value })}
							/>
						}
					/>
				))}
			</SettingsGroup>

			<SettingsGroup
				title="Member privileges"
				description={
					canManage ? undefined : "Only organization owners can change these."
				}
			>
				<SettingsRow
					label="Base repository permission"
					description="What every member can do in the organization's repositories."
					control={
						<OptionSelect
							value={draft.defaultRepositoryPermission}
							options={DEFAULT_PERMISSION_OPTIONS}
							label="Base repository permission"
							disabled={!canManage}
							className="w-40"
							onChange={(value) =>
								update({ defaultRepositoryPermission: value })
							}
						/>
					}
				/>
				<SettingsRow
					label="Members can create repositories"
					htmlFor="org-members-create-repos"
					control={
						<Switch
							id="org-members-create-repos"
							checked={draft.membersCanCreateRepositories}
							disabled={!canManage}
							onCheckedChange={(checked) =>
								update({ membersCanCreateRepositories: checked })
							}
						/>
					}
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

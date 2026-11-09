import { PlusSignIcon } from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActionNote } from "#/components/settings/action-note";
import { InlineConfirmButton } from "#/components/settings/inline-confirm";
import { OptionSelect } from "#/components/settings/option-select";
import {
	SettingsEmptyRow,
	SettingsGroup,
	SettingsListRow,
} from "#/components/settings/settings-group";
import { SettingsReadView } from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import {
	deleteOrgTeam,
	removeOrgTeamMember,
	saveOrgTeam,
	setOrgTeamMember,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubOrgTeamListQueryOptions,
	githubOrgTeamMembersQueryOptions,
} from "#/lib/github.query";
import { orgEntityKey } from "#/lib/github-query-updates";
import {
	type OrgTeamDraft,
	type OrgTeamPrivacy,
	type OrgTeamSummary,
	type TeamRole,
	validateOrgTeamDraft,
} from "#/lib/settings/org";
import { useOrgSettingsAccess } from "./org-settings-frame";
import {
	SAMPLE_ORG_TEAM_MEMBERS,
	SAMPLE_ORG_TEAMS,
} from "./org-settings-samples";

type OrgProps = { org: string; scope: GitHubQueryScope };

type Panel =
	| { kind: "none" }
	| { kind: "create" }
	| { kind: "edit"; slug: string }
	| { kind: "members"; slug: string };

const PRIVACY_OPTIONS: { value: OrgTeamPrivacy; label: string }[] = [
	{ value: "closed", label: "Visible" },
	{ value: "secret", label: "Secret" },
];

const TEAM_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
	{ value: "member", label: "Member" },
	{ value: "maintainer", label: "Maintainer" },
];

export function OrgTeamsSettings({ org, scope }: OrgProps) {
	const query = useQuery(githubOrgTeamListQueryOptions(scope, { org }));
	const access = useOrgSettingsAccess(scope, org);
	const canManage = access.status === "member" && access.capabilities.manage;
	const [panel, setPanel] = useState<Panel>({ kind: "none" });

	return (
		<>
			<SettingsHeading
				title="Teams"
				description="Group members to grant access to repositories together."
				actions={
					canManage ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setPanel({ kind: "create" })}
						>
							<PlusSignIcon size={13} />
							New team
						</Button>
					) : null
				}
			/>
			<SettingsReadView
				query={query}
				sample={SAMPLE_ORG_TEAMS}
				forbiddenTitle="Teams aren't available"
				forbiddenHint="You need to be a member of this organization."
				githubUrl={`https://github.com/orgs/${org}/teams`}
			>
				{(teams) => (
					<>
						{panel.kind === "create" ? (
							<TeamEditor
								team={null}
								teams={teams}
								org={org}
								scope={scope}
								onClose={() => setPanel({ kind: "none" })}
							/>
						) : null}
						<SettingsGroup>
							{teams.length === 0 ? (
								<SettingsEmptyRow>No teams yet.</SettingsEmptyRow>
							) : (
								teams.map((team) => (
									<TeamRow
										key={team.slug}
										team={team}
										teams={teams}
										org={org}
										scope={scope}
										canManage={canManage}
										panel={panel}
										setPanel={setPanel}
									/>
								))
							)}
						</SettingsGroup>
					</>
				)}
			</SettingsReadView>
		</>
	);
}

function TeamRow({
	team,
	teams,
	org,
	scope,
	canManage,
	panel,
	setPanel,
}: OrgProps & {
	team: OrgTeamSummary;
	teams: OrgTeamSummary[];
	canManage: boolean;
	panel: Panel;
	setPanel: (panel: Panel) => void;
}) {
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);
	const editing = panel.kind === "edit" && panel.slug === team.slug;
	const showingMembers = panel.kind === "members" && panel.slug === team.slug;

	if (editing) {
		return (
			<TeamEditor
				team={team}
				teams={teams}
				org={org}
				scope={scope}
				onClose={() => setPanel({ kind: "none" })}
			/>
		);
	}

	return (
		<>
			<SettingsListRow>
				<div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
					<span className="truncate text-[13px] font-medium text-foreground">
						{team.name}
					</span>
					<span className="truncate text-xs text-muted-foreground">
						@{org}/{team.slug}
						{team.description ? ` · ${team.description}` : ""}
					</span>
				</div>
				{team.privacy === "secret" ? (
					<StatePill tone="muted">Secret</StatePill>
				) : null}
				<span className="flex items-center gap-1">
					<ActionNote status={status} />
					<Button
						type="button"
						variant="ghost"
						size="xs"
						aria-label={`Members of ${team.name}`}
						aria-expanded={showingMembers}
						onClick={() =>
							setPanel(
								showingMembers
									? { kind: "none" }
									: { kind: "members", slug: team.slug },
							)
						}
					>
						Members
					</Button>
					{canManage ? (
						<>
							<Button
								type="button"
								variant="ghost"
								size="xs"
								aria-label={`Edit team ${team.name}`}
								onClick={() => setPanel({ kind: "edit", slug: team.slug })}
							>
								Edit
							</Button>
							<InlineConfirmButton
								label="Delete"
								ariaLabel={`Delete team ${team.name}`}
								prompt="Delete team?"
								confirmLabel="Delete"
								pending={status.kind === "pending"}
								onConfirm={() =>
									void run(() =>
										deleteOrgTeam({ data: { org, teamSlug: team.slug } }),
									)
								}
							/>
						</>
					) : null}
				</span>
			</SettingsListRow>
			{showingMembers ? (
				<TeamMembers
					team={team}
					org={org}
					scope={scope}
					canManage={canManage}
				/>
			) : null}
		</>
	);
}

function TeamEditor({
	team,
	teams,
	org,
	scope,
	onClose,
}: OrgProps & {
	team: OrgTeamSummary | null;
	teams: OrgTeamSummary[];
	onClose: () => void;
}) {
	const [draft, setDraft] = useState<OrgTeamDraft>({
		name: team?.name ?? "",
		description: team?.description ?? "",
		privacy: team?.privacy ?? "closed",
	});
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);
	const otherNames = teams
		.filter((entry) => entry.slug !== team?.slug)
		.map((entry) => entry.name);
	const problem = validateOrgTeamDraft(draft, otherNames);
	const pending = status.kind === "pending";
	const idPrefix = `team-${team?.slug ?? "new"}`;

	async function save() {
		const ok = await run(() =>
			saveOrgTeam({
				data: { org, currentSlug: team?.slug ?? null, draft },
			}),
		);
		if (ok) onClose();
	}

	return (
		<SettingsGroup title={team ? "Edit team" : "New team"}>
			<div className="flex flex-col gap-3 px-4 py-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={`${idPrefix}-name`}>Name</Label>
						<Input
							id={`${idPrefix}-name`}
							autoComplete="off"
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={`${idPrefix}-description`}>Description</Label>
						<Input
							id={`${idPrefix}-description`}
							autoComplete="off"
							value={draft.description}
							onChange={(event) =>
								setDraft({ ...draft, description: event.target.value })
							}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label>Visibility</Label>
					<OptionSelect
						value={draft.privacy}
						options={PRIVACY_OPTIONS}
						label="Team visibility"
						className="w-40"
						onChange={(privacy) => setDraft({ ...draft, privacy })}
					/>
				</div>
				<div className="flex items-center justify-end gap-2">
					{draft.name !== "" && problem ? (
						<span className="mr-auto text-xs text-danger">{problem}</span>
					) : (
						<ActionNote status={status} className="mr-auto" />
					)}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={pending}
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={pending || problem !== null}
						onClick={() => void save()}
					>
						{pending ? "Saving…" : team ? "Save team" : "Create team"}
					</Button>
				</div>
			</div>
		</SettingsGroup>
	);
}

function TeamMembers({
	team,
	org,
	scope,
	canManage,
}: OrgProps & { team: OrgTeamSummary; canManage: boolean }) {
	const isSample = useIsSkeletonSample();
	const query = useQuery({
		...githubOrgTeamMembersQueryOptions(scope, { org, teamSlug: team.slug }),
		enabled: !isSample,
	});
	const [login, setLogin] = useState("");
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);
	const pending = status.kind === "pending";

	async function add() {
		const ok = await run(() =>
			setOrgTeamMember({
				data: { org, teamSlug: team.slug, login: login.trim(), role: "member" },
			}),
		);
		if (ok) setLogin("");
	}

	return (
		<div className="bg-group/40">
			<SettingsReadView
				query={query}
				sample={SAMPLE_ORG_TEAM_MEMBERS}
				forbiddenTitle="Members aren't available"
				forbiddenHint="You can't see who is on this team."
				githubUrl={`https://github.com/orgs/${org}/teams/${team.slug}/members`}
			>
				{(members) => (
					<ul>
						{members.length === 0 ? (
							<li>
								<SettingsEmptyRow>No one is on this team yet.</SettingsEmptyRow>
							</li>
						) : (
							members.map((member) => (
								<li key={member.login}>
									<SettingsListRow className="min-h-10 py-1.5">
										<Avatar className="size-5">
											<AvatarImage src={member.avatarUrl} alt="" />
											<AvatarFallback>
												{member.login.slice(0, 2)}
											</AvatarFallback>
										</Avatar>
										<span className="text-[13px] text-text-strong">
											{member.login}
										</span>
										<span className="ml-auto flex items-center gap-2">
											{canManage ? (
												<>
													<OptionSelect
														value={member.role}
														options={TEAM_ROLE_OPTIONS}
														label={`Role for ${member.login} on ${team.name}`}
														disabled={pending}
														className="w-32"
														onChange={(role) =>
															void run(() =>
																setOrgTeamMember({
																	data: {
																		org,
																		teamSlug: team.slug,
																		login: member.login,
																		role,
																	},
																}),
															)
														}
													/>
													<InlineConfirmButton
														label="Remove"
														ariaLabel={`Remove ${member.login} from ${team.name}`}
														prompt="Remove from team?"
														pending={pending}
														onConfirm={() =>
															void run(() =>
																removeOrgTeamMember({
																	data: {
																		org,
																		teamSlug: team.slug,
																		login: member.login,
																	},
																}),
															)
														}
													/>
												</>
											) : (
												<StatePill tone="muted">
													{member.role === "maintainer"
														? "Maintainer"
														: "Member"}
												</StatePill>
											)}
										</span>
									</SettingsListRow>
								</li>
							))
						)}
					</ul>
				)}
			</SettingsReadView>
			{canManage ? (
				<SettingsListRow className="border-t-[0.5px] border-rule py-2">
					<Input
						aria-label={`Add to ${team.name}`}
						placeholder="GitHub username"
						autoComplete="off"
						value={login}
						className="w-56 max-w-full"
						onChange={(event) => setLogin(event.target.value)}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pending || login.trim() === ""}
						onClick={() => void add()}
					>
						Add member
					</Button>
					<ActionNote status={status} doneLabel="Updated" />
				</SettingsListRow>
			) : null}
		</div>
	);
}

import { PlusSignIcon } from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActionNote } from "#/components/settings/action-note";
import { InlineConfirmButton } from "#/components/settings/inline-confirm";
import {
	SettingsEmptyRow,
	SettingsGroup,
	SettingsListRow,
} from "#/components/settings/settings-group";
import { SettingsReadView } from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import {
	removeRepoCollaborator,
	removeRepoTeam,
	setRepoCollaboratorRole,
	setRepoTeamRole,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoAccessQueryOptions,
} from "#/lib/github.query";
import { collaboratorsEntityKey } from "#/lib/github-query-updates";
import type {
	RepoAccess,
	RepoCollaborator,
	RepoRole,
	RepoTeam,
	TeamOption,
} from "#/lib/settings/access";
import { RoleSelect } from "./role-select";

type RepoProps = { owner: string; repo: string; scope: GitHubQueryScope };

type Composer = "closed" | "open";

export function AccessSettings({ owner, repo, scope }: RepoProps) {
	const query = useQuery(githubRepoAccessQueryOptions(scope, { owner, repo }));

	return (
		<>
			<SettingsHeading
				title="Collaborators & teams"
				description="Who can access this repository, and with which role."
			/>
			<SettingsReadView
				query={query}
				skeletonRows={4}
				forbiddenTitle="Access settings aren't available"
				forbiddenHint="GitHub only shows collaborators to people with admin access."
				githubUrl={`https://github.com/${owner}/${repo}/settings/access`}
			>
				{(access) => (
					<>
						<CollaboratorsGroup
							access={access}
							owner={owner}
							repo={repo}
							scope={scope}
						/>
						{access.teamsAvailable ? (
							<TeamsGroup
								access={access}
								owner={owner}
								repo={repo}
								scope={scope}
							/>
						) : null}
					</>
				)}
			</SettingsReadView>
		</>
	);
}

function CollaboratorsGroup({
	access,
	owner,
	repo,
	scope,
}: RepoProps & { access: RepoAccess }) {
	const [composer, setComposer] = useState<Composer>("closed");
	const [login, setLogin] = useState("");
	const [role, setRole] = useState<RepoRole>("write");
	const { status, run } = useSettingsAction(scope, [
		collaboratorsEntityKey({ owner, repo }),
	]);
	const pending = status.kind === "pending";

	async function add() {
		const ok = await run(() =>
			setRepoCollaboratorRole({
				data: { owner, repo, login: login.trim(), role, invitationId: null },
			}),
		);
		if (ok) {
			setLogin("");
			setComposer("closed");
		}
	}

	return (
		<SettingsGroup
			title="Collaborators"
			description="People invited directly to this repository."
			actions={
				<>
					<ActionNote status={status} doneLabel="Added" />
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setComposer(composer === "open" ? "closed" : "open")}
					>
						<PlusSignIcon size={13} />
						Add people
					</Button>
				</>
			}
		>
			{composer === "open" ? (
				<SettingsListRow className="bg-group/40 py-3">
					<Input
						aria-label="GitHub username"
						placeholder="GitHub username"
						autoComplete="off"
						value={login}
						className="w-56 max-w-full"
						onChange={(event) => setLogin(event.target.value)}
					/>
					<RoleSelect
						value={role}
						label="Role for new collaborator"
						onChange={setRole}
					/>
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={pending || login.trim() === ""}
						onClick={() => void add()}
					>
						{pending ? "Adding…" : "Add"}
					</Button>
				</SettingsListRow>
			) : null}
			{access.collaborators.length === 0 ? (
				<SettingsEmptyRow>No collaborators yet.</SettingsEmptyRow>
			) : (
				access.collaborators.map((collaborator) => (
					<CollaboratorRow
						key={`${collaborator.status}:${collaborator.login}`}
						collaborator={collaborator}
						owner={owner}
						repo={repo}
						scope={scope}
					/>
				))
			)}
		</SettingsGroup>
	);
}

function CollaboratorRow({
	collaborator,
	owner,
	repo,
	scope,
}: RepoProps & { collaborator: RepoCollaborator }) {
	const { status, run } = useSettingsAction(scope, [
		collaboratorsEntityKey({ owner, repo }),
	]);
	const pending = status.kind === "pending";
	const invitationId =
		collaborator.status === "pending" ? collaborator.invitationId : null;
	const isOwner = collaborator.login.toLowerCase() === owner.toLowerCase();

	return (
		<SettingsListRow>
			<Avatar className="size-6">
				<AvatarImage src={collaborator.avatarUrl} alt="" />
				<AvatarFallback>{collaborator.login.slice(0, 2)}</AvatarFallback>
			</Avatar>
			<span className="min-w-0 truncate text-[13px] font-medium text-foreground">
				{collaborator.login}
			</span>
			{collaborator.status === "pending" ? (
				<StatePill tone="warning">Invited</StatePill>
			) : null}
			{isOwner ? <StatePill tone="muted">Owner</StatePill> : null}
			<span className="ml-auto flex items-center gap-2">
				<ActionNote status={status} />
				<RoleSelect
					value={collaborator.role}
					label={`Role for ${collaborator.login}`}
					disabled={pending || isOwner}
					onChange={(next) =>
						void run(() =>
							setRepoCollaboratorRole({
								data: {
									owner,
									repo,
									login: collaborator.login,
									role: next,
									invitationId,
								},
							}),
						)
					}
				/>
				{isOwner ? null : (
					<InlineConfirmButton
						label={invitationId === null ? "Remove" : "Cancel invite"}
						ariaLabel={`${invitationId === null ? "Remove" : "Cancel invitation for"} ${collaborator.login}`}
						prompt={
							invitationId === null ? "Remove access?" : "Cancel invitation?"
						}
						pending={pending}
						onConfirm={() =>
							void run(() =>
								removeRepoCollaborator({
									data: {
										owner,
										repo,
										login: collaborator.login,
										invitationId,
									},
								}),
							)
						}
					/>
				)}
			</span>
		</SettingsListRow>
	);
}

function TeamsGroup({
	access,
	owner,
	repo,
	scope,
}: RepoProps & { access: RepoAccess }) {
	const [composer, setComposer] = useState<Composer>("closed");
	const [teamSlug, setTeamSlug] = useState<string | null>(null);
	const [role, setRole] = useState<RepoRole>("read");
	const { status, run } = useSettingsAction(scope, [
		collaboratorsEntityKey({ owner, repo }),
	]);
	const pending = status.kind === "pending";

	async function add() {
		if (teamSlug === null) return;
		const ok = await run(() =>
			setRepoTeamRole({ data: { owner, repo, teamSlug, role } }),
		);
		if (ok) {
			setTeamSlug(null);
			setComposer("closed");
		}
	}

	return (
		<SettingsGroup
			title="Teams"
			description="Teams in the organization with access to this repository."
			actions={
				<>
					<ActionNote status={status} doneLabel="Team added" />
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={access.addableTeams.length === 0}
						onClick={() => setComposer(composer === "open" ? "closed" : "open")}
					>
						<PlusSignIcon size={13} />
						Add team
					</Button>
				</>
			}
		>
			{composer === "open" ? (
				<SettingsListRow className="bg-group/40 py-3">
					<TeamPicker
						teams={access.addableTeams}
						value={teamSlug}
						onChange={setTeamSlug}
					/>
					<RoleSelect
						value={role}
						label="Role for new team"
						onChange={setRole}
					/>
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={pending || teamSlug === null}
						onClick={() => void add()}
					>
						{pending ? "Adding…" : "Add"}
					</Button>
				</SettingsListRow>
			) : null}
			{access.teams.length === 0 ? (
				<SettingsEmptyRow>No teams have access.</SettingsEmptyRow>
			) : (
				access.teams.map((team) => (
					<TeamRow
						key={team.slug}
						team={team}
						owner={owner}
						repo={repo}
						scope={scope}
					/>
				))
			)}
		</SettingsGroup>
	);
}

function TeamPicker({
	teams,
	value,
	onChange,
}: {
	teams: TeamOption[];
	value: string | null;
	onChange: (slug: string) => void;
}) {
	return (
		<Select value={value ?? undefined} onValueChange={onChange}>
			<SelectTrigger size="sm" aria-label="Team" className="w-48">
				<SelectValue placeholder="Choose a team" />
			</SelectTrigger>
			<SelectContent>
				{teams.map((team) => (
					<SelectItem key={team.slug} value={team.slug}>
						{team.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function TeamRow({ team, owner, repo, scope }: RepoProps & { team: RepoTeam }) {
	const { status, run } = useSettingsAction(scope, [
		collaboratorsEntityKey({ owner, repo }),
	]);
	const pending = status.kind === "pending";

	return (
		<SettingsListRow>
			<span className="min-w-0 truncate text-[13px] font-medium text-foreground">
				{team.name}
			</span>
			<span className="text-xs text-muted-foreground">
				@{owner}/{team.slug}
			</span>
			{team.isSecret ? <StatePill tone="muted">Secret</StatePill> : null}
			<span className="ml-auto flex items-center gap-2">
				<ActionNote status={status} />
				<RoleSelect
					value={team.role}
					label={`Role for ${team.name}`}
					disabled={pending}
					onChange={(next) =>
						void run(() =>
							setRepoTeamRole({
								data: { owner, repo, teamSlug: team.slug, role: next },
							}),
						)
					}
				/>
				<InlineConfirmButton
					label="Remove"
					ariaLabel={`Remove ${team.name}`}
					prompt="Remove team access?"
					pending={pending}
					onConfirm={() =>
						void run(() =>
							removeRepoTeam({ data: { owner, repo, teamSlug: team.slug } }),
						)
					}
				/>
			</span>
		</SettingsListRow>
	);
}

import { PlusSignIcon } from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
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
import {
	cancelOrgInvitation,
	inviteOrgMember,
	removeOrgMember,
	setOrgMemberRole,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubOrgMembersQueryOptions,
} from "#/lib/github.query";
import { orgEntityKey } from "#/lib/github-query-updates";
import {
	type OrgInvitation,
	type OrgMember,
	type OrgMembers,
	type OrgRole,
	parseInvitee,
} from "#/lib/settings/org";
import { useCanManageOrg } from "./org-settings-frame";
import { SAMPLE_ORG_MEMBERS } from "./org-settings-samples";

type OrgProps = { org: string; scope: GitHubQueryScope };

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
	{ value: "admin", label: "Owner" },
	{ value: "member", label: "Member" },
];

type Composer = "closed" | "open";

export function OrgMembersSettings({ org, scope }: OrgProps) {
	const query = useQuery(githubOrgMembersQueryOptions(scope, { org }));
	const canManage = useCanManageOrg(scope, org);

	return (
		<>
			<SettingsHeading
				title="Members"
				description="People in the organization and their roles."
			/>
			<SettingsReadView
				query={query}
				sample={SAMPLE_ORG_MEMBERS}
				forbiddenTitle="Members aren't available"
				forbiddenHint="You need to be a member of this organization."
				githubUrl={`https://github.com/orgs/${org}/people`}
			>
				{(data) => (
					<>
						<MembersGroup
							data={data}
							org={org}
							scope={scope}
							canManage={canManage}
						/>
						{data.invitations.length > 0 ? (
							<InvitationsGroup
								invitations={data.invitations}
								org={org}
								scope={scope}
								canManage={canManage}
							/>
						) : null}
					</>
				)}
			</SettingsReadView>
		</>
	);
}

function MembersGroup({
	data,
	org,
	scope,
	canManage,
}: OrgProps & { data: OrgMembers; canManage: boolean }) {
	const [composer, setComposer] = useState<Composer>("closed");
	const [invitee, setInvitee] = useState("");
	const [role, setRole] = useState<OrgRole>("member");
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);
	const parsed = parseInvitee(invitee);
	const pending = status.kind === "pending";

	async function invite() {
		if (parsed === null) return;
		const ok = await run(() =>
			inviteOrgMember({ data: { org, invitee: parsed, role } }),
		);
		if (ok) {
			setInvitee("");
			setComposer("closed");
		}
	}

	return (
		<SettingsGroup
			title={`${data.members.length} ${data.members.length === 1 ? "member" : "members"}`}
			actions={
				canManage ? (
					<>
						<ActionNote status={status} doneLabel="Invitation sent" />
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								setComposer(composer === "open" ? "closed" : "open")
							}
						>
							<PlusSignIcon size={13} />
							Invite member
						</Button>
					</>
				) : null
			}
		>
			{composer === "open" ? (
				<SettingsListRow className="bg-group/40 py-3">
					<Input
						aria-label="Username or email"
						placeholder="Username or email"
						autoComplete="off"
						value={invitee}
						className="w-64 max-w-full"
						onChange={(event) => setInvitee(event.target.value)}
					/>
					<OptionSelect
						value={role}
						options={ROLE_OPTIONS}
						label="Role for the invitation"
						onChange={setRole}
					/>
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={pending || parsed === null}
						onClick={() => void invite()}
					>
						{pending ? "Sending…" : "Send invitation"}
					</Button>
				</SettingsListRow>
			) : null}
			{data.members.length === 0 ? (
				<SettingsEmptyRow>No members.</SettingsEmptyRow>
			) : (
				data.members.map((member) => (
					<MemberRow
						key={member.login}
						member={member}
						org={org}
						scope={scope}
						canManage={canManage}
					/>
				))
			)}
		</SettingsGroup>
	);
}

function MemberRow({
	member,
	org,
	scope,
	canManage,
}: OrgProps & { member: OrgMember; canManage: boolean }) {
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);
	const pending = status.kind === "pending";

	return (
		<SettingsListRow>
			<Avatar className="size-6">
				<AvatarImage src={member.avatarUrl} alt="" />
				<AvatarFallback>{member.login.slice(0, 2)}</AvatarFallback>
			</Avatar>
			<span className="min-w-0 truncate text-[13px] font-medium text-foreground">
				{member.login}
			</span>
			<span className="ml-auto flex items-center gap-2">
				<ActionNote status={status} />
				{canManage ? (
					<>
						<OptionSelect
							value={member.role}
							options={ROLE_OPTIONS}
							label={`Role for ${member.login}`}
							disabled={pending}
							onChange={(next) =>
								void run(() =>
									setOrgMemberRole({
										data: { org, login: member.login, role: next },
									}),
								)
							}
						/>
						<InlineConfirmButton
							label="Remove"
							ariaLabel={`Remove ${member.login}`}
							prompt="Remove from organization?"
							pending={pending}
							onConfirm={() =>
								void run(() =>
									removeOrgMember({ data: { org, login: member.login } }),
								)
							}
						/>
					</>
				) : (
					<StatePill tone={member.role === "admin" ? "merged" : "muted"}>
						{member.role === "admin" ? "Owner" : "Member"}
					</StatePill>
				)}
			</span>
		</SettingsListRow>
	);
}

function InvitationsGroup({
	invitations,
	org,
	scope,
	canManage,
}: OrgProps & { invitations: OrgInvitation[]; canManage: boolean }) {
	return (
		<SettingsGroup
			title="Pending invitations"
			description="They become members once they accept."
		>
			{invitations.map((invitation) => (
				<InvitationRow
					key={invitation.id}
					invitation={invitation}
					org={org}
					scope={scope}
					canManage={canManage}
				/>
			))}
		</SettingsGroup>
	);
}

function InvitationRow({
	invitation,
	org,
	scope,
	canManage,
}: OrgProps & { invitation: OrgInvitation; canManage: boolean }) {
	const { status, run } = useSettingsAction(scope, [orgEntityKey(org)]);

	return (
		<SettingsListRow>
			<span className="min-w-0 truncate text-[13px] font-medium text-foreground">
				{invitation.label}
			</span>
			<StatePill tone="warning">Invited</StatePill>
			<span className="ml-auto flex items-center gap-2">
				<ActionNote status={status} />
				<StatePill tone="muted">
					{invitation.role === "admin" ? "Owner" : "Member"}
				</StatePill>
				{canManage ? (
					<InlineConfirmButton
						label="Cancel invite"
						ariaLabel={`Cancel invitation for ${invitation.label}`}
						prompt="Cancel invitation?"
						pending={status.kind === "pending"}
						onConfirm={() =>
							void run(() =>
								cancelOrgInvitation({
									data: { org, invitationId: invitation.id },
								}),
							)
						}
					/>
				) : null}
			</span>
		</SettingsListRow>
	);
}

/**
 * Seeds the settings content (see `content/settings.ts`) straight into the
 * store. Runs last, so nothing it adds can shift ids the rest of the workspace
 * already assigned.
 */
import { getGitHubStore, seedFromConfig } from "@emulators/github";
import type { DiffkitEmulator } from "../server.ts";
import { uuidFrom } from "../shims/settings-common.ts";
import { failureStatus } from "../shims/settings-hooks.ts";
import { setTimestamps } from "../store-extras.ts";
import { getSettingsStore } from "../store-settings.ts";
import type { Clock } from "./anchor.ts";
import { settingsContent } from "./content/settings.ts";

function deliveryPayload(
	event: string,
	action: string | null,
	repoFullName: string,
	hookId: number,
) {
	switch (event) {
		case "ping":
			return { zen: "Keep it logically awesome.", hook_id: hookId };
		case "push":
			return {
				ref: "refs/heads/main",
				repository: { full_name: repoFullName },
			};
		default:
			return { action, repository: { full_name: repoFullName } };
	}
}

export function seedSettings(emulator: DiffkitEmulator, clock: Clock) {
	const content = settingsContent;
	const gh = getGitHubStore(emulator.store);
	const settings = getSettingsStore(emulator.store);

	const userId = (login: string) => {
		const user = gh.users.findOneBy("login", login);
		if (!user)
			throw new Error(`settings seed references unknown user ${login}`);
		return user.id;
	};
	const repo = gh.repos.findOneBy("full_name", content.repo);
	const org = gh.orgs.findOneBy("login", content.org);
	if (!repo || !org) throw new Error("settings seed needs its repo and org");

	seedFromConfig(emulator.store, emulator.url, {
		users: [content.invitedUser],
	});
	setTimestamps(
		gh.users.findOneBy("login", content.invitedUser.login),
		clock({ d: 60 }),
		clock({ d: 2 }),
	);

	content.collaborators.forEach((collaborator, index) => {
		const row = gh.collaborators.insert({
			repo_id: repo.id,
			user_id: userId(collaborator.login),
			permission: collaborator.permission,
		});
		setTimestamps(row, clock({ d: 140 - index * 25 }));
	});
	for (const invitation of content.repoInvitations) {
		const row = settings.repoInvitations.insert({
			repo_id: repo.id,
			invitee_id: userId(invitation.login),
			inviter_id: userId(invitation.inviter),
			permissions: invitation.permissions,
		});
		setTimestamps(row, clock(invitation.at));
	}

	for (const teamRole of content.teamRoles) {
		const team = gh.teams
			.findBy("org_id", org.id)
			.find((row) => row.slug === teamRole.slug);
		if (!team) throw new Error(`settings seed: no team ${teamRole.slug}`);
		setTimestamps(
			gh.teamRepos.insert({ team_id: team.id, repo_id: repo.id }),
			clock({ d: 100 }),
		);
		gh.teams.update(team.id, {
			repos_count: gh.teamRepos.findBy("team_id", team.id).length,
		});
		setTimestamps(
			settings.teamRepoRoles.insert({
				team_id: team.id,
				repo_id: repo.id,
				permission: teamRole.permission,
			}),
			clock({ d: 100 }),
		);
	}

	const { protection } = content;
	const branch = gh.branches
		.findBy("repo_id", repo.id)
		.find((row) => row.name === protection.branch);
	if (!branch) throw new Error(`settings seed: no branch ${protection.branch}`);
	setTimestamps(
		gh.branchProtections.insert({
			repo_id: repo.id,
			branch_name: protection.branch,
			required_status_checks: protection.required_status_checks,
			enforce_admins: protection.enforce_admins,
			required_pull_request_reviews: protection.required_pull_request_reviews,
			restrictions: null,
			required_linear_history: protection.required_linear_history,
			allow_force_pushes: protection.allow_force_pushes,
			allow_deletions: protection.allow_deletions,
			required_signatures: protection.required_signatures,
		}),
		clock(protection.at),
	);
	gh.branches.update(branch.id, { protected: true });
	setTimestamps(
		gh.branches.get(branch.id),
		branch.created_at,
		branch.updated_at,
	);
	setTimestamps(
		settings.protectionFlags.insert({
			repo_id: repo.id,
			branch_name: protection.branch,
			required_conversation_resolution:
				protection.required_conversation_resolution,
			lock_branch: protection.lock_branch,
		}),
		clock(protection.at),
	);

	for (const ruleset of content.rulesets) {
		setTimestamps(
			settings.rulesets.insert({
				repo_id: repo.id,
				name: ruleset.name,
				target: ruleset.target,
				enforcement: ruleset.enforcement,
				conditions: {
					ref_name: { include: ruleset.include, exclude: ruleset.exclude },
				},
				rules: structuredClone(ruleset.rules) as never,
				bypass_actors: structuredClone(ruleset.bypass_actors) as never,
			}),
			clock(ruleset.at),
			clock(ruleset.updated),
		);
	}

	for (const secret of content.secrets) {
		setTimestamps(
			gh.secrets.insert({
				repo_id: repo.id,
				org_id: null,
				name: secret.name,
				visibility: "all",
			}),
			clock(secret.at),
		);
	}
	for (const variable of content.variables) {
		setTimestamps(
			settings.variables.insert({
				repo_id: repo.id,
				name: variable.name,
				value: variable.value,
			}),
			clock(variable.at),
		);
	}

	for (const hookSpec of content.hooks) {
		const hook = gh.webhooks.insert({
			repo_id: repo.id,
			org_id: null,
			name: "web",
			active: true,
			events: hookSpec.events,
			config: {
				url: hookSpec.url,
				content_type: "json",
				insecure_ssl: "0",
				...(hookSpec.secret ? { secret: hookSpec.secret } : {}),
			},
			last_response: hookSpec.lastResponse,
		});
		setTimestamps(hook, clock(hookSpec.at), clock({ d: 1 }));
		[...hookSpec.deliveries]
			.sort(
				(a, b) => b.at.d * 24 + (b.at.h ?? 0) - (a.at.d * 24 + (a.at.h ?? 0)),
			)
			.forEach((delivery, index) => {
				const deliveredAt = clock(delivery.at);
				const row = settings.hookDeliveries.insert({
					hook_id: hook.id,
					guid: uuidFrom(`seed:${hook.id}:${index}`),
					delivered_at: deliveredAt,
					redelivery: false,
					duration: delivery.ms,
					status: delivery.code < 400 ? "OK" : failureStatus(delivery.code),
					status_code: delivery.code,
					event: delivery.event,
					action: delivery.action,
					payload: deliveryPayload(
						delivery.event,
						delivery.action,
						content.repo,
						hook.id,
					),
					source_id: null,
				});
				setTimestamps(row, deliveredAt);
			});
	}

	for (const invitation of content.orgInvitations) {
		setTimestamps(
			settings.orgInvitations.insert({
				org_id: org.id,
				login: null,
				email: invitation.email,
				role: invitation.role,
				inviter_id: userId(invitation.inviter),
				team_ids: [],
			}),
			clock(invitation.at),
		);
	}
}

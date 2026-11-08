import { getGitHubStore } from "@emulators/github";
import { Octokit } from "octokit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workspace } from "../seed/content/index.ts";
import { seedTokenFor } from "../seed/identity.ts";
import { seedWorkspace } from "../seed/seed-workspace.ts";
import { createDiffkitEmulator, type DiffkitEmulator } from "../server.ts";
import { getSettingsStore } from "../store-settings.ts";

const ANCHOR = new Date("2026-11-02T17:00:00.000Z");
const BEACON = { owner: "lumen-labs", repo: "beacon" };

let emulator: DiffkitEmulator;

function client(login = "nova") {
	return new Octokit({
		auth: seedTokenFor(login),
		baseUrl: emulator.url,
		retry: { enabled: false },
		throttle: { enabled: false },
	});
}

async function statusOf(request: Promise<unknown>) {
	try {
		await request;
		return 200;
	} catch (error) {
		return (error as { status: number }).status;
	}
}

beforeAll(async () => {
	emulator = await createDiffkitEmulator({ port: 0, persistence: null });
	await seedWorkspace(emulator, workspace, { anchor: ANCHOR });
}, 60_000);

afterAll(async () => {
	await emulator?.close();
});

describe("Actions variables", () => {
	it("upper-cases names, rejects duplicates and caps a page at 30", async () => {
		const octokit = client();
		const repo = { owner: "lumen-labs", repo: "orbit" };
		await octokit.rest.actions.createRepoVariable({
			...repo,
			name: "api_url",
			value: "https://api.example",
		});
		const { data } = await octokit.rest.actions.getRepoVariable({
			...repo,
			name: "API_URL",
		});
		expect(data.name).toBe("API_URL");
		expect(
			await statusOf(
				octokit.rest.actions.createRepoVariable({
					...repo,
					name: "Api_Url",
					value: "x",
				}),
			),
		).toBe(409);
		expect(
			await statusOf(
				octokit.rest.actions.createRepoVariable({
					...repo,
					name: "GITHUB_TOKEN",
					value: "x",
				}),
			),
		).toBe(422);

		for (let index = 0; index < 34; index++) {
			await octokit.rest.actions.createRepoVariable({
				...repo,
				name: `BULK_${String(index).padStart(2, "0")}`,
				value: String(index),
			});
		}
		const page = await octokit.rest.actions.listRepoVariables({
			...repo,
			per_page: 100,
		});
		expect(page.data.total_count).toBe(35);
		expect(page.data.variables).toHaveLength(30);
		expect(page.headers.link).toContain('rel="next"');
		const all = await octokit.paginate(octokit.rest.actions.listRepoVariables, {
			...repo,
			per_page: 30,
		});
		expect(all).toHaveLength(35);
	});

	it("renames and updates a variable in place", async () => {
		const octokit = client();
		const repo = { owner: "lumen-labs", repo: "handbook" };
		await octokit.rest.actions.createRepoVariable({
			...repo,
			name: "OLD",
			value: "1",
		});
		// octokit reuses `name` for both the path and the body, so rename by hand.
		await octokit.request(
			"PATCH /repos/{owner}/{repo}/actions/variables/{variable}",
			{ ...repo, variable: "old", name: "newer", value: "2" },
		);
		const { data } = await octokit.rest.actions.getRepoVariable({
			...repo,
			name: "NEWER",
		});
		expect(data).toMatchObject({ name: "NEWER", value: "2" });
		expect(
			await statusOf(
				octokit.rest.actions.getRepoVariable({ ...repo, name: "OLD" }),
			),
		).toBe(404);
	});
});

describe("Actions secrets", () => {
	it("serves a real X25519 key and requires an encrypted value", async () => {
		const octokit = client();
		const { data: key } = await octokit.rest.actions.getRepoPublicKey(BEACON);
		expect(Buffer.from(key.key, "base64")).toHaveLength(32);
		expect(key.key_id).toMatch(/^\d+$/u);

		expect(
			await statusOf(
				octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{name}", {
					...BEACON,
					name: "deploy_key",
					key_id: key.key_id,
				}),
			),
		).toBe(422);
		const created = await octokit.rest.actions.createOrUpdateRepoSecret({
			...BEACON,
			secret_name: "deploy_key",
			encrypted_value: Buffer.from("sealed").toString("base64"),
			key_id: key.key_id,
		});
		expect(created.status).toBe(201);
		const updated = await octokit.rest.actions.createOrUpdateRepoSecret({
			...BEACON,
			secret_name: "DEPLOY_KEY",
			encrypted_value: Buffer.from("sealed again").toString("base64"),
			key_id: key.key_id,
		});
		expect(updated.status).toBe(204);
		const { data } = await octokit.rest.actions.listRepoSecrets(BEACON);
		expect(data.secrets.map((secret) => secret.name)).toEqual(
			expect.arrayContaining(["DEPLOY_KEY", "NPM_TOKEN"]),
		);
	});
});

describe("collaborators and invitations", () => {
	it("invites an outsider (201) but updates an existing collaborator (204)", async () => {
		const octokit = client();
		const repo = { owner: "lumen-labs", repo: "orbit" };
		const invited = await octokit.rest.repos.addCollaborator({
			...repo,
			username: "theo-martin",
			permission: "push",
		});
		expect(invited.status).toBe(201);
		const { data: invitations } =
			await octokit.rest.repos.listInvitations(repo);
		expect(invitations).toHaveLength(1);
		expect(invitations[0]).toMatchObject({
			invitee: { login: "theo-martin" },
			inviter: { login: "nova" },
			permissions: "write",
		});

		const raised = await octokit.rest.repos.updateInvitation({
			...repo,
			invitation_id: invitations[0].id,
			permissions: "maintain",
		});
		expect(raised.data.permissions).toBe("maintain");
		await octokit.rest.repos.deleteInvitation({
			...repo,
			invitation_id: invitations[0].id,
		});
		expect((await octokit.rest.repos.listInvitations(repo)).data).toHaveLength(
			0,
		);

		const member = await octokit.rest.repos.addCollaborator({
			...BEACON,
			username: "lena-fischer",
			permission: "push",
		});
		expect(member.status).toBe(204);
		const direct = await octokit.paginate(
			octokit.rest.repos.listCollaborators,
			{
				...BEACON,
				affiliation: "direct",
			},
		);
		const roles = Object.fromEntries(
			direct.map((user) => [user.login, user.role_name]),
		);
		expect(roles).toMatchObject({
			"lena-fischer": "write",
			"jun-park": "maintain",
			"sam-okafor": "admin",
			"theo-martin": "write",
		});
	});

	it("keeps the seeded pending invitation for an outsider", async () => {
		const { data } = await client().rest.repos.listInvitations(BEACON);
		expect(data.map((invitation) => invitation.invitee?.login)).toEqual([
			"mika-tanaka",
		]);
	});
});

describe("webhooks", () => {
	it("masks the secret and merges only the config keys that were sent", async () => {
		const octokit = client();
		const hooks = await octokit.paginate(
			octokit.rest.repos.listWebhooks,
			BEACON,
		);
		expect(hooks.map((hook) => hook.last_response.code)).toEqual([200, 500]);
		const healthy = hooks[0];
		expect(healthy.config.secret).toBe("********");

		const { data } = await octokit.rest.repos.updateWebhookConfigForRepo({
			...BEACON,
			hook_id: healthy.id,
			content_type: "form",
		});
		expect(data).toMatchObject({
			content_type: "form",
			url: healthy.config.url,
			secret: "********",
		});
		const stored = getGitHubStore(emulator.store).webhooks.get(healthy.id);
		expect(stored?.config.secret).toBe("demo-webhook-secret");

		await octokit.rest.repos.updateWebhookConfigForRepo({
			...BEACON,
			hook_id: healthy.id,
			secret: "rotated",
		});
		expect(
			getGitHubStore(emulator.store).webhooks.get(healthy.id)?.config,
		).toMatchObject({ secret: "rotated", content_type: "form" });
	});

	it("records a redelivery as a new row with the original's guid", async () => {
		const octokit = client();
		const failing = (await octokit.rest.repos.listWebhooks(BEACON)).data[1];
		const before = (
			await octokit.rest.repos.listWebhookDeliveries({
				...BEACON,
				hook_id: failing.id,
				per_page: 100,
			})
		).data;
		expect(before.every((delivery) => !delivery.redelivery)).toBe(true);
		const original = before.find((delivery) => delivery.status_code === 500);
		if (!original) throw new Error("expected a failed delivery in the seed");

		const response = await octokit.rest.repos.redeliverWebhookDelivery({
			...BEACON,
			hook_id: failing.id,
			delivery_id: original.id,
		});
		expect(response.status).toBe(202);
		const after = (
			await octokit.rest.repos.listWebhookDeliveries({
				...BEACON,
				hook_id: failing.id,
				per_page: 100,
			})
		).data;
		expect(after).toHaveLength(before.length + 1);
		expect(after[0]).toMatchObject({
			redelivery: true,
			guid: original.guid,
			event: original.event,
			status_code: 500,
		});

		const detail = await octokit.rest.repos.getWebhookDelivery({
			...BEACON,
			hook_id: failing.id,
			delivery_id: after[0].id,
		});
		expect(detail.data.request.headers).toMatchObject({
			"X-GitHub-Delivery": original.guid,
		});
	});
});

describe("rulesets and branch protection", () => {
	it("returns summaries and a detail with conditions, rules and bypass actors", async () => {
		const octokit = client();
		const summaries = await octokit.paginate(
			octokit.rest.repos.getRepoRulesets,
			BEACON,
		);
		expect(
			summaries.map((ruleset) => [ruleset.target, ruleset.enforcement]),
		).toEqual([
			["branch", "active"],
			["tag", "evaluate"],
		]);
		expect(summaries[0]._links?.html?.href).toContain("/rules/");

		const { data } = await octokit.rest.repos.getRepoRuleset({
			...BEACON,
			ruleset_id: summaries[0].id,
		});
		expect(data.conditions?.ref_name).toEqual({
			include: ["~DEFAULT_BRANCH"],
			exclude: [],
		});
		const pullRequest = data.rules?.find(
			(rule) => rule.type === "pull_request",
		);
		expect(pullRequest).toMatchObject({
			parameters: { required_approving_review_count: 2 },
		});
		expect(data.rules?.map((rule) => rule.type)).toEqual(
			expect.arrayContaining([
				"required_status_checks",
				"non_fast_forward",
				"deletion",
			]),
		);
		expect(data.bypass_actors).toHaveLength(1);
	});

	it("applies only active rulesets whose ref patterns match the branch", async () => {
		const octokit = client();
		const onDefault = await octokit.request(
			"GET /repos/{owner}/{repo}/rules/branches/{branch}",
			{ ...BEACON, branch: "main" },
		);
		expect(onDefault.data.map((rule: { type: string }) => rule.type)).toContain(
			"pull_request",
		);
		const elsewhere = await octokit.request(
			"GET /repos/{owner}/{repo}/rules/branches/{branch}",
			{ ...BEACON, branch: "feat/sse-headers" },
		);
		expect(elsewhere.data).toEqual([]);
	});

	it("lists only protected branches and answers 404 for unprotected ones", async () => {
		const octokit = client();
		const protectedBranches = await octokit.rest.repos.listBranches({
			...BEACON,
			protected: true,
		});
		expect(protectedBranches.data.map((branch) => branch.name)).toEqual([
			"main",
		]);
		expect(protectedBranches.data[0].protected).toBe(true);

		const { data } = await octokit.rest.repos.getBranchProtection({
			...BEACON,
			branch: "main",
		});
		expect(data.required_conversation_resolution?.enabled).toBe(true);
		expect(data.required_linear_history?.enabled).toBe(true);
		expect(data.allow_force_pushes?.enabled).toBe(false);
		expect(data.required_pull_request_reviews).toMatchObject({
			dismiss_stale_reviews: true,
		});

		const unprotected = await octokit.rest.repos
			.getBranchProtection({ ...BEACON, branch: "feat/sse-headers" })
			.catch((error: { status: number; message: string }) => error);
		expect(unprotected).toMatchObject({
			status: 404,
			message: expect.stringContaining("Branch not protected"),
		});
	});
});

describe("repository settings", () => {
	it("rejects a default branch that does not exist and persists allow_update_branch", async () => {
		const octokit = client();
		const repo = { owner: "lumen-labs", repo: "handbook" };
		expect(
			await statusOf(
				octokit.rest.repos.update({ ...repo, default_branch: "nope" }),
			),
		).toBe(422);
		await octokit.rest.repos.update({
			...repo,
			allow_update_branch: true,
		} as never);
		const { data } = await octokit.rest.repos.get(repo);
		expect(data).toMatchObject({
			allow_update_branch: true,
			default_branch: "main",
			permissions: { admin: true },
		});
		expect(
			await statusOf(
				client("jun-park").rest.repos.update({ ...repo, description: "x" }),
			),
		).toBe(403);
	});

	it("deletes the repository together with its settings data", async () => {
		const octokit = client();
		const created = await octokit.rest.repos.createInOrg({
			org: "lumen-labs",
			name: "scratch",
		});
		const repo = { owner: "lumen-labs", repo: "scratch" };
		await octokit.rest.actions.createRepoVariable({
			...repo,
			name: "A",
			value: "1",
		});
		await octokit.rest.repos.createWebhook({
			...repo,
			config: { url: "http://127.0.0.1:9/hook" },
		});
		await octokit.rest.repos.addCollaborator({
			...repo,
			username: "theo-martin",
		});
		const settings = getSettingsStore(emulator.store);
		expect(settings.variables.findBy("repo_id", created.data.id)).toHaveLength(
			1,
		);
		expect(
			settings.repoInvitations.findBy("repo_id", created.data.id),
		).toHaveLength(1);

		const removed = await octokit.rest.repos.delete(repo);
		expect(removed.status).toBe(204);
		expect(await statusOf(octokit.rest.repos.get(repo))).toBe(404);
		expect(settings.variables.findBy("repo_id", created.data.id)).toHaveLength(
			0,
		);
		expect(
			settings.repoInvitations.findBy("repo_id", created.data.id),
		).toHaveLength(0);
	});
});

describe("organization settings", () => {
	it("keeps owners to the Members team, whatever team roles say", async () => {
		const octokit = client();
		const org = "lumen-labs";
		await octokit.rest.teams.addOrUpdateMembershipForUserInOrg({
			org,
			team_slug: "runtime",
			username: "lena-fischer",
			role: "maintainer",
		});
		const { data: lena } = await octokit.rest.orgs.getMembershipForUser({
			org,
			username: "lena-fischer",
		});
		expect(lena.role).toBe("member");
		const owners = await octokit.rest.orgs.listMembers({ org, role: "admin" });
		expect(owners.data.map((user) => user.login).sort()).toEqual([
			"nova",
			"sam-okafor",
		]);

		await octokit.rest.orgs.setMembershipForUser({
			org,
			username: "priya-rao",
			role: "admin",
		});
		const { data: priya } = await octokit.rest.orgs.getMembershipForUser({
			org,
			username: "priya-rao",
		});
		expect(priya.role).toBe("admin");
		await octokit.rest.orgs.setMembershipForUser({
			org,
			username: "priya-rao",
			role: "member",
		});

		const mine = await octokit.rest.orgs.getMembershipForAuthenticatedUser({
			org,
		});
		expect(mine.data).toMatchObject({ role: "admin", state: "active" });
		expect(
			await statusOf(
				client("jun-park").rest.orgs.update({ org, description: "x" }),
			),
		).toBe(403);
	});

	it("counts members and repositories on teams and hands out pending invitations", async () => {
		const octokit = client();
		const org = "lumen-labs";
		const { data: team } = await octokit.rest.teams.getByName({
			org,
			team_slug: "runtime",
		});
		expect(team).toMatchObject({ members_count: 3, repos_count: 1 });
		const teams = await octokit.paginate(octokit.rest.teams.list, { org });
		expect(
			teams.find((entry) => entry.slug === "design-systems"),
		).toMatchObject({
			members_count: 2,
			repos_count: 1,
		});

		const invitations = await octokit.rest.orgs.listPendingInvitations({ org });
		expect(invitations.data.map((invitation) => invitation.email)).toEqual([
			"casey@partner.example",
		]);
		const created = await octokit.rest.orgs.createInvitation({
			org,
			email: "ops@partner.example",
			role: "billing_manager",
		});
		expect(created.status).toBe(201);
		expect(
			await statusOf(
				octokit.rest.orgs.createInvitation({
					org,
					email: "ops@partner.example",
				}),
			),
		).toBe(422);
		await octokit.rest.orgs.cancelInvitation({
			org,
			invitation_id: created.data.id,
		});
	});
});

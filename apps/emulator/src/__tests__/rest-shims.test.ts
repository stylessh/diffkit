import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { getGitHubStore } from "@emulators/github";
import { unzipSync } from "fflate";
import { Octokit } from "octokit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workspace } from "../seed/content/index.ts";
import {
	DEMO_GITHUB_APP,
	DEMO_OAUTH_APP,
	seedTokenFor,
} from "../seed/identity.ts";
import { seedWorkspace } from "../seed/seed-workspace.ts";
import { createDiffkitEmulator, type DiffkitEmulator } from "../server.ts";

const ANCHOR = new Date("2026-11-02T17:00:00.000Z");

type Delivery = { event: string; signature: string; body: string };

let emulator: DiffkitEmulator;
let hookServer: Server;
const deliveries: Delivery[] = [];

function client(login = "nova") {
	return new Octokit({
		auth: seedTokenFor(login),
		baseUrl: emulator.url,
		retry: { enabled: false },
		throttle: { enabled: false },
	});
}

beforeAll(async () => {
	hookServer = createServer((request, response) => {
		let body = "";
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => {
			deliveries.push({
				event: String(request.headers["x-github-event"]),
				signature: String(request.headers["x-hub-signature-256"]),
				body,
			});
			response.end("ok");
		});
	});
	await new Promise<void>((resolve) => hookServer.listen(0, resolve));
	const address = hookServer.address();
	const hookPort = typeof address === "object" && address ? address.port : 0;

	emulator = await createDiffkitEmulator({
		port: 0,
		persistence: null,
		dashboardUrl: `http://localhost:${hookPort}`,
	});
	await seedWorkspace(emulator, workspace, { anchor: ANCHOR });
}, 60_000);

afterAll(async () => {
	await emulator?.close();
	await new Promise<void>((resolve) => hookServer.close(() => resolve()));
});

describe("REST shims", () => {
	it("lists the viewer's app installations for the org and the user", async () => {
		const { data } = await client().request("GET /user/installations");
		const accounts = data.installations.map((installation) =>
			installation.account && "login" in installation.account
				? installation.account.login
				: null,
		);
		expect(accounts.sort()).toEqual(["lumen-labs", "nova"]);
	});

	it("serves seeded notifications and marks threads read", async () => {
		const octokit = client();
		const { data } =
			await octokit.rest.activity.listNotificationsForAuthenticatedUser();
		expect(data.length).toBeGreaterThan(3);
		expect(data.every((thread) => thread.unread)).toBe(true);
		await octokit.rest.activity.markThreadAsRead({
			thread_id: Number(data[0].id),
		});
		const after =
			await octokit.rest.activity.listNotificationsForAuthenticatedUser();
		expect(after.data.map((thread) => thread.id)).not.toContain(data[0].id);
	});

	it("returns real PR files and only the PR's own commits", async () => {
		const octokit = client();
		const pulls = await octokit.rest.pulls.list({
			owner: "lumen-labs",
			repo: "beacon",
			head: "lumen-labs:feat/sse-headers",
		});
		const number = pulls.data[0].number;
		const files = await octokit.rest.pulls.listFiles({
			owner: "lumen-labs",
			repo: "beacon",
			pull_number: number,
		});
		expect(files.data.map((file) => file.filename).sort()).toEqual([
			"README.md",
			"src/transport/sse.ts",
		]);
		const commits = await octokit.rest.pulls.listCommits({
			owner: "lumen-labs",
			repo: "beacon",
			pull_number: number,
		});
		expect(commits.data).toHaveLength(2);
	});

	it("serves Actions logs as a GitHub-style zip", async () => {
		const gh = getGitHubStore(emulator.store);
		const run = gh.workflowRuns
			.all()
			.find((row) => row.conclusion === "failure");
		if (!run) throw new Error("expected a failed run in the seed");
		const repo = gh.repos.get(run.repo_id);
		const response = await fetch(
			`${emulator.url}/repos/${repo?.full_name}/actions/runs/${run.id}/logs`,
			{ headers: { Authorization: `token ${seedTokenFor("nova")}` } },
		);
		expect(response.headers.get("content-type")).toBe("application/zip");
		const files = Object.keys(
			unzipSync(new Uint8Array(await response.arrayBuffer())),
		);
		expect(files.some((name) => /^\d+_lint\.txt$/u.test(name))).toBe(true);
		expect(files.some((name) => /^lint\/\d+_.+\.txt$/u.test(name))).toBe(true);
	});

	it("answers /users/<org> like GitHub", async () => {
		const { data } = await client().rest.users.getByUsername({
			username: "lumen-labs",
		});
		expect(data.type).toBe("Organization");
	});

	it("serves GET /issues/:n for pull requests", async () => {
		const { data } = await client().rest.issues.get({
			owner: "lumen-labs",
			repo: "beacon",
			issue_number: 15,
		});
		expect(data.pull_request).toBeTruthy();
	});
});

describe("webhooks", () => {
	it("delivers signed events the dashboard can verify", async () => {
		await client("jun-park").rest.issues.createComment({
			owner: "lumen-labs",
			repo: "beacon",
			issue_number: 13,
			body: "Webhook check",
		});
		const deadline = Date.now() + 5000;
		let delivery: Delivery | undefined;
		while (!delivery && Date.now() < deadline) {
			delivery = deliveries.find((entry) => entry.event === "issue_comment");
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		expect(delivery).toBeDefined();
		const expected = `sha256=${createHmac(
			"sha256",
			DEMO_GITHUB_APP.webhookSecret,
		)
			.update(delivery?.body ?? "")
			.digest("hex")}`;
		expect(delivery?.signature).toBe(expected);
		expect(JSON.parse(delivery?.body ?? "{}").installation?.id).toBe(7001);
	});

	it("notifies other participants when someone comments", async () => {
		const { data } =
			await client(
				"nova",
			).rest.activity.listNotificationsForAuthenticatedUser();
		expect(
			data.some(
				(thread) =>
					thread.subject.title === "Listeners are never released after close()",
			),
		).toBe(true);
	});
});

describe(".dev.vars.demo", () => {
	it("matches the emulator's seeded credentials", () => {
		const text = readFileSync(
			new URL("../../../dashboard/.dev.vars.demo", import.meta.url),
			"utf8",
		);
		const vars = Object.fromEntries(
			text
				.split("\n")
				.filter((line) => /^[A-Z_]+=/u.test(line))
				.map((line) => {
					const index = line.indexOf("=");
					return [
						line.slice(0, index),
						line.slice(index + 1).replace(/^"|"$/gu, ""),
					];
				}),
		);
		expect(vars.GITHUB_OAUTH_CLIENT_ID).toBe(DEMO_OAUTH_APP.clientId);
		expect(vars.GITHUB_OAUTH_CLIENT_SECRET).toBe(DEMO_OAUTH_APP.clientSecret);
		expect(vars.GITHUB_APP_ID).toBe(String(DEMO_GITHUB_APP.appId));
		expect(vars.GITHUB_APP_SLUG).toBe(DEMO_GITHUB_APP.slug);
		expect(vars.GITHUB_APP_CLIENT_ID).toBe(DEMO_GITHUB_APP.clientId);
		expect(vars.GITHUB_APP_CLIENT_SECRET).toBe(DEMO_GITHUB_APP.clientSecret);
		expect(vars.GITHUB_WEBHOOK_SECRET).toBe(DEMO_GITHUB_APP.webhookSecret);
		expect(vars.GITHUB_APP_PRIVATE_KEY).toBeUndefined();
	});
});

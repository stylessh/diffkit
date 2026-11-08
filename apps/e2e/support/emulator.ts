import { createHmac } from "node:crypto";
import { dashboardUrl, demoVar, emulatorUrl } from "./endpoints.ts";

function seedTokenFor(login: string) {
	return `demo_seed_${login.replaceAll("-", "_")}`;
}

async function control(action: "checkpoint" | "reset") {
	const response = await fetch(`${emulatorUrl}/_diffkit/e2e/${action}`, {
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(`emulator ${action} failed: ${response.status}`);
	}
}

export const emulator = {
	checkpoint: () => control("checkpoint"),
	reset: () => control("reset"),

	async rest<T = unknown>(
		login: string,
		method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
		path: string,
		body?: unknown,
	): Promise<T> {
		const response = await fetch(`${emulatorUrl}${path}`, {
			method,
			headers: {
				authorization: `token ${seedTokenFor(login)}`,
				"content-type": "application/json",
				accept: "application/vnd.github+json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!response.ok) {
			throw new Error(
				`${method} ${path} as ${login}: ${response.status} ${await response.text()}`,
			);
		}
		return (response.status === 204 ? undefined : await response.json()) as T;
	},
};

export function postWebhook(
	event: string,
	payload: unknown,
	options: { secret?: string } = {},
) {
	const body = JSON.stringify(payload);
	const signature = createHmac(
		"sha256",
		options.secret ?? demoVar("GITHUB_WEBHOOK_SECRET"),
	)
		.update(body)
		.digest("hex");
	return fetch(`${dashboardUrl}/api/webhooks/github`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-github-event": event,
			"x-github-delivery": crypto.randomUUID(),
			"x-hub-signature-256": `sha256=${signature}`,
		},
		body,
	});
}

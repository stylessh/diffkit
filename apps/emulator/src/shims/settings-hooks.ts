/**
 * Repository webhooks beyond emulate's CRUD: masked secrets, partial config
 * updates, pings and a persistent delivery history with redelivery.
 *
 * Pings and redeliveries are recorded, never sent: the emulator makes no
 * outbound requests for them. A hook's health is its `last_response`.
 */
import type { Next } from "@emulators/core";
import type { GitHubRepo, GitHubWebhook } from "@emulators/github";
import type { ShimContext } from "../server.ts";
import type { HookDeliveryRow } from "../store-settings.ts";
import { notFound, type ShimRequestContext } from "./common.ts";
import {
	fail,
	guardRepo,
	invalidField,
	isResponse,
	pageWithLinks,
	passThrough,
	readBody,
	settingsStores,
	uuidFrom,
	wrap,
} from "./settings-common.ts";

const MASK = "********";

type HookJson = { id: number; config: Record<string, unknown> };

export function failureStatus(code: number) {
	return `Invalid HTTP Response: ${code}`;
}

export function registerHookShims(context: ShimContext) {
	const { app, baseUrl } = context;

	const maskSecret = (hook: HookJson) => {
		const secret = settingsStores(context).gh.webhooks.get(hook.id)?.config
			.secret;
		return secret
			? { ...hook, config: { ...hook.config, secret: MASK } }
			: hook;
	};
	const maskSecrets = async (c: ShimRequestContext, next: Next) => {
		await passThrough<HookJson | HookJson[]>(c, next, (data) =>
			Array.isArray(data) ? data.map(maskSecret) : maskSecret(data),
		);
		return undefined;
	};
	wrap(context, "GET", "/repos/:owner/:repo/hooks", maskSecrets);
	wrap(context, "POST", "/repos/:owner/:repo/hooks", maskSecrets);
	wrap(context, "GET", "/repos/:owner/:repo/hooks/:hook_id", maskSecrets);
	wrap(context, "PATCH", "/repos/:owner/:repo/hooks/:hook_id", maskSecrets);

	const findHook = (repo: GitHubRepo, id: string) => {
		const hook = settingsStores(context).gh.webhooks.get(Number(id));
		return hook?.repo_id === repo.id ? hook : undefined;
	};

	const configJson = (hook: GitHubWebhook) => ({
		content_type: hook.config.content_type,
		insecure_ssl: hook.config.insecure_ssl,
		url: hook.config.url,
		...(hook.config.secret ? { secret: MASK } : {}),
	});

	app.get("/repos/:owner/:repo/hooks/:hook_id/config", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const hook = findHook(repo, c.req.param("hook_id"));
		return hook ? c.json(configJson(hook)) : notFound(c);
	});

	app.patch("/repos/:owner/:repo/hooks/:hook_id/config", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const hook = findHook(repo, c.req.param("hook_id"));
		if (!hook) {
			return notFound(c);
		}
		const body = await readBody(c);
		const config = { ...hook.config };
		if ("url" in body) {
			if (typeof body.url !== "string" || !body.url.trim()) {
				return invalidField(c, "WebHook", "url");
			}
			config.url = body.url.trim();
		}
		if (typeof body.content_type === "string" && body.content_type) {
			config.content_type = body.content_type;
		}
		if ("insecure_ssl" in body) {
			config.insecure_ssl = [true, 1, "1"].includes(body.insecure_ssl as never)
				? "1"
				: "0";
		}
		if ("secret" in body) {
			if (typeof body.secret === "string" && body.secret) {
				config.secret = body.secret;
			} else {
				delete config.secret;
			}
		}
		const { gh } = settingsStores(context);
		const updated = gh.webhooks.update(hook.id, { config });
		if (updated) {
			context.webhooks.updateSubscription(hook.id, {
				url: config.url,
				secret: config.secret,
			});
		}
		return c.json(configJson(updated ?? hook));
	});

	const syncLiveDeliveries = (hook: GitHubWebhook) => {
		const { settings } = settingsStores(context);
		const known = new Set(
			settings.hookDeliveries
				.findBy("hook_id", hook.id)
				.map((row) => row.source_id),
		);
		for (const live of context.webhooks.getDeliveries(hook.id)) {
			if (known.has(live.id)) {
				continue;
			}
			const row = settings.hookDeliveries.insert({
				hook_id: hook.id,
				guid: uuidFrom(`live:${hook.id}:${live.id}`),
				delivered_at: live.delivered_at,
				redelivery: live.redelivery_of !== undefined,
				duration: live.duration ?? 0,
				status: live.success
					? "OK"
					: live.status_code
						? failureStatus(live.status_code)
						: "failed to connect to host",
				status_code: live.status_code ?? 0,
				event: live.event,
				action: live.action ?? null,
				payload: (live.payload ?? {}) as Record<string, unknown>,
				source_id: live.id,
			});
			row.created_at = live.delivered_at;
		}
	};

	const deliverySummary = (repo: GitHubRepo, row: HookDeliveryRow) => ({
		id: row.id,
		guid: row.guid,
		delivered_at: row.delivered_at,
		redelivery: row.redelivery,
		duration: row.duration,
		status: row.status,
		status_code: row.status_code,
		event: row.event,
		action: row.action,
		installation_id: null,
		repository_id: repo.id,
		throttled_at: null,
	});

	app.get("/repos/:owner/:repo/hooks/:hook_id/deliveries", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const hook = findHook(repo, c.req.param("hook_id"));
		if (!hook) {
			return notFound(c);
		}
		syncLiveDeliveries(hook);
		const rows = settingsStores(context)
			.settings.hookDeliveries.findBy("hook_id", hook.id)
			.sort(
				(a, b) => b.delivered_at.localeCompare(a.delivered_at) || b.id - a.id,
			);
		return c.json(
			pageWithLinks(c, rows).map((row) => deliverySummary(repo, row)),
		);
	});

	app.get("/repos/:owner/:repo/hooks/:hook_id/deliveries/:delivery_id", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const hook = findHook(repo, c.req.param("hook_id"));
		if (!hook) {
			return notFound(c);
		}
		syncLiveDeliveries(hook);
		const row = settingsStores(context).settings.hookDeliveries.get(
			Number(c.req.param("delivery_id")),
		);
		if (row?.hook_id !== hook.id) {
			return notFound(c);
		}
		return c.json({
			...deliverySummary(repo, row),
			url: `${baseUrl}/repos/${repo.full_name}/hooks/${hook.id}/deliveries/${row.id}`,
			request: {
				headers: {
					"Content-Type":
						hook.config.content_type === "form"
							? "application/x-www-form-urlencoded"
							: "application/json",
					"User-Agent": "GitHub-Hookshot/emulate",
					"X-GitHub-Delivery": row.guid,
					"X-GitHub-Event": row.event,
					"X-GitHub-Hook-ID": String(hook.id),
				},
				payload: row.payload,
			},
			response: {
				headers: { "Content-Type": "text/plain; charset=utf-8" },
				payload: row.status_code < 400 ? "ok" : "Internal Server Error",
			},
		});
	});

	const recordDelivery = (
		hook: GitHubWebhook,
		delivery: Pick<
			HookDeliveryRow,
			"guid" | "redelivery" | "event" | "action" | "payload" | "duration"
		>,
	) => {
		const { gh, settings } = settingsStores(context);
		const failing =
			hook.last_response.code !== null && hook.last_response.code >= 400;
		const statusCode = failing ? (hook.last_response.code ?? 500) : 200;
		const row = settings.hookDeliveries.insert({
			...delivery,
			hook_id: hook.id,
			delivered_at: new Date().toISOString(),
			status: failing ? failureStatus(statusCode) : "OK",
			status_code: statusCode,
			source_id: null,
		});
		gh.webhooks.update(hook.id, {
			last_response: failing
				? {
						code: statusCode,
						status: "misconfigured",
						message: failureStatus(statusCode),
					}
				: { code: 200, status: "active", message: "OK" },
		});
		return row;
	};

	app.post("/repos/:owner/:repo/hooks/:hook_id/pings", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const hook = findHook(repo, c.req.param("hook_id"));
		if (!hook) {
			return notFound(c);
		}
		const count = settingsStores(context).settings.hookDeliveries.findBy(
			"hook_id",
			hook.id,
		).length;
		recordDelivery(hook, {
			guid: uuidFrom(`ping:${hook.id}:${count}`),
			redelivery: false,
			event: "ping",
			action: null,
			payload: { zen: "Keep it logically awesome.", hook_id: hook.id },
			duration: 0.18,
		});
		return c.body(null, 204);
	});

	app.post(
		"/repos/:owner/:repo/hooks/:hook_id/deliveries/:delivery_id/attempts",
		(c) => {
			const repo = guardRepo(context, c, "admin");
			if (isResponse(repo)) {
				return repo;
			}
			const hook = findHook(repo, c.req.param("hook_id"));
			const original = settingsStores(context).settings.hookDeliveries.get(
				Number(c.req.param("delivery_id")),
			);
			if (!hook || original?.hook_id !== hook.id) {
				return fail(c, 404, "Not Found");
			}
			recordDelivery(hook, {
				guid: original.guid,
				redelivery: true,
				event: original.event,
				action: original.action,
				payload: original.payload,
				duration: original.duration,
			});
			return c.json({}, 202);
		},
	);
}

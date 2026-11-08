import { describe, expect, it } from "vitest";
import {
	createWebhookBody,
	draftFromWebhook,
	emptyWebhookDraft,
	eventsFromSelection,
	mapWebhook,
	selectionFromEvents,
	updateWebhookBody,
	validateWebhookDraft,
	webhookConfig,
} from "./webhooks";

describe("mapWebhook", () => {
	const base = {
		id: 1,
		active: true,
		events: ["push"],
		config: { url: "https://x.dev/hook", content_type: "json" },
	};

	it("reads GitHub's masked secret as 'has a secret'", () => {
		expect(
			mapWebhook({ ...base, config: { ...base.config, secret: "********" } })
				.hasSecret,
		).toBe(true);
		expect(mapWebhook(base).hasSecret).toBe(false);
	});

	it("classifies the last delivery", () => {
		expect(
			mapWebhook({ ...base, last_response: { code: null } }).health,
		).toEqual({ kind: "unused" });
		expect(
			mapWebhook({ ...base, last_response: { code: 204, status: "active" } })
				.health,
		).toEqual({ kind: "ok", code: 204 });
		expect(
			mapWebhook({
				...base,
				last_response: { code: 500, status: "active", message: "Bad" },
			}).health,
		).toEqual({ kind: "failing", code: 500, message: "Bad" });
	});
});

describe("event selection", () => {
	it("round-trips the three modes through GitHub's event list", () => {
		for (const events of [["*"], ["push"], ["push", "issues"]]) {
			expect(eventsFromSelection(selectionFromEvents(events))).toEqual(events);
		}
		expect(selectionFromEvents(["pull_request"])).toEqual({
			kind: "custom",
			events: ["pull_request"],
		});
	});
});

describe("webhook payloads", () => {
	const draft = {
		...emptyWebhookDraft(),
		url: " https://x.dev/hook ",
		selection: { kind: "all" } as const,
	};

	it("omits an empty secret so an edit keeps the stored one", () => {
		expect(webhookConfig(draft)).toEqual({
			url: "https://x.dev/hook",
			content_type: "json",
			insecure_ssl: "0",
		});
		expect(webhookConfig({ ...draft, secret: "s" })).toMatchObject({
			secret: "s",
		});
	});

	it("creates with the config and updates with events only", () => {
		expect(createWebhookBody(draft)).toMatchObject({
			name: "web",
			events: ["*"],
			config: { url: "https://x.dev/hook" },
		});
		expect(updateWebhookBody(draft)).toEqual({ active: true, events: ["*"] });
	});

	it("starts an edit with no secret and the hook's current events", () => {
		const edited = draftFromWebhook(
			mapWebhook({
				id: 3,
				active: false,
				events: ["push", "issues"],
				config: { url: "https://x.dev", content_type: "form", secret: "***" },
			}),
		);
		expect(edited).toMatchObject({
			secret: "",
			contentType: "form",
			active: false,
			selection: { kind: "custom", events: ["push", "issues"] },
		});
	});
});

describe("validateWebhookDraft", () => {
	it("needs a real URL and at least one event", () => {
		expect(validateWebhookDraft(emptyWebhookDraft())).toMatch(/payload URL/);
		expect(
			validateWebhookDraft({ ...emptyWebhookDraft(), url: "ftp://x.dev" }),
		).toMatch(/http/);
		expect(
			validateWebhookDraft({
				...emptyWebhookDraft(),
				url: "https://x.dev",
				selection: { kind: "custom", events: [] },
			}),
		).toMatch(/event/);
		expect(
			validateWebhookDraft({ ...emptyWebhookDraft(), url: "https://x.dev" }),
		).toBeNull();
	});
});

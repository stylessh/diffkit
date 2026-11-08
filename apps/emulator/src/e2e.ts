import { getGitHubStore } from "@emulators/github";
import { resolveAnchor } from "./seed/anchor.ts";
import { workspace } from "./seed/content/index.ts";
import {
	DEFAULT_DASHBOARD_URL,
	DEFAULT_EMULATOR_PORT,
} from "./seed/identity.ts";
import { seedWorkspace } from "./seed/seed-workspace.ts";
import { createDiffkitEmulator } from "./server.ts";

/**
 * Emulator for the Playwright suite: in-memory, seeded once, and resettable.
 * `POST /_diffkit/e2e/checkpoint` freezes the store; `POST /_diffkit/e2e/reset`
 * returns to it. Issued tokens survive a reset because the dashboard keeps
 * sessions and installation tokens that were minted after the checkpoint.
 */
const emulator = await createDiffkitEmulator({
	port: Number(process.env.EMULATOR_PORT ?? DEFAULT_EMULATOR_PORT),
	dashboardUrl: process.env.DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL,
	persistence: null,
	seedFingerprint: "e2e",
});

await seedWorkspace(emulator, workspace, { anchor: resolveAnchor() });

// Specs deliver the webhooks they care about themselves, so what reaches the
// dashboard's change feed never depends on emulator timing.
const github = getGitHubStore(emulator.store);
for (const app of github.apps.all()) {
	github.apps.update(app.id, { webhook_url: null });
}

emulator.store.setData("diffkit.ready", true);

let checkpoint: string | null = null;

emulator.app.post("/_diffkit/e2e/checkpoint", (c) => {
	checkpoint = JSON.stringify(emulator.store.snapshot());
	return c.json({ ok: true });
});

emulator.app.post("/_diffkit/e2e/reset", (c) => {
	if (checkpoint === null) {
		return c.json({ ok: false, error: "no checkpoint taken" }, 409);
	}
	emulator.store.restore(JSON.parse(checkpoint));
	return c.json({ ok: true });
});

const shutdown = async () => {
	await emulator.close();
	process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`E2E_EMULATOR_READY ${emulator.url}`);

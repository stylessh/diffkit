/**
 * `pnpm --filter @diffkit/emulator dev`
 *
 * Starts the GitHub emulator with DiffKit's shims, seeds the demo workspace
 * (or restores it from `.emulate/state.json`) and keeps serving until Ctrl+C.
 *
 *   --reset        discard saved state and reseed
 *   --no-persist   keep everything in memory
 *
 * Env: EMULATOR_PORT (4001), DASHBOARD_URL (http://localhost:3000),
 *      DIFFKIT_DEMO_ANCHOR (fixed date; "now" for fresh-looking data)
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { filePersistence } from "@emulators/core";
import { resolveAnchor } from "./seed/anchor.ts";
import { workspace } from "./seed/content/index.ts";
import {
	DEFAULT_DASHBOARD_URL,
	DEFAULT_EMULATOR_PORT,
	DEMO_VIEWER_LOGIN,
} from "./seed/identity.ts";
import { seedWorkspace } from "./seed/seed-workspace.ts";
import { createDiffkitEmulator } from "./server.ts";

const args = new Set(process.argv.slice(2));
const port = Number(process.env.EMULATOR_PORT ?? DEFAULT_EMULATOR_PORT);
const dashboardUrl = process.env.DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL;
const statePath = fileURLToPath(
	new URL("../.emulate/state.json", import.meta.url),
);
const anchor = resolveAnchor();

/** Any change to the seed sources, emulate's version or the anchor reseeds. */
function seedFingerprint() {
	const hash = createHash("sha256");
	const walk = (dir: URL) => {
		for (const entry of readdirSync(dir).sort()) {
			const child = new URL(entry, dir);
			if (statSync(child).isDirectory()) {
				walk(new URL(`${entry}/`, dir));
			} else {
				hash.update(entry).update(readFileSync(child));
			}
		}
	};
	walk(new URL("./", import.meta.url));
	const emulatePackage = new URL(
		"../node_modules/@emulators/github/package.json",
		import.meta.url,
	);
	hash.update(readFileSync(emulatePackage));
	hash.update(anchor.toISOString()).update(dashboardUrl);
	return hash.digest("hex").slice(0, 16);
}

async function main() {
	if (args.has("--reset")) {
		rmSync(statePath, { force: true });
	}
	const persist = !args.has("--no-persist");
	const emulator = await createDiffkitEmulator({
		port,
		dashboardUrl,
		persistence: persist ? filePersistence(statePath) : null,
		seedFingerprint: seedFingerprint(),
	});

	if (emulator.restored) {
		console.log("[emulator] restored demo workspace from .emulate/state.json");
	} else {
		console.log("[emulator] seeding demo workspace…");
		await seedWorkspace(emulator, workspace, {
			anchor,
			log: (message) => console.log(message),
		});
		await emulator.save();
	}
	emulator.store.setData("diffkit.ready", true);

	console.log(`
  GitHub emulator ready at ${emulator.url}
    REST     ${emulator.url}/user, /repos/…
    GraphQL  ${emulator.url}/graphql
    Sign in  as "${DEMO_VIEWER_LOGIN}" from the emulator's account picker
    Webhooks → ${dashboardUrl}/api/webhooks/github
`);

	const shutdown = async () => {
		await emulator.close();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main().catch((error) => {
	console.error("[emulator] failed to start", error);
	process.exit(1);
});

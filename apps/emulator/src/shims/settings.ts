import type { ShimContext } from "../server.ts";
import { registerAccessShims } from "./settings-access.ts";
import { registerActionsShims } from "./settings-actions.ts";
import { registerHookShims } from "./settings-hooks.ts";
import { registerOrgSettingsShims } from "./settings-org.ts";
import { registerRepoSettingsShims } from "./settings-repo.ts";

/** Endpoints behind the repository and organization settings pages. */
export function registerSettingsShims(context: ShimContext) {
	registerRepoSettingsShims(context);
	registerAccessShims(context);
	registerActionsShims(context);
	registerHookShims(context);
	registerOrgSettingsShims(context);
}

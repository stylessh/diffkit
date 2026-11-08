import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import { invalidateGitHubEntities } from "#/lib/github-query-updates";
import type { SettingsOutcome } from "#/lib/settings/read-result";

export type ActionStatus =
	| { kind: "idle" }
	| { kind: "pending" }
	| { kind: "done" }
	| { kind: "failed"; error: string };

const DONE_VISIBLE_MS = 2500;

export function useSettingsAction(
	scope: GitHubQueryScope,
	entityKeys: string[],
) {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<ActionStatus>({ kind: "idle" });
	const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => () => clearTimeout(doneTimer.current), []);

	async function run(task: () => Promise<SettingsOutcome>) {
		clearTimeout(doneTimer.current);
		setStatus({ kind: "pending" });
		const outcome = await task().catch(
			(): SettingsOutcome => ({
				ok: false,
				error: "Something went wrong. Try again.",
			}),
		);
		if (!outcome.ok) {
			setStatus({ kind: "failed", error: outcome.error });
			return false;
		}
		await invalidateGitHubEntities(queryClient, scope, entityKeys);
		setStatus({ kind: "done" });
		doneTimer.current = setTimeout(
			() => setStatus({ kind: "idle" }),
			DONE_VISIBLE_MS,
		);
		return true;
	}

	function reset() {
		clearTimeout(doneTimer.current);
		setStatus({ kind: "idle" });
	}

	return { status, run, reset };
}

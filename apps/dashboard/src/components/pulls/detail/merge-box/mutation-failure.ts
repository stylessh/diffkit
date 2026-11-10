import { toast } from "@diffkit/ui/components/sonner";
import { checkPermissionWarning } from "#/lib/warning-store";

/** Toasts a rejected mutation and raises the app-permissions warning when that is the cause. */
export function reportMutationFailure(
	result: { ok: false; error: string; installUrl?: string },
	{ owner, repo }: { owner: string; repo: string },
) {
	toast.error(result.error);
	checkPermissionWarning(result, `${owner}/${repo}`);
}

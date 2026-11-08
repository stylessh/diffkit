import { Button } from "@diffkit/ui/components/button";
import { ActionNote } from "./action-note";
import type { ActionStatus } from "./use-settings-action";

export function SaveBar({
	dirty,
	status,
	problem,
	onSave,
	onDiscard,
}: {
	dirty: boolean;
	status: ActionStatus;
	problem: string | null;
	onSave: () => void;
	onDiscard: () => void;
}) {
	if (!dirty && status.kind === "idle") return null;
	const pending = status.kind === "pending";

	return (
		<div className="sticky bottom-4 z-10 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-popover px-3 py-2 shadow-popover">
			<div className="min-w-0 text-[13px] text-muted-foreground">
				{dirty ? (
					<span className={problem ? "text-danger" : undefined}>
						{problem ?? "Unsaved changes"}
					</span>
				) : null}
				<ActionNote status={status} />
			</div>
			{dirty ? (
				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={pending}
						onClick={onDiscard}
					>
						Discard
					</Button>
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={pending || problem !== null}
						onClick={onSave}
					>
						{pending ? "Saving…" : "Save changes"}
					</Button>
				</div>
			) : null}
		</div>
	);
}

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@diffkit/ui/components/alert-dialog";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { SettingsOutcome } from "#/lib/settings/read-result";
import { useSettingsAction } from "./use-settings-action";

type DialogState = { kind: "closed" } | { kind: "open"; typed: string };

export function DangerRow({
	scope,
	entityKeys,
	title,
	description,
	buttonLabel,
	dialogTitle,
	dialogDescription,
	typedConfirmation,
	actionLabel,
	onConfirm,
	onDone,
}: {
	scope: GitHubQueryScope;
	entityKeys: string[];
	title: string;
	description: string;
	buttonLabel: string;
	dialogTitle: string;
	dialogDescription: string;
	typedConfirmation?: string;
	actionLabel: string;
	onConfirm: () => Promise<SettingsOutcome>;
	onDone?: () => void;
}) {
	const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
	const { status, run, reset } = useSettingsAction(scope, entityKeys);
	const pending = status.kind === "pending";
	const typed = dialog.kind === "open" ? dialog.typed : "";
	const confirmed =
		typedConfirmation === undefined ||
		typed.trim().toLowerCase() === typedConfirmation.toLowerCase();

	async function confirm() {
		if (await run(onConfirm)) {
			setDialog({ kind: "closed" });
			onDone?.();
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div className="min-w-0 flex-1 basis-64">
				<p className="text-sm font-medium text-foreground">{title}</p>
				<p className="text-xs text-pretty text-muted-foreground">
					{description}
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="text-danger"
				onClick={() => {
					reset();
					setDialog({ kind: "open", typed: "" });
				}}
			>
				{buttonLabel}
			</Button>
			<AlertDialog
				open={dialog.kind === "open"}
				onOpenChange={(open) => {
					if (!open && !pending) setDialog({ kind: "closed" });
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
						<AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
					</AlertDialogHeader>
					{typedConfirmation === undefined ? null : (
						<div className="flex flex-col gap-2">
							<Label htmlFor="danger-confirmation" className="text-[13px]">
								Type{" "}
								<span className="font-semibold text-foreground">
									{typedConfirmation}
								</span>{" "}
								to confirm
							</Label>
							<Input
								id="danger-confirmation"
								autoComplete="off"
								value={typed}
								onChange={(event) =>
									setDialog({ kind: "open", typed: event.target.value })
								}
							/>
						</div>
					)}
					{status.kind === "failed" ? (
						<p role="alert" className="text-[13px] text-danger">
							{status.error}
						</p>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
						<Button
							type="button"
							variant="destructive"
							disabled={pending || !confirmed}
							onClick={() => void confirm()}
						>
							{pending ? "Working…" : actionLabel}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

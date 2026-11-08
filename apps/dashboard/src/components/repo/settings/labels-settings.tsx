import { PlusSignIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LabelPill } from "#/components/details/label-pill";
import { ActionNote } from "#/components/settings/action-note";
import { InlineConfirmButton } from "#/components/settings/inline-confirm";
import {
	SettingsEmptyRow,
	SettingsGroup,
	SettingsListRow,
} from "#/components/settings/settings-group";
import { SettingsSkeleton } from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import { deleteRepoLabel, saveRepoLabel } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoLabelsQueryOptions,
} from "#/lib/github.query";
import type { GitHubLabel } from "#/lib/github.types";
import { labelsEntityKey } from "#/lib/github-query-updates";
import {
	LABEL_COLORS,
	LABEL_DESCRIPTION_MAX,
	type LabelDraft,
	normalizeLabelColor,
	suggestLabelColor,
	validateLabelDraft,
} from "#/lib/settings/labels";

type RepoProps = { owner: string; repo: string; scope: GitHubQueryScope };

type Editor =
	| { kind: "closed" }
	| { kind: "create" }
	| { kind: "edit"; name: string };

export function LabelsSettings({ owner, repo, scope }: RepoProps) {
	const query = useQuery(githubRepoLabelsQueryOptions(scope, { owner, repo }));
	const [editor, setEditor] = useState<Editor>({ kind: "closed" });
	const { status, run } = useSettingsAction(scope, [
		labelsEntityKey({ owner, repo }),
	]);
	const labels = query.data ?? [];

	return (
		<>
			<SettingsHeading
				title="Labels"
				description="Organize issues and pull requests."
				actions={
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setEditor({ kind: "create" })}
					>
						<PlusSignIcon size={13} />
						New label
					</Button>
				}
			/>
			{query.isPending ? (
				<SettingsSkeleton rows={5} />
			) : (
				<SettingsGroup
					title={`${labels.length} ${labels.length === 1 ? "label" : "labels"}`}
					actions={<ActionNote status={status} doneLabel="Deleted" />}
				>
					{editor.kind === "create" ? (
						<LabelEditor
							key="create"
							label={null}
							labels={labels}
							owner={owner}
							repo={repo}
							scope={scope}
							onClose={() => setEditor({ kind: "closed" })}
						/>
					) : null}
					{labels.length === 0 && editor.kind === "closed" ? (
						<SettingsEmptyRow>No labels yet.</SettingsEmptyRow>
					) : null}
					{labels.map((label) =>
						editor.kind === "edit" && editor.name === label.name ? (
							<LabelEditor
								key={label.name}
								label={label}
								labels={labels}
								owner={owner}
								repo={repo}
								scope={scope}
								onClose={() => setEditor({ kind: "closed" })}
							/>
						) : (
							<SettingsListRow key={label.name}>
								<LabelPill name={label.name} color={label.color} />
								<span className="min-w-0 flex-1 basis-40 truncate text-xs text-muted-foreground">
									{label.description}
								</span>
								<span className="flex items-center gap-1">
									<Button
										type="button"
										variant="ghost"
										size="xs"
										aria-label={`Edit label ${label.name}`}
										onClick={() =>
											setEditor({ kind: "edit", name: label.name })
										}
									>
										Edit
									</Button>
									<InlineConfirmButton
										label="Delete"
										ariaLabel={`Delete label ${label.name}`}
										prompt="Delete label?"
										confirmLabel="Delete"
										pending={status.kind === "pending"}
										onConfirm={() =>
											void run(() =>
												deleteRepoLabel({
													data: { owner, repo, name: label.name },
												}),
											)
										}
									/>
								</span>
							</SettingsListRow>
						),
					)}
				</SettingsGroup>
			)}
		</>
	);
}

function LabelEditor({
	label,
	labels,
	owner,
	repo,
	scope,
	onClose,
}: RepoProps & {
	label: GitHubLabel | null;
	labels: GitHubLabel[];
	onClose: () => void;
}) {
	const [draft, setDraft] = useState<LabelDraft>({
		name: label?.name ?? "",
		color:
			label?.color ?? suggestLabelColor(labels.map((entry) => entry.color)),
		description: label?.description ?? "",
	});
	const { status, run } = useSettingsAction(scope, [
		labelsEntityKey({ owner, repo }),
	]);
	const otherNames = labels
		.filter((entry) => entry.name !== label?.name)
		.map((entry) => entry.name);
	const problem = validateLabelDraft(draft, otherNames);
	const pending = status.kind === "pending";
	const idPrefix = `label-${label?.name ?? "new"}`;
	const previewColor = normalizeLabelColor(draft.color);

	async function save() {
		const ok = await run(() =>
			saveRepoLabel({
				data: { owner, repo, currentName: label?.name ?? null, draft },
			}),
		);
		if (ok) onClose();
	}

	return (
		<div className="flex flex-col gap-3 bg-group/40 px-4 py-4">
			<LabelPill
				name={draft.name.trim() || "Label preview"}
				color={/^[0-9a-f]{6}$/.test(previewColor) ? previewColor : "808080"}
			/>
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${idPrefix}-name`}>Name</Label>
					<Input
						id={`${idPrefix}-name`}
						autoComplete="off"
						value={draft.name}
						onChange={(event) =>
							setDraft({ ...draft, name: event.target.value })
						}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${idPrefix}-description`}>Description</Label>
					<Input
						id={`${idPrefix}-description`}
						autoComplete="off"
						maxLength={LABEL_DESCRIPTION_MAX}
						value={draft.description}
						onChange={(event) =>
							setDraft({ ...draft, description: event.target.value })
						}
					/>
				</div>
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${idPrefix}-color`}>Colour</Label>
					<Input
						id={`${idPrefix}-color`}
						className="w-28 font-mono"
						autoComplete="off"
						value={draft.color}
						onChange={(event) =>
							setDraft({ ...draft, color: event.target.value })
						}
					/>
				</div>
				<ul className="flex flex-wrap gap-1.5" aria-label="Suggested colours">
					{LABEL_COLORS.map((color) => (
						<li key={color}>
							<button
								type="button"
								aria-label={`Use colour ${color}`}
								aria-pressed={previewColor === color}
								onClick={() => setDraft({ ...draft, color })}
								className="size-5 rounded-full shadow-chip aria-pressed:outline-1 aria-pressed:outline-offset-2 aria-pressed:outline-foreground"
								style={{ backgroundColor: `#${color}` }}
							/>
						</li>
					))}
				</ul>
			</div>
			<div className="flex items-center justify-end gap-2">
				{draft.name !== "" && problem ? (
					<span className="mr-auto text-xs text-danger">{problem}</span>
				) : (
					<ActionNote status={status} className="mr-auto" />
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={onClose}
				>
					Cancel
				</Button>
				<Button
					type="button"
					variant="accent"
					size="sm"
					disabled={pending || problem !== null}
					onClick={() => void save()}
				>
					{pending ? "Saving…" : label ? "Save label" : "Create label"}
				</Button>
			</div>
		</div>
	);
}

import { LockKeyIcon, PlusSignIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { Textarea } from "@diffkit/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActionNote } from "#/components/settings/action-note";
import { InlineConfirmButton } from "#/components/settings/inline-confirm";
import {
	SettingsEmptyRow,
	SettingsGroup,
	SettingsListRow,
} from "#/components/settings/settings-group";
import { SettingsReadView } from "#/components/settings/settings-read";
import { SettingsHeading } from "#/components/settings/settings-shell";
import { useSettingsAction } from "#/components/settings/use-settings-action";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	deleteRepoActionsSecret,
	deleteRepoActionsVariable,
	saveRepoActionsSecret,
	saveRepoActionsVariable,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoActionsSecretsQueryOptions,
	githubRepoActionsVariablesQueryOptions,
} from "#/lib/github.query";
import { settingsEntityKey } from "#/lib/github-query-updates";
import {
	type ActionsConfigKind,
	normalizeActionsName,
	validateActionsName,
	validateActionsValue,
} from "#/lib/settings/actions-config";
import type { SettingsOutcome } from "#/lib/settings/read-result";
import {
	SAMPLE_ACTIONS_SECRETS,
	SAMPLE_ACTIONS_VARIABLES,
} from "./repo-settings-samples";

type RepoProps = { owner: string; repo: string; scope: GitHubQueryScope };

type ConfigItem = {
	name: string;
	value: string | null;
	updatedAt: string | null;
};

type Editor =
	| { kind: "closed" }
	| { kind: "create" }
	| { kind: "update"; name: string; value: string };

type ConfigCopy = {
	title: string;
	description: string;
	addLabel: string;
	empty: string;
};

const COPY: Record<ActionsConfigKind, ConfigCopy> = {
	secret: {
		title: "Repository secrets",
		description:
			"Encrypted values for workflows. Once saved they can't be read back.",
		addLabel: "New secret",
		empty: "No secrets yet.",
	},
	variable: {
		title: "Repository variables",
		description: "Plain-text configuration shared by workflows.",
		addLabel: "New variable",
		empty: "No variables yet.",
	},
};

export function ActionsSettings({ owner, repo, scope }: RepoProps) {
	return (
		<>
			<SettingsHeading
				title="Actions"
				description="Secrets and variables available to this repository's workflows."
			/>
			<SecretsSection owner={owner} repo={repo} scope={scope} />
			<VariablesSection owner={owner} repo={repo} scope={scope} />
		</>
	);
}

function SecretsSection({ owner, repo, scope }: RepoProps) {
	const query = useQuery(
		githubRepoActionsSecretsQueryOptions(scope, { owner, repo }),
	);
	return (
		<SettingsReadView
			query={query}
			sample={SAMPLE_ACTIONS_SECRETS}
			forbiddenTitle="Secrets aren't available"
			forbiddenHint="GitHub only shows Actions secrets to people with admin access."
			githubUrl={`https://github.com/${owner}/${repo}/settings/secrets/actions`}
		>
			{(secrets) => (
				<ConfigSection
					kind="secret"
					scope={scope}
					owner={owner}
					repo={repo}
					items={secrets.map((secret) => ({
						name: secret.name,
						value: null,
						updatedAt: secret.updatedAt,
					}))}
					onSave={(name, value) =>
						saveRepoActionsSecret({ data: { owner, repo, name, value } })
					}
					onDelete={(name) =>
						deleteRepoActionsSecret({ data: { owner, repo, name } })
					}
				/>
			)}
		</SettingsReadView>
	);
}

function VariablesSection({ owner, repo, scope }: RepoProps) {
	const query = useQuery(
		githubRepoActionsVariablesQueryOptions(scope, { owner, repo }),
	);
	return (
		<SettingsReadView
			query={query}
			sample={SAMPLE_ACTIONS_VARIABLES}
			forbiddenTitle="Variables aren't available"
			forbiddenHint="GitHub only shows Actions variables to people with admin access."
			githubUrl={`https://github.com/${owner}/${repo}/settings/variables/actions`}
		>
			{(variables) => (
				<ConfigSection
					kind="variable"
					scope={scope}
					owner={owner}
					repo={repo}
					items={variables.map((variable) => ({
						name: variable.name,
						value: variable.value,
						updatedAt: variable.updatedAt,
					}))}
					onSave={(name, value, mode) =>
						saveRepoActionsVariable({
							data: { owner, repo, name, value, mode },
						})
					}
					onDelete={(name) =>
						deleteRepoActionsVariable({ data: { owner, repo, name } })
					}
				/>
			)}
		</SettingsReadView>
	);
}

function ConfigSection({
	kind,
	scope,
	owner,
	repo,
	items,
	onSave,
	onDelete,
}: RepoProps & {
	kind: ActionsConfigKind;
	items: ConfigItem[];
	onSave: (
		name: string,
		value: string,
		mode: "create" | "update",
	) => Promise<SettingsOutcome>;
	onDelete: (name: string) => Promise<SettingsOutcome>;
}) {
	const copy = COPY[kind];
	const [editor, setEditor] = useState<Editor>({ kind: "closed" });
	const { status, run } = useSettingsAction(scope, [
		settingsEntityKey({ owner, repo }),
	]);

	return (
		<SettingsGroup
			title={copy.title}
			description={copy.description}
			actions={
				<>
					<ActionNote status={status} />
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setEditor({ kind: "create" })}
					>
						<PlusSignIcon size={13} />
						{copy.addLabel}
					</Button>
				</>
			}
		>
			{editor.kind === "closed" ? null : (
				<ConfigEditor
					key={editor.kind === "update" ? editor.name : "create"}
					kind={kind}
					editor={editor}
					existingNames={items.map((item) => item.name)}
					onSave={onSave}
					scope={scope}
					owner={owner}
					repo={repo}
					onClose={() => setEditor({ kind: "closed" })}
				/>
			)}
			{items.length === 0 && editor.kind === "closed" ? (
				<SettingsEmptyRow>{copy.empty}</SettingsEmptyRow>
			) : (
				items.map((item) => (
					<SettingsListRow key={item.name}>
						{kind === "secret" ? (
							<LockKeyIcon size={14} className="text-icon-faint" />
						) : null}
						<span className="font-mono text-[13px] font-medium text-foreground">
							{item.name}
						</span>
						{item.value === null ? null : (
							<span className="min-w-0 flex-1 basis-40 truncate font-mono text-xs text-muted-foreground">
								{item.value}
							</span>
						)}
						{item.updatedAt ? (
							<span className="ml-auto text-xs text-muted-foreground">
								Updated {formatRelativeTime(item.updatedAt)}
							</span>
						) : null}
						<span className="flex items-center justify-end gap-1">
							<Button
								type="button"
								variant="ghost"
								size="xs"
								aria-label={`${kind === "secret" ? "Update" : "Edit"} ${item.name}`}
								onClick={() =>
									setEditor({
										kind: "update",
										name: item.name,
										value: item.value ?? "",
									})
								}
							>
								{kind === "secret" ? "Update" : "Edit"}
							</Button>
							<InlineConfirmButton
								label="Delete"
								ariaLabel={`Delete ${item.name}`}
								prompt={`Delete ${kind}?`}
								confirmLabel="Delete"
								pending={status.kind === "pending"}
								onConfirm={() => void run(() => onDelete(item.name))}
							/>
						</span>
					</SettingsListRow>
				))
			)}
		</SettingsGroup>
	);
}

function ConfigEditor({
	kind,
	editor,
	existingNames,
	onSave,
	scope,
	owner,
	repo,
	onClose,
}: RepoProps & {
	kind: ActionsConfigKind;
	editor: Exclude<Editor, { kind: "closed" }>;
	existingNames: string[];
	onSave: (
		name: string,
		value: string,
		mode: "create" | "update",
	) => Promise<SettingsOutcome>;
	onClose: () => void;
}) {
	const creating = editor.kind === "create";
	const [name, setName] = useState(editor.kind === "update" ? editor.name : "");
	const [value, setValue] = useState(
		editor.kind === "update" ? editor.value : "",
	);
	const { status, run } = useSettingsAction(scope, [
		settingsEntityKey({ owner, repo }),
	]);
	const pending = status.kind === "pending";
	const touched = name !== "" || value !== "";
	const problem =
		(creating ? validateActionsName(name, existingNames) : null) ??
		validateActionsValue(value, kind);

	async function save() {
		const ok = await run(() =>
			onSave(normalizeActionsName(name), value, creating ? "create" : "update"),
		);
		if (ok) onClose();
	}

	return (
		<div className="flex flex-col gap-3 bg-group/40 px-4 py-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${kind}-name`}>Name</Label>
				<Input
					id={`${kind}-name`}
					className="font-mono"
					autoComplete="off"
					disabled={!creating}
					value={creating ? name : normalizeActionsName(name)}
					onChange={(event) => setName(event.target.value)}
					placeholder="MY_VALUE"
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${kind}-value`}>
					{kind === "secret" ? "Secret" : "Value"}
				</Label>
				{kind === "secret" ? (
					// type=password inputs drop the newlines of a pasted private key.
					<Textarea
						id={`${kind}-value`}
						autoComplete="off"
						spellCheck={false}
						className="font-mono [-webkit-text-security:disc]"
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder={creating ? "" : "Enter a new value"}
					/>
				) : (
					<Textarea
						id={`${kind}-value`}
						spellCheck={false}
						className="font-mono"
						value={value}
						onChange={(event) => setValue(event.target.value)}
					/>
				)}
			</div>
			<div className="flex items-center justify-end gap-2">
				{touched && problem ? (
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
					{pending ? "Saving…" : `Save ${kind}`}
				</Button>
			</div>
		</div>
	);
}

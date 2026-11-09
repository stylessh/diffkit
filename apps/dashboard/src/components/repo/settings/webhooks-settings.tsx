import { PlusSignIcon, RefreshCwIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Checkbox } from "@diffkit/ui/components/checkbox";
import { Input } from "@diffkit/ui/components/input";
import { Label } from "@diffkit/ui/components/label";
import { SegmentedToggle } from "@diffkit/ui/components/segmented-toggle";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import {
	StatePill,
	type StatePillTone,
} from "@diffkit/ui/components/state-pill";
import { Switch } from "@diffkit/ui/components/switch";
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
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	deleteRepoWebhook,
	redeliverWebhookDelivery,
	saveRepoWebhook,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoWebhookDeliveriesQueryOptions,
	githubRepoWebhooksQueryOptions,
} from "#/lib/github.query";
import { settingsEntityKey } from "#/lib/github-query-updates";
import {
	deliverySucceeded,
	draftFromWebhook,
	emptyWebhookDraft,
	type RepoWebhook,
	validateWebhookDraft,
	WEBHOOK_EVENTS,
	type WebhookDraft,
	type WebhookHealth,
} from "#/lib/settings/webhooks";
import {
	SAMPLE_WEBHOOK_DELIVERIES,
	SAMPLE_WEBHOOKS,
} from "./repo-settings-samples";

type RepoProps = { owner: string; repo: string; scope: GitHubQueryScope };

type Panel =
	| { kind: "none" }
	| { kind: "create" }
	| { kind: "edit"; hookId: number }
	| { kind: "deliveries"; hookId: number };

const HEALTH: Record<
	WebhookHealth["kind"],
	{ label: string; tone: StatePillTone }
> = {
	ok: { label: "Delivering", tone: "open" },
	failing: { label: "Failing", tone: "closed" },
	unused: { label: "Not delivered yet", tone: "muted" },
};

function summarizeEvents(events: string[]) {
	if (events.includes("*")) return "All events";
	if (events.length === 1) {
		return (
			WEBHOOK_EVENTS.find((entry) => entry.value === events[0])?.label ??
			events[0]
		);
	}
	return `${events.length} events`;
}

export function WebhooksSettings({ owner, repo, scope }: RepoProps) {
	const query = useQuery(
		githubRepoWebhooksQueryOptions(scope, { owner, repo }),
	);
	const [panel, setPanel] = useState<Panel>({ kind: "none" });

	return (
		<>
			<SettingsHeading
				title="Webhooks"
				description="Send an HTTP request to a URL when something happens in this repository."
				actions={
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setPanel({ kind: "create" })}
					>
						<PlusSignIcon size={13} />
						Add webhook
					</Button>
				}
			/>
			{panel.kind === "create" ? (
				<WebhookEditor
					owner={owner}
					repo={repo}
					scope={scope}
					webhook={null}
					onClose={() => setPanel({ kind: "none" })}
				/>
			) : null}
			<SettingsReadView
				query={query}
				sample={SAMPLE_WEBHOOKS}
				forbiddenTitle="Webhooks aren't available"
				forbiddenHint="GitHub only shows webhooks to people with admin access."
				githubUrl={`https://github.com/${owner}/${repo}/settings/hooks`}
			>
				{(hooks) => (
					<SettingsGroup>
						{hooks.length === 0 ? (
							<SettingsEmptyRow>No webhooks yet.</SettingsEmptyRow>
						) : (
							hooks.map((hook) => (
								<WebhookRow
									key={hook.id}
									hook={hook}
									owner={owner}
									repo={repo}
									scope={scope}
									panel={panel}
									setPanel={setPanel}
								/>
							))
						)}
					</SettingsGroup>
				)}
			</SettingsReadView>
		</>
	);
}

function WebhookRow({
	hook,
	owner,
	repo,
	scope,
	panel,
	setPanel,
}: RepoProps & {
	hook: RepoWebhook;
	panel: Panel;
	setPanel: (panel: Panel) => void;
}) {
	const { status, run } = useSettingsAction(scope, [
		settingsEntityKey({ owner, repo }),
	]);
	const health = HEALTH[hook.health.kind];
	const editing = panel.kind === "edit" && panel.hookId === hook.id;
	const showingDeliveries =
		panel.kind === "deliveries" && panel.hookId === hook.id;

	if (editing) {
		return (
			<WebhookEditor
				owner={owner}
				repo={repo}
				scope={scope}
				webhook={hook}
				onClose={() => setPanel({ kind: "none" })}
			/>
		);
	}

	return (
		<>
			<SettingsListRow>
				<div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
					<span className="truncate text-[13px] font-medium text-foreground">
						{hook.url}
					</span>
					<span className="text-xs text-muted-foreground">
						{summarizeEvents(hook.events)}
						{hook.active ? "" : " · Inactive"}
					</span>
				</div>
				<StatePill tone={health.tone}>{health.label}</StatePill>
				<span className="flex items-center gap-1">
					<ActionNote status={status} />
					<Button
						type="button"
						variant="ghost"
						size="xs"
						aria-label={`Deliveries for ${hook.url}`}
						aria-expanded={showingDeliveries}
						onClick={() =>
							setPanel(
								showingDeliveries
									? { kind: "none" }
									: { kind: "deliveries", hookId: hook.id },
							)
						}
					>
						Deliveries
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						aria-label={`Edit webhook ${hook.url}`}
						onClick={() => setPanel({ kind: "edit", hookId: hook.id })}
					>
						Edit
					</Button>
					<InlineConfirmButton
						label="Delete"
						ariaLabel={`Delete webhook ${hook.url}`}
						prompt="Delete webhook?"
						confirmLabel="Delete"
						pending={status.kind === "pending"}
						onConfirm={() =>
							void run(() =>
								deleteRepoWebhook({ data: { owner, repo, hookId: hook.id } }),
							)
						}
					/>
				</span>
			</SettingsListRow>
			{showingDeliveries ? (
				<Deliveries hook={hook} owner={owner} repo={repo} scope={scope} />
			) : null}
		</>
	);
}

function Deliveries({
	hook,
	owner,
	repo,
	scope,
}: RepoProps & { hook: RepoWebhook }) {
	const isSample = useIsSkeletonSample();
	const query = useQuery({
		...githubRepoWebhookDeliveriesQueryOptions(scope, {
			owner,
			repo,
			hookId: hook.id,
		}),
		enabled: !isSample,
	});
	const { status, run } = useSettingsAction(scope, [
		settingsEntityKey({ owner, repo }),
	]);

	return (
		<div className="bg-group/40">
			<div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
				<span>Recent deliveries</span>
				<ActionNote status={status} doneLabel="Redelivery queued" />
			</div>
			<SettingsReadView
				query={query}
				sample={SAMPLE_WEBHOOK_DELIVERIES}
				forbiddenTitle="Deliveries aren't available"
				forbiddenHint="Only admins can see delivery history."
				githubUrl={`https://github.com/${owner}/${repo}/settings/hooks/${hook.id}`}
			>
				{(deliveries) =>
					deliveries.length === 0 ? (
						<SettingsEmptyRow>No deliveries yet.</SettingsEmptyRow>
					) : (
						<ul>
							{deliveries.map((delivery) => (
								<li key={delivery.id}>
									<SettingsListRow className="min-h-9 py-1">
										<StatePill
											tone={deliverySucceeded(delivery) ? "open" : "closed"}
										>
											{delivery.statusCode}
										</StatePill>
										<span className="text-[13px] text-text-strong">
											{delivery.event}
											{delivery.action ? `.${delivery.action}` : ""}
										</span>
										{delivery.redelivery ? (
											<span className="text-xs text-muted-foreground">
												redelivery
											</span>
										) : null}
										<span className="ml-auto text-xs text-muted-foreground">
											{formatRelativeTime(delivery.deliveredAt)}
										</span>
										<Button
											type="button"
											variant="ghost"
											size="xs"
											aria-label={`Redeliver ${delivery.event} ${delivery.id}`}
											disabled={status.kind === "pending"}
											onClick={() =>
												void run(() =>
													redeliverWebhookDelivery({
														data: {
															owner,
															repo,
															hookId: hook.id,
															deliveryId: delivery.id,
														},
													}),
												)
											}
										>
											<RefreshCwIcon size={12} />
											Redeliver
										</Button>
									</SettingsListRow>
								</li>
							))}
						</ul>
					)
				}
			</SettingsReadView>
		</div>
	);
}

type EventMode = "push" | "all" | "custom";

function WebhookEditor({
	owner,
	repo,
	scope,
	webhook,
	onClose,
}: RepoProps & { webhook: RepoWebhook | null; onClose: () => void }) {
	const [draft, setDraft] = useState<WebhookDraft>(
		webhook ? draftFromWebhook(webhook) : emptyWebhookDraft(),
	);
	const { status, run } = useSettingsAction(scope, [
		settingsEntityKey({ owner, repo }),
	]);
	const problem = validateWebhookDraft(draft);
	const pending = status.kind === "pending";
	const idPrefix = `webhook-${webhook?.id ?? "new"}`;

	function update(next: Partial<WebhookDraft>) {
		setDraft({ ...draft, ...next });
	}

	function toggleEvent(event: string, checked: boolean) {
		if (draft.selection.kind !== "custom") return;
		const events = checked
			? [...draft.selection.events, event]
			: draft.selection.events.filter((entry) => entry !== event);
		update({ selection: { kind: "custom", events } });
	}

	async function save() {
		const ok = await run(() =>
			saveRepoWebhook({
				data: { owner, repo, hookId: webhook?.id ?? null, draft },
			}),
		);
		if (ok) onClose();
	}

	return (
		<SettingsGroup title={webhook ? "Edit webhook" : "New webhook"}>
			<div className="flex flex-col gap-4 px-4 py-4">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`${idPrefix}-url`}>Payload URL</Label>
					<Input
						id={`${idPrefix}-url`}
						type="url"
						placeholder="https://example.com/webhook"
						value={draft.url}
						onChange={(event) => update({ url: event.target.value })}
					/>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label>Content type</Label>
						<Select
							value={draft.contentType}
							onValueChange={(value) =>
								update({ contentType: value === "form" ? "form" : "json" })
							}
						>
							<SelectTrigger aria-label="Content type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="json">application/json</SelectItem>
								<SelectItem value="form">
									application/x-www-form-urlencoded
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={`${idPrefix}-secret`}>Secret</Label>
						<Input
							id={`${idPrefix}-secret`}
							type="password"
							autoComplete="new-password"
							placeholder={
								webhook?.hasSecret
									? "Leave blank to keep the current secret"
									: "Optional"
							}
							value={draft.secret}
							onChange={(event) => update({ secret: event.target.value })}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<Label>Events</Label>
					<SegmentedToggle<EventMode>
						aria-label="Events"
						value={draft.selection.kind}
						onValueChange={(mode) =>
							update({
								selection:
									mode === "custom"
										? { kind: "custom", events: ["push"] }
										: { kind: mode },
							})
						}
						options={[
							{ value: "push", label: "Pushes" },
							{ value: "all", label: "Everything" },
							{ value: "custom", label: "Select events" },
						]}
					/>
					{draft.selection.kind === "custom" ? (
						<ul className="grid gap-2 sm:grid-cols-2">
							{WEBHOOK_EVENTS.map((entry) => {
								const id = `${idPrefix}-event-${entry.value}`;
								const checked =
									draft.selection.kind === "custom" &&
									draft.selection.events.includes(entry.value);
								return (
									<li key={entry.value} className="flex items-center gap-2">
										<Checkbox
											id={id}
											checked={checked}
											onCheckedChange={(next) =>
												toggleEvent(entry.value, next === true)
											}
										/>
										<Label htmlFor={id} className="text-[13px] font-normal">
											{entry.label}
										</Label>
									</li>
								);
							})}
						</ul>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
					<div className="flex items-center gap-2">
						<Switch
							id={`${idPrefix}-ssl`}
							checked={!draft.insecureSsl}
							onCheckedChange={(checked) => update({ insecureSsl: !checked })}
						/>
						<Label
							htmlFor={`${idPrefix}-ssl`}
							className="text-[13px] font-normal"
						>
							Verify SSL certificates
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<Switch
							id={`${idPrefix}-active`}
							checked={draft.active}
							onCheckedChange={(checked) => update({ active: checked })}
						/>
						<Label
							htmlFor={`${idPrefix}-active`}
							className="text-[13px] font-normal"
						>
							Active
						</Label>
					</div>
				</div>
				<div className="flex items-center justify-end gap-2">
					<ActionNote status={status} className="mr-auto" />
					{problem && draft.url !== "" ? (
						<span className="mr-auto text-xs text-danger">{problem}</span>
					) : null}
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
						{pending ? "Saving…" : webhook ? "Save webhook" : "Create webhook"}
					</Button>
				</div>
			</div>
		</SettingsGroup>
	);
}

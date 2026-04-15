import {
	DashboardIcon,
	ExternalLinkIcon,
	GitPullRequestIcon,
	IssuesIcon,
	ReviewsIcon,
	SettingsIcon,
} from "@diffkit/icons";
import { buildCurrentGitHubUrl } from "#/lib/github-current-url";
import type { CommandItem } from "./types";

let commands: CommandItem[] = [];
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export function registerCommands(items: CommandItem[]): () => void {
	commands = [...commands, ...items];
	emit();
	return () => {
		const ids = new Set(items.map((i) => i.id));
		commands = commands.filter((c) => !ids.has(c.id));
		emit();
	};
}

export function getRegisteredCommands(): CommandItem[] {
	return commands;
}

export function subscribeCommands(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

registerCommands([
	{
		id: "nav:overview",
		label: "Go to Overview",
		group: "Pages",
		icon: DashboardIcon,
		keywords: ["home", "dashboard"],
		shortcut: ["G", "H"],
		action: { type: "navigate", to: "/" },
	},
	{
		id: "nav:pulls",
		label: "Go to Pull Requests",
		group: "Pages",
		icon: GitPullRequestIcon,
		keywords: ["pr", "merge"],
		shortcut: ["G", "P"],
		action: { type: "navigate", to: "/pulls" },
	},
	{
		id: "nav:issues",
		label: "Go to Issues",
		group: "Pages",
		icon: IssuesIcon,
		keywords: ["bug", "task"],
		shortcut: ["G", "I"],
		action: { type: "navigate", to: "/issues" },
	},
	{
		id: "nav:reviews",
		label: "Go to Reviews",
		group: "Pages",
		icon: ReviewsIcon,
		keywords: ["review", "requested"],
		shortcut: ["G", "R"],
		action: { type: "navigate", to: "/reviews" },
	},
	{
		id: "nav:settings",
		label: "Go to Settings",
		group: "Pages",
		icon: SettingsIcon,
		keywords: ["settings", "preferences", "config"],
		shortcut: ["G", "S"],
		action: { type: "navigate", to: "/settings" },
	},
	{
		id: "action:open-current-page-on-github",
		label: "Open Current Page on GitHub",
		group: "Actions",
		icon: ExternalLinkIcon,
		keywords: ["github", "redirect", "current page", "open"],
		shortcut: ["G", "G"],
		action: {
			type: "execute",
			fn: () => {
				window.location.href = buildCurrentGitHubUrl(window.location.href);
			},
		},
	},
]);

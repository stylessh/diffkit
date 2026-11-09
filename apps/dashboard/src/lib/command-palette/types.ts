import type { ComponentType } from "react";
import type {
	IssueSummary,
	PullSummary,
	UserRepoSummary,
} from "#/lib/github.types";

export type CommandAction =
	| { type: "navigate"; to: string }
	| { type: "execute"; fn: () => void | Promise<void> };

export type CommandItemMeta = {
	repo?: string;
	comments?: number;
	updatedAt?: string;
	language?: string | null;
	stars?: number;
};

/** What the card beside the palette shows for a row. */
export type CommandPreview =
	| { kind: "pull"; pull: PullSummary }
	| { kind: "issue"; issue: IssueSummary }
	| { kind: "repo"; repo: UserRepoSummary };

export type CommandItem = {
	id: string;
	label: string;
	group: string;
	icon?: ComponentType<{ className?: string }>;
	iconClassName?: string;
	keywords?: string[];
	shortcut?: string[];
	action: CommandAction;
	priority?: number;
	meta?: CommandItemMeta;
	preview?: CommandPreview;
};

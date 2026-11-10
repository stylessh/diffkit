import type { ReactNode } from "react";
import {
	type BulkActionResult,
	type BulkRun,
	type CountNoun,
	countOf,
} from "#/lib/bulk-actions";

export type BulkAction<T> = {
	id: string;
	icon: ReactNode;
	copy: {
		/** The bar button, e.g. "Merge". */
		button: string;
		/** Review title and confirm button for "3 pull requests", e.g. "Merge 3 pull requests". */
		confirm: (what: string) => string;
		/** Confirm button while the run is in flight, e.g. "Merging…". */
		running: string;
		/** Result for "3 pull requests", e.g. "Merged 3 pull requests". */
		done: (what: string) => string;
	};
	/** Why the action leaves this item alone, or `null` when it applies. */
	skipReason: (item: T) => string | null;
	run: (item: T) => Promise<BulkActionResult>;
	onSettled?: (succeeded: T[]) => void;
	/** Extra controls shown above the list while confirming (a merge method). */
	settings?: ReactNode;
};

/** What a row of the review shows about an item. */
export type BulkItemSummary = {
	icon: ReactNode;
	number: number;
	title: string;
	/** Where the item lives, e.g. `owner/repo`. */
	detail: string;
};

export type BulkReview<T> = {
	run: Extract<BulkRun<T>, { status: "confirming" | "running" | "settled" }>;
	action: BulkAction<T>;
};

export type BarMode<T> =
	| { kind: "actions" }
	| { kind: "review"; review: BulkReview<T> }
	| { kind: "feedback"; message: string };

export function barMode<T>(
	run: BulkRun<T>,
	action: BulkAction<T> | undefined,
	noun: CountNoun,
): BarMode<T> {
	if (!action || run.status === "idle") return { kind: "actions" };
	if (run.status === "succeeded") {
		return {
			kind: "feedback",
			message: action.copy.done(countOf(run.count, noun)),
		};
	}
	return { kind: "review", review: { run, action } };
}

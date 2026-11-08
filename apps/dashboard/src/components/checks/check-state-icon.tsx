import { CheckIcon, XIcon } from "@diffkit/icons";

export type CheckState =
	| "success"
	| "failure"
	| "pending"
	| "waiting"
	| "skipped"
	| "expected";

/** Tailwind text-color class for a CheckState — used by tab icons / inline
 *  badges that want a single color without the wrapped CheckStateIcon. */
export function getCheckStateColor(state: CheckState): string {
	if (state === "success") return "text-success";
	if (state === "failure") return "text-danger";
	if (state === "pending") return "text-warning";
	if (state === "expected") return "text-warning";
	return "text-muted-foreground";
}

export function getCheckState(input: {
	status: string;
	conclusion: string | null;
}): CheckState {
	if (input.status === "expected") return "expected";
	if (
		input.status === "queued" ||
		input.status === "waiting" ||
		input.status === "pending"
	) {
		return "waiting";
	}
	if (input.status !== "completed" || input.conclusion === null) {
		return "pending";
	}
	if (input.conclusion === "success" || input.conclusion === "neutral") {
		return "success";
	}
	if (input.conclusion === "skipped" || input.conclusion === "stale") {
		return "skipped";
	}
	return "failure";
}

export function CheckStateIcon({ state }: { state: CheckState }) {
	if (state === "success") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-success">
				<CheckIcon size={12} strokeWidth={3} />
			</div>
		);
	}
	if (state === "failure") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-danger">
				<XIcon size={12} strokeWidth={3} />
			</div>
		);
	}
	if (state === "skipped") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
				<div className="size-1.5 rounded-full border border-current" />
			</div>
		);
	}
	if (state === "waiting") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
				<svg
					className="size-3.5"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
				>
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="currentColor"
						strokeWidth="2"
						opacity="0.35"
					/>
				</svg>
			</div>
		);
	}
	if (state === "expected") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-warning">
				<div className="size-1.5 rounded-full bg-current" />
			</div>
		);
	}
	return (
		<div className="flex size-3.5 shrink-0 items-center justify-center text-warning">
			<div className="size-3.5 animate-spin">
				<svg
					className="size-3.5"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
				>
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="currentColor"
						strokeWidth="2"
						opacity="0.25"
					/>
					<path
						d="M14 8a6 6 0 0 0-6-6"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</div>
		</div>
	);
}

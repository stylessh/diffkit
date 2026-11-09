import { cn } from "@diffkit/ui/lib/utils";

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

/**
 * A run or check's state as one 14px round glyph: filled when it has finished
 * (green tick, red cross, grey dash for skipped), a ring while it hasn't
 * (spinning arc while running, dashed while queued, dotted when expected).
 */
export function CheckStateIcon({ state }: { state: CheckState }) {
	return (
		<span
			role="img"
			aria-label={CHECK_STATE_LABEL[state]}
			className={cn(
				"flex size-3.5 shrink-0 items-center justify-center",
				getCheckStateColor(state),
			)}
		>
			<svg
				viewBox="0 0 14 14"
				className={cn("size-3.5", state === "pending" && "animate-spin")}
				aria-hidden="true"
			>
				{state === "success" ? (
					<>
						<circle cx="7" cy="7" r="7" fill="currentColor" />
						<path
							d="M4.2 7.2 6.1 9l3.7-4"
							fill="none"
							stroke="var(--background)"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</>
				) : state === "failure" ? (
					<>
						<circle cx="7" cy="7" r="7" fill="currentColor" />
						<path
							d="m4.75 4.75 4.5 4.5m0-4.5-4.5 4.5"
							fill="none"
							stroke="var(--background)"
							strokeWidth="1.6"
							strokeLinecap="round"
						/>
					</>
				) : state === "skipped" ? (
					<>
						<circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.35" />
						<path
							d="M4.5 7h5"
							stroke="var(--background)"
							strokeWidth="1.6"
							strokeLinecap="round"
						/>
					</>
				) : state === "pending" ? (
					<>
						<circle
							cx="7"
							cy="7"
							r="5.75"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							opacity="0.3"
						/>
						<path
							d="M12.75 7A5.75 5.75 0 0 0 7 1.25"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</>
				) : state === "waiting" ? (
					<circle
						cx="7"
						cy="7"
						r="5.75"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeDasharray="2.4 2.1"
					/>
				) : (
					<>
						<circle
							cx="7"
							cy="7"
							r="5.75"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
						<circle cx="7" cy="7" r="2" fill="currentColor" />
					</>
				)}
			</svg>
		</span>
	);
}

const CHECK_STATE_LABEL: Record<CheckState, string> = {
	success: "Succeeded",
	failure: "Failed",
	pending: "Running",
	waiting: "Queued",
	skipped: "Skipped",
	expected: "Expected",
};

import {
	CheckIcon,
	MinusSignIcon,
	WorkflowQueueIcon,
	XIcon,
} from "@diffkit/icons";
import { cn } from "../lib/utils";

export type CheckState =
	| "success"
	| "failure"
	| "cancelled"
	| "pending"
	| "waiting"
	| "skipped"
	| "expected";

const STATUS_BADGE_CLASS =
	"flex size-3.5 shrink-0 items-center justify-center rounded-full";
const STATUS_GLYPH = {
	className: "text-white",
	size: 12,
	strokeWidth: 3.5,
} as const;
const STATUS_COMPACT_GLYPH = {
	className: "text-white",
	size: 10,
	strokeWidth: 3,
} as const;

function PendingSpinner() {
	return (
		<div className="size-3.5 animate-spin">
			<svg aria-hidden className="size-3.5" fill="none" viewBox="0 0 16 16">
				<title>Pending</title>
				<circle
					cx="8"
					cy="8"
					opacity="0.25"
					r="6"
					stroke="currentColor"
					strokeWidth="2"
				/>
				<path
					d="M14 8a6 6 0 0 0-6-6"
					stroke="currentColor"
					strokeLinecap="round"
					strokeWidth="2"
				/>
			</svg>
		</div>
	);
}

/** Shared compact status mark used by CI, automations, and session tools. */
export function CheckStateIcon({ state }: { state: CheckState }) {
	if (state === "success") {
		return (
			<span aria-hidden className={cn(STATUS_BADGE_CLASS, "bg-check-passed")}>
				<CheckIcon {...STATUS_GLYPH} />
			</span>
		);
	}
	if (state === "failure") {
		return (
			<span aria-hidden className={cn(STATUS_BADGE_CLASS, "bg-check-failed")}>
				<XIcon {...STATUS_COMPACT_GLYPH} />
			</span>
		);
	}
	if (state === "cancelled") {
		return (
			<span aria-hidden className={cn(STATUS_BADGE_CLASS, "bg-check-skipped")}>
				<MinusSignIcon className="text-main" size={10} strokeWidth={3} />
			</span>
		);
	}
	if (state === "skipped") {
		return (
			<span
				aria-hidden
				className={cn(
					STATUS_BADGE_CLASS,
					"border-[1.5px] border-check-skipped bg-transparent",
				)}
			/>
		);
	}
	if (state === "waiting") {
		return (
			<span
				aria-hidden
				className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground"
			>
				<WorkflowQueueIcon size={14} />
			</span>
		);
	}
	if (state === "expected") {
		return (
			<span
				aria-hidden
				className="flex size-3.5 shrink-0 items-center justify-center text-check-running"
			>
				<span className="size-1.5 rounded-full bg-current" />
			</span>
		);
	}
	return (
		<span
			aria-hidden
			className="flex size-3.5 shrink-0 items-center justify-center text-check-running"
		>
			<PendingSpinner />
		</span>
	);
}

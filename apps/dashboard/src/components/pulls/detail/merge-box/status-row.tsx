import { CheckIcon, ChevronRightIcon, XIcon } from "@diffkit/icons";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@diffkit/ui/components/collapsible";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";

export type StatusType = "success" | "error" | "pending";

export function StatusIcon({ status }: { status: StatusType }) {
	if (status === "success") {
		return (
			<div className="flex size-4 items-center justify-center rounded-full bg-review-approved text-white">
				<CheckIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	if (status === "error") {
		return (
			<div className="flex size-4 items-center justify-center rounded-full bg-review-changes text-white">
				<XIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	return (
		<div className="flex size-4 items-center justify-center rounded-full border-2 border-review-required text-review-required">
			<div className="size-1.5 rounded-full bg-current" />
		</div>
	);
}

const statusTitleClassName = "text-[13px] font-medium text-foreground";

export function StatusRow({
	status,
	title,
	description,
	action,
}: {
	status: StatusType;
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3">
			<div className="mt-0.5 shrink-0">
				<StatusIcon status={status} />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className={statusTitleClassName}>{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}

/** A status row that expands into its details, starting open only when it needs attention. */
export function StatusDisclosure({
	status,
	title,
	titleClassName = statusTitleClassName,
	description,
	defaultOpen,
	pinned,
	children,
}: {
	status: StatusType;
	title: string;
	titleClassName?: string;
	description: string;
	defaultOpen: boolean;
	/** Stays visible under the header whether or not the details are open. */
	pinned?: React.ReactNode;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3 text-left transition-colors hover:bg-item-hover"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status={status} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className={titleClassName}>{title}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</div>
				</button>
			</CollapsibleTrigger>
			{pinned}
			<CollapsibleContent>{children}</CollapsibleContent>
		</Collapsible>
	);
}

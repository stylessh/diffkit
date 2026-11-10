import {
	ChangesRequestIcon,
	CheckIcon,
	CloseIcon,
	CommentIcon,
	TickIcon,
} from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useState, useSyncExternalStore } from "react";
import type { ReviewEvent } from "./review-types";

const MD_QUERY = "(min-width: 768px)";
const mdSubscribe = (cb: () => void) => {
	const mql = window.matchMedia(MD_QUERY);
	mql.addEventListener("change", cb);
	return () => mql.removeEventListener("change", cb);
};
const getMdSnapshot = () => window.matchMedia(MD_QUERY).matches;
const getMdServerSnapshot = () => true;

function useIsDesktop() {
	return useSyncExternalStore(mdSubscribe, getMdSnapshot, getMdServerSnapshot);
}

const reviewOptions: Array<{
	value: ReviewEvent;
	label: string;
	description: string;
	icon: typeof CommentIcon;
	color: string;
}> = [
	{
		value: "COMMENT",
		label: "Comment",
		description: "Leave feedback without a verdict",
		icon: CommentIcon,
		color: "text-muted-foreground",
	},
	{
		value: "APPROVE",
		label: "Approve",
		description: "Approve merging these changes",
		icon: TickIcon,
		color: "text-review-approved",
	},
	{
		value: "REQUEST_CHANGES",
		label: "Request changes",
		description: "Ask for changes before merging",
		icon: ChangesRequestIcon,
		color: "text-review-changes",
	},
];

export function ReviewSubmitPopover({
	pendingCount,
	isSubmitting,
	onSubmit,
	triggerClassName,
}: {
	pendingCount: number;
	isSubmitting: boolean;
	onSubmit: (body: string, event: ReviewEvent) => Promise<boolean>;
	triggerClassName?: string;
}) {
	const [body, setBody] = useState("");
	const [event, setEvent] = useState<ReviewEvent>("COMMENT");
	const [isOpen, setIsOpen] = useState(false);
	const isDesktop = useIsDesktop();

	const handleSubmit = async () => {
		const success = await onSubmit(body, event);
		if (success) {
			setBody("");
			setIsOpen(false);
		}
	};

	const pendingBadge =
		pendingCount > 0 ? (
			<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold tabular-nums">
				{pendingCount}
				<span className="sr-only"> pending</span>
			</span>
		) : null;

	const trigger = (
		<button
			type="button"
			onClick={isDesktop ? undefined : () => setIsOpen(true)}
			className={cn(
				"flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-solid transition-colors hover:bg-indigo/90",
				triggerClassName,
			)}
		>
			Submit review
			{pendingBadge}
		</button>
	);

	const form = (
		<div className="flex flex-col">
			<div className="flex h-9 items-center justify-between border-b-[0.5px] border-popover-border pr-1.5 pl-3">
				<h3 className="text-xs font-medium text-muted-foreground">
					Submit review
				</h3>
				{isDesktop && (
					<button
						type="button"
						aria-label="Close"
						className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
						onClick={() => setIsOpen(false)}
					>
						<CloseIcon size={14} strokeWidth={2} />
					</button>
				)}
			</div>

			<div className="p-1.5">
				<textarea
					value={body}
					onChange={(event) => setBody(event.target.value)}
					placeholder="Leave a summary…"
					aria-label="Review summary"
					rows={3}
					className="w-full resize-y rounded-lg bg-transparent px-2 py-1.5 text-[13px] leading-5 font-[450] text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
				/>
				<fieldset className="flex flex-col">
					<legend className="sr-only">Verdict</legend>
					{reviewOptions.map((option) => {
						const Icon = option.icon;
						const checked = event === option.value;
						return (
							<label
								key={option.value}
								className={cn(
									"flex min-h-8 w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-[7px] transition-colors has-[:focus-visible]:outline-1 has-[:focus-visible]:-outline-offset-1 has-[:focus-visible]:outline-ring",
									checked ? "bg-menu-hover" : "hover:bg-menu-hover",
								)}
							>
								<input
									type="radio"
									name="review-event"
									value={option.value}
									checked={checked}
									onChange={() => setEvent(option.value)}
									className="sr-only"
								/>
								<span className={cn("mt-[3px] flex shrink-0", option.color)}>
									<Icon size={14} strokeWidth={2} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[13px] font-medium text-foreground">
										{option.label}
									</span>
									<span className="block text-xs font-[450] text-muted-foreground">
										{option.description}
									</span>
								</span>
								{checked ? (
									<CheckIcon
										size={14}
										strokeWidth={2}
										className="mt-[3px] shrink-0 text-foreground"
									/>
								) : null}
							</label>
						);
					})}
				</fieldset>
			</div>

			<div className="flex items-center justify-end gap-1.5 border-t-[0.5px] border-popover-border p-2">
				<button
					type="button"
					onClick={() => setIsOpen(false)}
					className="h-7 rounded-md px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={handleSubmit}
					disabled={isSubmitting}
					className="flex h-7 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-solid transition-colors hover:bg-indigo/90 disabled:opacity-45"
				>
					{isSubmitting ? <Spinner size={12} /> : null}
					Submit review
					{pendingBadge}
				</button>
			</div>
		</div>
	);

	if (!isDesktop) {
		return (
			<Drawer open={isOpen} onOpenChange={setIsOpen}>
				{trigger}
				<DrawerContent>
					<DrawerTitle className="sr-only">Submit review</DrawerTitle>
					{form}
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent align="end" className="w-[320px] p-0" sideOffset={6}>
				{form}
			</PopoverContent>
		</Popover>
	);
}

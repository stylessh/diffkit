import {
	CheckIcon,
	CloseIcon,
	CommentIcon,
	GitBranchIcon,
	TickIcon,
} from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import type { ReviewEvent } from "./review-types";

export function ReviewSubmitPopover({
	pendingCount,
	isSubmitting,
	onSubmit,
}: {
	pendingCount: number;
	isSubmitting: boolean;
	onSubmit: (body: string, event: ReviewEvent) => void;
}) {
	const [body, setBody] = useState("");
	const [event, setEvent] = useState<ReviewEvent>("COMMENT");
	const [isOpen, setIsOpen] = useState(false);

	const handleSubmit = () => {
		onSubmit(body, event);
		setBody("");
		setIsOpen(false);
	};

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
			description: "Submit general feedback without explicit approval.",
			icon: CommentIcon,
			color: "text-foreground",
		},
		{
			value: "APPROVE",
			label: "Approve",
			description: "Submit feedback and approve merging these changes.",
			icon: TickIcon,
			color: "text-green-500",
		},
		{
			value: "REQUEST_CHANGES",
			label: "Request changes",
			description: "Submit feedback suggesting changes.",
			icon: GitBranchIcon,
			color: "text-red-500",
		},
	];

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
				>
					Submit review
					{pendingCount > 0 && (
						<span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
							{pendingCount}
						</span>
					)}
				</button>
			</PopoverTrigger>

			<PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
				<div className="flex flex-col">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h3 className="text-sm font-semibold">Finish your review</h3>
						<button
							type="button"
							className="text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => setIsOpen(false)}
						>
							<CloseIcon size={14} strokeWidth={2} />
						</button>
					</div>

					<div className="p-4">
						<textarea
							value={body}
							onChange={(event) => setBody(event.target.value)}
							placeholder="Leave a comment"
							className="min-h-[80px] w-full resize-y rounded-md border bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div className="flex flex-col gap-1 border-t px-4 py-3">
						{reviewOptions.map((option) => {
							const Icon = option.icon;
							return (
								<label
									key={option.value}
									className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-surface-1"
								>
									<input
										type="radio"
										name="review-event"
										value={option.value}
										checked={event === option.value}
										onChange={() => setEvent(option.value)}
										className="mt-0.5"
									/>
									<div className="flex flex-col gap-0.5">
										<span
											className={cn(
												"flex items-center gap-1.5 text-xs font-semibold",
												option.color,
											)}
										>
											<Icon size={13} strokeWidth={2} />
											{option.label}
										</span>
										<span className="text-[11px] text-muted-foreground">
											{option.description}
										</span>
									</div>
								</label>
							);
						})}
					</div>

					<div className="flex items-center justify-between border-t px-4 py-3">
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
						>
							{isSubmitting ? (
								<Spinner size={12} />
							) : (
								<CheckIcon size={12} strokeWidth={2.5} />
							)}
							Submit review
							{pendingCount > 0 && (
								<span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
									{pendingCount}
								</span>
							)}
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

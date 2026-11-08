import { cn } from "@diffkit/ui/lib/utils";

/**
 * A label inline in text, as Linear's timeline names them: an 18px hairline
 * chip with the label's color as a 7px dot (`md` is the 24px row chip).
 */
const sizes = {
	sm: "h-[18px] gap-[5px] pr-1.5 pl-[7px] text-xs",
	md: "h-6 gap-1.5 px-2 text-xs",
};

export function LabelPill({
	name,
	color,
	size = "md",
}: {
	name: string;
	color: string;
	size?: "sm" | "md";
}) {
	const hex = color.startsWith("#") ? color : `#${color}`;
	return (
		<span
			className={cn(
				"relative inline-flex max-w-[220px] items-center rounded-full bg-chip align-middle font-[450] whitespace-nowrap text-muted-foreground shadow-chip",
				sizes[size],
			)}
		>
			<span
				aria-hidden
				className={cn(
					"shrink-0 rounded-full",
					size === "sm" ? "size-[7px]" : "size-2",
				)}
				style={{ backgroundColor: hex }}
			/>
			<span className="truncate">{name}</span>
		</span>
	);
}

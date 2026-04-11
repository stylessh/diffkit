import { cn } from "@diffkit/ui/lib/utils";

const sizes = {
	sm: "px-1.5 py-px text-[10px]",
	md: "px-2.5 py-0.5 text-xs",
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
				"label-pill inline-flex items-center rounded-full font-medium",
				sizes[size],
			)}
			style={{ "--label-color": hex } as React.CSSProperties}
		>
			{name}
		</span>
	);
}

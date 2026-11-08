import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * Linear's metadata chip: a 24px pill on the main surface held by a 0.5px
 * chip-border ring, 12px muted text. Used for the repository, label and
 * branch chips on the right of a list row.
 */
function Chip({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"span"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "span";
	return (
		<Comp
			className={cn(
				"inline-flex h-6 min-w-0 shrink items-center gap-1.5 whitespace-nowrap rounded-full bg-chip px-2 font-[450] text-muted-foreground text-xs shadow-chip [&_svg]:shrink-0",
				className,
			)}
			data-slot="chip"
			{...props}
		/>
	);
}

export { Chip };

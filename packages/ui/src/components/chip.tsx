import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

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

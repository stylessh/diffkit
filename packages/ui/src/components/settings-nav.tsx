import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

function SettingsNavItem({
	asChild = false,
	className,
	...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "a";
	return (
		<Comp
			data-slot="settings-nav-item"
			className={cn(
				"flex h-7 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap text-text-nav transition-colors hover:bg-nav-hover hover:text-foreground [&_svg]:shrink-0 [&_svg]:text-icon-faint",
				"aria-[current=page]:bg-nav-selected aria-[current=page]:text-foreground aria-[current=page]:[&_svg]:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { SettingsNavItem };

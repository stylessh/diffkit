import type * as React from "react";

import { cn } from "../lib/utils";

/** Blends into a parent row (popover search, inline fields) — no border, ring or fill. */
const inputUnstyledPreset =
	"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-base shadow-none outline-none transition-[color] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 md:text-sm";

type InputProps = React.ComponentProps<"input"> & {
	/** Strip the field chrome so the input can sit inside another surface. */
	unstyled?: boolean;
};

function Input({ className, type, unstyled, ...props }: InputProps) {
	return (
		<input
			type={type}
			data-slot="input"
			className={
				unstyled
					? cn(inputUnstyledPreset, className)
					: cn(
							"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-8 w-full min-w-0 rounded-md bg-transparent px-2.5 py-1 text-base shadow-field transition-[color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
							"focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
							"aria-invalid:outline-1 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive",
							className,
						)
			}
			{...props}
		/>
	);
}

export type { InputProps };
export { Input };

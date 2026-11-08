import type * as React from "react";

import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-invalid:outline-1 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive flex field-sizing-content min-h-16 w-full rounded-md bg-transparent px-2.5 py-2 text-base shadow-field transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };

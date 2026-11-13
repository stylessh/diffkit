import { TooltipProvider } from "@diffkit/ui/components/tooltip";
import type { ReactNode } from "react";

/**
 * Tooltips for marks that sit edge to edge, such as the cells of a bar. Each
 * opens at once and closes the moment the pointer leaves its mark. Left to
 * stay open while the pointer travels to its content, as tooltips normally
 * do, one would cover its neighbours and keep them from opening.
 */
export function MarkTooltips({ children }: { children: ReactNode }) {
	return (
		<TooltipProvider
			delayDuration={0}
			skipDelayDuration={0}
			disableHoverableContent
		>
			{children}
		</TooltipProvider>
	);
}

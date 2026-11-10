import type * as React from "react";
import { Drawer, DrawerContent, DrawerTitle } from "./drawer";

/**
 * A detail page's side panel as a drawer, for phones. `DetailLayout` loads it
 * on first open, so desktop, where the panel sits beside the content, never
 * pays for it or for vaul.
 */
export default function DetailPanelDrawer({
	open,
	onOpenChange,
	label,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent aria-describedby={undefined}>
				<DrawerTitle className="sr-only">{label}</DrawerTitle>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}

import { PanelLeftIcon } from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import type { SidebarLayout } from "#/lib/shell/sidebar-layout";

const TOGGLE_KEYS = ["["] as const;

export function SidebarToggleButton({
	layout,
	onToggle,
}: {
	layout: SidebarLayout;
	onToggle: () => void;
}) {
	const label = layout === "expanded" ? "Collapse sidebar" : "Expand sidebar";
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<PageIconButton
					aria-label={label}
					aria-expanded={layout === "expanded"}
					onClick={onToggle}
				>
					<PanelLeftIcon size={14} strokeWidth={2} />
				</PageIconButton>
			</TooltipTrigger>
			<TooltipContent side="right" keys={TOGGLE_KEYS}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

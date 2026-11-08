import { ChevronDownIcon, ChevronUpIcon, ViewIcon } from "@diffkit/icons";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";

export function DiffViewOptions({
	layout,
	onLayoutChange,
	allFilesCollapsed,
	onCollapseAll,
	onExpandAll,
}: {
	layout: "unified" | "split";
	onLayoutChange: (layout: "unified" | "split") => void;
	allFilesCollapsed: boolean;
	onCollapseAll?: () => void;
	onExpandAll?: () => void;
}) {
	const onToggleAll = allFilesCollapsed ? onExpandAll : onCollapseAll;
	const ToggleAllIcon = allFilesCollapsed ? ChevronDownIcon : ChevronUpIcon;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="sm" variant="ghost">
					<ViewIcon size={14} /> Options <ChevronDownIcon size={12} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup
					value={layout}
					onValueChange={(value) =>
						onLayoutChange(value as "unified" | "split")
					}
				>
					<DropdownMenuRadioItem value="unified">Unified</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="split">Split</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				{onToggleAll ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={onToggleAll}>
							<ToggleAllIcon size={14} aria-hidden />
							{allFilesCollapsed ? "Expand All" : "Collapse All"}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

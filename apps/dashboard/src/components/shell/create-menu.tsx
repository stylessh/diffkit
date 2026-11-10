import { PencilEdit02Icon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { memo } from "react";
import { CREATE_ACTIONS } from "#/lib/shell/create-actions";
import {
	useCurrentRepo,
	useStartCreateAction,
} from "#/lib/shell/use-shell-actions";
import { repoFullName } from "#/lib/shell/workspace-repos";

export const CreateMenu = memo(function CreateMenu({
	align = "end",
}: {
	align?: "start" | "end";
}) {
	const currentRepo = useCurrentRepo();
	const startCreateAction = useStartCreateAction();

	return (
		<DropdownMenu modal={false}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<PageIconButton raised aria-label="Create">
							<PencilEdit02Icon size={14} strokeWidth={2} />
						</PageIconButton>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Create</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align={align} className="w-64">
				<DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">
					{currentRepo ? `In ${repoFullName(currentRepo)}` : "Create"}
				</DropdownMenuLabel>
				{CREATE_ACTIONS.map((action) => (
					<DropdownMenuItem
						key={action.id}
						onSelect={() => startCreateAction(action.id)}
					>
						<action.icon size={16} strokeWidth={2} />
						{currentRepo ? action.label : `${action.label}…`}
						<DropdownMenuShortcut keys={action.keys} />
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});

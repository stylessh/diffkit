import {
	BugIcon,
	CommandIcon,
	ExternalLinkIcon,
	HelpCircleIcon,
	XLogo,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";

export function SidebarHelpMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="Help"
					className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground shadow-chip transition-colors hover:text-foreground"
				>
					<HelpCircleIcon size={14} strokeWidth={2} />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="start" className="w-56">
				<DropdownMenuItem asChild>
					<Link to="/settings/shortcuts">
						<CommandIcon size={16} strokeWidth={2} />
						Keyboard shortcuts
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link
						to="/$owner/$repo/issues/new"
						params={{ owner: "stylessh", repo: "diffkit" }}
					>
						<BugIcon size={16} strokeWidth={2} />
						Report an issue
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link
						to="/$owner/$repo"
						params={{ owner: "stylessh", repo: "diffkit" }}
					>
						<ExternalLinkIcon size={16} strokeWidth={2} />
						DiffKit on GitHub
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<a
						href="https://x.com/stylesshDev"
						target="_blank"
						rel="noopener noreferrer"
					>
						<XLogo className="size-3.5" />
						Check for updates
					</a>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

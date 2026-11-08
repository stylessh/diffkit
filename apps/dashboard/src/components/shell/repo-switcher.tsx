import { ChevronDownIcon, RepoIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { openRepoPicker } from "#/lib/shell/shell-overlay";
import { useCurrentRepo } from "#/lib/shell/use-shell-actions";
import { repoFullName } from "#/lib/shell/workspace-repos";
import { RailTooltip, type SidebarDensity } from "./sidebar-nav";

const SWITCH_KEYS = ["O", "R"] as const;

export function RepoSwitcherButton({
	density,
	className,
}: {
	density: SidebarDensity;
	className?: string;
}) {
	const currentRepo = useCurrentRepo();
	const label = currentRepo ? repoFullName(currentRepo) : "Switch repository";

	return (
		<RailTooltip density={density} label="Switch repository" keys={SWITCH_KEYS}>
			<button
				type="button"
				onClick={() => openRepoPicker({ kind: "open" })}
				aria-label={currentRepo ? `Switch repository, current ${label}` : label}
				className={cn(
					"flex h-7 min-w-0 shrink-0 items-center gap-2 rounded-lg bg-button text-[13px] font-medium text-text-strong shadow-button transition-colors hover:bg-button-hover",
					density === "rail" ? "mx-auto w-7 justify-center" : "pr-2 pl-[9px]",
					className,
				)}
			>
				<RepoIcon size={14} strokeWidth={2} className="shrink-0" />
				{density === "full" ? (
					<>
						<span
							className={cn(
								"min-w-0 flex-1 truncate text-left",
								!currentRepo && "text-muted-foreground",
							)}
						>
							{label}
						</span>
						<ChevronDownIcon
							size={12}
							strokeWidth={2}
							className="shrink-0 text-muted-foreground"
						/>
					</>
				) : null}
			</button>
		</RailTooltip>
	);
}

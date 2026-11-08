import { PanelLeftIcon, SearchIcon } from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import { openCommandPalette } from "#/lib/shell/shell-overlay";
import { CreateMenu } from "./create-menu";
import { RepoSwitcherButton } from "./repo-switcher";

export function MobileShellBar({
	onOpenSidebar,
}: {
	onOpenSidebar: () => void;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-1 border-b-[0.5px] border-header-rule bg-main px-2 md:hidden">
			<PageIconButton aria-label="Open navigation" onClick={onOpenSidebar}>
				<PanelLeftIcon size={16} strokeWidth={2} />
			</PageIconButton>
			<RepoSwitcherButton density="full" className="mx-1 min-w-0 flex-1" />
			<PageIconButton aria-label="Search" onClick={openCommandPalette}>
				<SearchIcon size={16} strokeWidth={2} />
			</PageIconButton>
			<CreateMenu />
		</div>
	);
}

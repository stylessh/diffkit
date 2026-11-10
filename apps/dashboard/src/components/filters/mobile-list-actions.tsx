import { FilterIcon, SearchIcon, Sorting01Icon } from "@diffkit/icons";
import {
	MobileActionBar,
	MobileActionButton,
	MobileActionGroup,
} from "@diffkit/ui/components/mobile-action-bar";
import { lazy, Suspense, useState } from "react";
import type { ListFiltersConfig } from "./list-toolbar";
import type { MobileListDrawer } from "./mobile-list-drawers";

const MobileListDrawers = lazy(() => import("./mobile-list-drawers"));

/** A list's Search, Filter and Sort on phones: one pill above the bottom nav, each opening a drawer. */
export function MobileListActions({
	state,
	items,
	searchPlaceholder,
}: ListFiltersConfig) {
	const [open, setOpenState] = useState<MobileListDrawer | null>(null);
	// Stays true after the first open so a closing drawer can animate out.
	const [everOpened, setEverOpened] = useState(false);
	const setOpen = (next: MobileListDrawer | null) => {
		if (next) setEverOpened(true);
		setOpenState(next);
	};

	return (
		<>
			<MobileActionBar label="List actions">
				<MobileActionGroup>
					<MobileActionButton
						icon={<SearchIcon size={15} strokeWidth={2} />}
						active={state.searchQuery !== ""}
						onClick={() => setOpen("search")}
					>
						Search
					</MobileActionButton>
					{state.filterDefs.length > 0 ? (
						<MobileActionButton
							icon={<FilterIcon size={15} strokeWidth={2} />}
							count={state.activeFilters.length}
							active={state.activeFilters.length > 0}
							onClick={() => setOpen("filter")}
						>
							Filter
						</MobileActionButton>
					) : null}
					{state.sortOptions.length > 1 ? (
						<MobileActionButton
							icon={<Sorting01Icon size={15} strokeWidth={2} />}
							onClick={() => setOpen("sort")}
						>
							Sort
						</MobileActionButton>
					) : null}
				</MobileActionGroup>
			</MobileActionBar>

			{everOpened ? (
				<Suspense fallback={null}>
					<MobileListDrawers
						open={open}
						onOpenChange={setOpen}
						state={state}
						items={items}
						searchPlaceholder={searchPlaceholder}
					/>
				</Suspense>
			) : null}
		</>
	);
}

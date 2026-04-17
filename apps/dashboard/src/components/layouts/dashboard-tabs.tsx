import {
	ArchiveIcon,
	ChevronRightIcon,
	CloseIcon,
	GitPullRequestIcon,
	IssuesIcon,
	Remove01Icon,
	ReviewsIcon,
} from "@diffkit/icons";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@diffkit/ui/components/context-menu";
import { cn } from "@diffkit/ui/lib/utils";
import { Link, type useRouter, useRouterState } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { preloadRouteOnce } from "#/lib/route-preload";
import {
	isMergedTab,
	removeMergedTabs,
	removeOtherTabs,
	removeTab,
	removeTabsToRight,
	reorderTabs,
	type Tab,
	useTabs,
} from "#/lib/tab-store";

const tabIconMap = {
	pull: GitPullRequestIcon,
	issue: IssuesIcon,
	review: ReviewsIcon,
	repo: ArchiveIcon,
} as const;

function useScrollShadows(tabCount: number) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const prevTabCountRef = useRef(tabCount);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 0);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		// Scroll to the end when a new tab is added
		if (tabCount > prevTabCountRef.current) {
			el.scrollLeft = el.scrollWidth;
		}
		prevTabCountRef.current = tabCount;
		updateScrollState();

		// Keep gradient visibility in sync with container resizes
		const ro = new ResizeObserver(updateScrollState);
		ro.observe(el);
		return () => ro.disconnect();
	}, [tabCount, updateScrollState]);

	const handleWheel = useCallback(
		(e: React.WheelEvent<HTMLDivElement>) => {
			const el = scrollRef.current;
			if (!el || el.scrollWidth <= el.clientWidth) return;
			if (e.deltaY === 0) return;
			e.preventDefault();
			el.scrollLeft += e.deltaY;
			updateScrollState();
		},
		[updateScrollState],
	);

	return {
		scrollRef,
		canScrollLeft,
		canScrollRight,
		updateScrollState,
		handleWheel,
	};
}

interface DashboardTabsProps {
	tabsReady: boolean;
	routerRef: React.RefObject<ReturnType<typeof useRouter>>;
}

export function DashboardTabs({ tabsReady, routerRef }: DashboardTabsProps) {
	const openTabs = useTabs();
	const dragTabRef = useRef<string | null>(null);
	const [contextTab, setContextTab] = useState<{
		tab: Tab;
		index: number;
	} | null>(null);
	const {
		scrollRef,
		canScrollLeft,
		canScrollRight,
		updateScrollState,
		handleWheel,
	} = useScrollShadows(openTabs.length);

	const handleDragStart = useCallback((id: string) => {
		dragTabRef.current = id;
	}, []);

	const handleDragOver = useCallback(
		(targetId: string) => {
			const dragId = dragTabRef.current;
			if (!dragId || dragId === targetId) return;
			const fromIndex = openTabs.findIndex((t) => t.id === dragId);
			const toIndex = openTabs.findIndex((t) => t.id === targetId);
			if (fromIndex === -1 || toIndex === -1) return;
			const next = [...openTabs];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			reorderTabs(next);
		},
		[openTabs],
	);

	const handleDragEnd = useCallback(() => {
		dragTabRef.current = null;
	}, []);

	// Read pathname imperatively in event handlers (rerender-defer-reads)
	// so the callbacks are stable and don't bust memo on DetailTab.
	const handleCloseTab = useCallback(
		(id: string, tabUrl: string) => {
			const currentPath = routerRef.current.state.location.pathname;
			const isActive = currentPath === tabUrl;
			const index = openTabs.findIndex((tab) => tab.id === id);
			const nextTab =
				index === -1 ? undefined : (openTabs[index + 1] ?? openTabs[index - 1]);
			removeTab(id);
			if (isActive) {
				void routerRef.current.navigate({ to: nextTab?.url ?? "/" });
			}
		},
		[openTabs, routerRef],
	);

	const handleContextClose = useCallback(() => {
		if (!contextTab) return;
		handleCloseTab(contextTab.tab.id, contextTab.tab.url);
	}, [contextTab, handleCloseTab]);

	const handleContextCloseOthers = useCallback(() => {
		if (!contextTab) return;
		const currentPath = routerRef.current.state.location.pathname;
		if (currentPath !== contextTab.tab.url) {
			void routerRef.current.navigate({ to: contextTab.tab.url });
		}
		removeOtherTabs(contextTab.tab.id);
	}, [contextTab, routerRef]);

	const handleContextCloseRight = useCallback(() => {
		if (!contextTab) return;
		removeTabsToRight(contextTab.tab.id);
	}, [contextTab]);

	const handleContextCloseMerged = useCallback(() => {
		const currentPath = routerRef.current.state.location.pathname;
		const activeTabWillClose = openTabs.find(
			(t) => currentPath === t.url && isMergedTab(t),
		);
		removeMergedTabs();
		if (activeTabWillClose) {
			const remaining = openTabs.filter((t) => !isMergedTab(t));
			void routerRef.current.navigate({
				to: remaining[0]?.url ?? "/",
			});
		}
	}, [openTabs, routerRef]);

	const hasMergedTabs = openTabs.some(isMergedTab);

	if (openTabs.length === 0) return null;

	return (
		<div
			aria-hidden={!tabsReady}
			className={cn(
				"flex min-w-0 items-center gap-3 overflow-hidden transition-[opacity,transform] duration-300 ease-out",
				tabsReady
					? "translate-y-0 opacity-100"
					: "pointer-events-none -translate-y-0.5 opacity-0",
			)}
		>
			<div className="hidden h-4 shrink-0 border-l border-border/50 md:block" />
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div className="relative min-w-0 flex-1 overflow-hidden">
						<div
							className={cn(
								"pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-muted to-transparent transition-opacity",
								canScrollLeft ? "opacity-100" : "opacity-0",
							)}
						/>
						<div
							className={cn(
								"pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-muted to-transparent transition-opacity",
								canScrollRight ? "opacity-100" : "opacity-0",
							)}
						/>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: scroll container needs onScroll for gradient visibility */}
						<div
							ref={scrollRef}
							onScroll={updateScrollState}
							onWheel={handleWheel}
							onMouseEnter={updateScrollState}
							className="no-scrollbar flex w-0 min-w-full items-center gap-0.5 overflow-x-auto"
						>
							<ScrollActiveTabIntoView
								scrollRef={scrollRef}
								updateScrollState={updateScrollState}
							/>
							{openTabs.map((tab, index) => {
								const Icon = tabIconMap[tab.type];
								return (
									<DetailTab
										key={tab.id}
										tab={tab}
										icon={Icon}
										onClose={handleCloseTab}
										onDragStart={handleDragStart}
										onDragOver={handleDragOver}
										onDragEnd={handleDragEnd}
										onContextMenu={() => {
											setContextTab({ tab, index });
										}}
										routerRef={routerRef}
									/>
								);
							})}
						</div>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onSelect={handleContextClose}>
						<CloseIcon size={14} strokeWidth={2} />
						Close
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={handleContextCloseOthers}
						disabled={openTabs.length <= 1}
					>
						<Remove01Icon size={14} strokeWidth={2} />
						Close other tabs
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={handleContextCloseRight}
						disabled={!contextTab || contextTab.index === openTabs.length - 1}
					>
						<ChevronRightIcon size={14} strokeWidth={2} />
						Close tabs to the right
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={handleContextCloseMerged}
						disabled={!hasMergedTabs}
					>
						<GitPullRequestIcon
							size={14}
							strokeWidth={2}
							className="text-purple-500"
						/>
						Close merged
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	);
}

/**
 * Isolated component that subscribes to pathname changes to scroll the active
 * tab into view. Extracted so the parent DashboardTabs doesn't re-render on
 * every navigation — only this tiny renderless component does.
 */
function ScrollActiveTabIntoView({
	scrollRef,
	updateScrollState,
}: {
	scrollRef: React.RefObject<HTMLDivElement | null>;
	updateScrollState: () => void;
}) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers scroll-into-view on route change
	useEffect(() => {
		const container = scrollRef.current;
		if (!container) return;
		const activeTab = container.querySelector<HTMLElement>(".active");
		if (!activeTab) return;

		const { left: cLeft, right: cRight } = container.getBoundingClientRect();
		const { left: tLeft, right: tRight } = activeTab.getBoundingClientRect();

		if (tLeft < cLeft || tRight > cRight) {
			activeTab.scrollIntoView({ inline: "nearest", block: "nearest" });
			updateScrollState();
		}
	}, [pathname, scrollRef, updateScrollState]);

	return null;
}

const DetailTab = memo(function DetailTab({
	tab,
	icon: Icon,
	onClose,
	onDragStart,
	onDragOver,
	onDragEnd,
	onContextMenu,
	routerRef,
}: {
	tab: Tab;
	icon: typeof GitPullRequestIcon;
	onClose: (id: string, tabUrl: string) => void;
	onDragStart: (id: string) => void;
	onDragOver: (id: string) => void;
	onDragEnd: () => void;
	onContextMenu: () => void;
	routerRef: React.RefObject<ReturnType<typeof useRouter>>;
}) {
	const preloadTab = () => {
		void preloadRouteOnce(routerRef.current, tab.url);
	};

	return (
		<Link
			to={tab.url}
			draggable
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = "move";
				onDragStart(tab.id);
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				onDragOver(tab.id);
			}}
			onDragEnd={onDragEnd}
			preload={false}
			onMouseEnter={preloadTab}
			onFocus={preloadTab}
			onTouchStart={preloadTab}
			onContextMenu={onContextMenu}
			activeOptions={{ exact: true }}
			activeProps={{ className: "active" }}
			className="group relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground [&.active]:bg-surface-1 [&.active]:text-foreground"
		>
			{tab.avatarUrl ? (
				<img
					src={tab.avatarUrl}
					alt=""
					className="size-3.5 shrink-0 rounded-sm"
				/>
			) : (
				<Icon
					size={13}
					strokeWidth={2}
					className={cn("shrink-0", tab.iconColor)}
				/>
			)}
			<span className="max-w-32 truncate">{tab.title}</span>
			{tab.type === "review" ? (
				<span className="flex items-center gap-1 font-mono text-[11px] font-medium tabular-nums">
					{tab.additions != null && (
						<span className="text-green-500">+{tab.additions}</span>
					)}
					{tab.deletions != null && (
						<span className="text-red-500">-{tab.deletions}</span>
					)}
				</span>
			) : tab.number != null ? (
				<span className="tabular-nums text-muted-foreground text-[11px]">
					#{tab.number}
				</span>
			) : null}
			{/* Mobile: inline close button in flow — oversized touch target */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onClose(tab.id, tab.url);
				}}
				className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md md:hidden"
				aria-label={`Close ${tab.title}`}
			>
				<CloseIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			</button>
			{/* Desktop: overlay close button on hover */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onClose(tab.id, tab.url);
				}}
				className="absolute inset-y-0 right-0 hidden items-center rounded-r-md bg-surface-1 pl-1.5 pr-1.5 opacity-0 transition-opacity group-hover:opacity-100 md:flex"
				aria-label={`Close ${tab.title}`}
			>
				<span className="absolute inset-y-0 -left-3 w-3 bg-gradient-to-r from-transparent to-surface-1" />
				<span className="relative flex size-4 items-center justify-center rounded-sm hover:bg-border/50">
					<CloseIcon size={10} strokeWidth={2} />
				</span>
			</button>
		</Link>
	);
});

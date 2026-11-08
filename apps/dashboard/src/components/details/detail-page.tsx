import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { createContext, useContext, useEffect, useState } from "react";

// Skeleton stagger: quick and calm (no bounce), then a long rest before it replays.
const STAGGER_DELAY = 0.08;
const ITEM_DURATION = 0.3;
const FADE_OUT_DURATION = 0.3;
const PAUSE_BEFORE_RESTART = 1.6;

type StaggerContextValue = {
	cycle: number;
	groupOpacity: ReturnType<typeof useMotionValue<number>>;
};
const defaultGroupOpacity = {
	get: () => 1,
	set: () => {},
} as unknown as ReturnType<typeof useMotionValue<number>>;
const StaggerCycleContext = createContext<StaggerContextValue>({
	cycle: 0,
	groupOpacity: defaultGroupOpacity,
});

function StaggerLoop({
	itemCount,
	children,
}: {
	itemCount: number;
	children: React.ReactNode;
}) {
	const [cycle, setCycle] = useState(0);
	const groupOpacity = useMotionValue(1);

	// biome-ignore lint/correctness/useExhaustiveDependencies: cycle drives the restart loop
	useEffect(() => {
		const lastItemFinish = (itemCount - 1) * STAGGER_DELAY + ITEM_DURATION;
		const totalVisible = lastItemFinish + PAUSE_BEFORE_RESTART;

		const timeout = setTimeout(() => {
			const controls = animate(groupOpacity, 0, {
				duration: FADE_OUT_DURATION,
				ease: "easeInOut",
				onComplete: () => {
					groupOpacity.set(1);
					setCycle((c) => c + 1);
				},
			});
			return () => controls.stop();
		}, totalVisible * 1000);

		return () => clearTimeout(timeout);
	}, [cycle, itemCount, groupOpacity]);

	return (
		<StaggerCycleContext.Provider value={{ cycle, groupOpacity }}>
			{children}
		</StaggerCycleContext.Provider>
	);
}

function StaggerItem({
	children,
	index,
	className,
}: {
	children: React.ReactNode;
	index: number;
	className?: string;
}) {
	const { cycle, groupOpacity } = useContext(StaggerCycleContext);
	const itemOpacity = useMotionValue(0);
	const combinedOpacity = useTransform(
		[itemOpacity, groupOpacity],
		([item, group]) => Math.min(item as number, group as number),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: cycle resets the item animation
	useEffect(() => {
		itemOpacity.set(0);
		const controls = animate(itemOpacity, 1, {
			type: "spring",
			duration: ITEM_DURATION,
			bounce: 0,
			delay: index * STAGGER_DELAY,
		});
		return () => controls.stop();
	}, [cycle, index, itemOpacity]);

	return (
		<motion.div
			key={cycle}
			initial={{ y: 4 }}
			animate={{ y: 0 }}
			transition={{
				type: "spring",
				duration: ITEM_DURATION,
				bounce: 0,
				delay: index * STAGGER_DELAY,
			}}
			style={{ opacity: combinedOpacity }}
			className={className}
		>
			{children}
		</motion.div>
	);
}

type DetailHeaderIcon = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

/**
 * A pull request or issue page, after Linear's issue and diff pages: the
 * breadcrumb header, an optional row of view tabs, then the content column
 * with the properties panel pinned on its right.
 */
export function DetailPageLayout({
	main,
	sidebar,
	header,
	tabs,
}: {
	main: React.ReactNode;
	sidebar: React.ReactNode;
	header?: React.ReactNode;
	tabs?: React.ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			{header}
			{tabs}
			<DetailLayout panel={sidebar}>{main}</DetailLayout>
		</div>
	);
}

/** The breadcrumb row of a detail page: collection › repository › #number title. */
export function DetailPageHeader({
	collectionHref,
	collectionLabel,
	owner,
	repo,
	number,
	icon: Icon,
	iconClassName,
	title,
	titleSuffix,
	actions,
}: {
	collectionHref: string;
	collectionLabel: string;
	owner: string;
	repo: string;
	number: number;
	icon: DetailHeaderIcon;
	iconClassName?: string;
	title: string;
	/** Shown right after the title, e.g. a pull request's line counts. */
	titleSuffix?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<PageHeader actions={actions}>
			<PageHeaderCrumb asChild className="max-md:hidden">
				<Link to={collectionHref}>{collectionLabel}</Link>
			</PageHeaderCrumb>
			<PageHeaderCrumb asChild>
				<Link to="/$owner/$repo" params={{ owner, repo }}>
					{owner}/{repo}
				</Link>
			</PageHeaderCrumb>
			<PageHeaderTitle asChild>
				<span title={title}>
					<Icon size={14} strokeWidth={2} className={iconClassName} />
					<span className="tabular-nums text-muted-foreground">#{number}</span>
					<span className="truncate">{title}</span>
					{titleSuffix}
				</span>
			</PageHeaderTitle>
		</PageHeader>
	);
}

/**
 * The page's own title block: a 22px title and the line under it (state,
 * author, branches). The breadcrumb lives in `DetailPageHeader`; the props
 * that fed it are still accepted so callers stay unchanged.
 */
export function DetailPageTitle({
	title,
	subtitle,
}: {
	collectionHref: string;
	collectionLabel: string;
	owner: string;
	repo: string;
	number: number;
	icon: DetailHeaderIcon;
	iconClassName?: string;
	title: string;
	subtitle: React.ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em] text-pretty text-foreground">
				{title}
			</h1>
			{subtitle}
		</div>
	);
}

export { StaggerItem };

export function DetailPageSkeletonLayout({
	children,
	mainItemCount,
	sidebarSectionCount = 3,
}: {
	children: React.ReactNode;
	mainItemCount: number;
	sidebarSectionCount?: number;
}) {
	const totalItems = Math.max(mainItemCount, sidebarSectionCount);
	return (
		<StaggerLoop itemCount={totalItems}>
			<div className="flex h-full min-h-0 flex-col">
				<PageHeader>
					<Skeleton className="h-3.5 w-56 rounded-md" />
				</PageHeader>
				<DetailLayout
					panel={Array.from({ length: sidebarSectionCount }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items, order never changes
						<StaggerItem key={i} index={i} className="mb-7">
							<div className="flex flex-col gap-2.5">
								<Skeleton className="h-4 w-24 rounded-md" />
								<Skeleton className="h-4 w-full rounded-md" />
							</div>
						</StaggerItem>
					))}
				>
					{children}
				</DetailLayout>
			</div>
		</StaggerLoop>
	);
}

import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { createContext, useContext, useEffect, useState } from "react";

const STAGGER_DELAY = 1;
const ITEM_DURATION = 1.25;
const FADE_OUT_DURATION = 0.5;
const PAUSE_BEFORE_RESTART = 1;

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
			initial={{ y: 8 }}
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

export function DetailPageLayout({
	main,
	sidebar,
}: {
	main: React.ReactNode;
	sidebar: React.ReactNode;
}) {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-8">{main}</div>
				{sidebar}
			</div>
		</div>
	);
}

export function DetailPageTitle({
	collectionHref,
	collectionLabel,
	owner,
	repo,
	number,
	icon: Icon,
	iconClassName,
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
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Link
					to={collectionHref}
					className="transition-colors hover:text-foreground"
				>
					{collectionLabel}
				</Link>
				<span>/</span>
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="transition-colors hover:text-foreground"
				>
					{owner}/{repo}
				</Link>
				<span>/</span>
				<span>#{number}</span>
			</div>

			<div className="flex items-start gap-3">
				<div className={cn("mt-1 shrink-0", iconClassName)}>
					<Icon size={20} strokeWidth={2} />
				</div>
				<div className="flex min-w-0 flex-col gap-2">
					<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
					{subtitle}
				</div>
			</div>
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
			<div className="h-full overflow-auto">
				<div className="mx-auto grid max-w-7xl gap-16 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
					<div className="flex min-w-0 flex-col gap-8">{children}</div>
					<aside className="hidden h-fit flex-col gap-6 xl:sticky xl:top-10 xl:flex">
						{Array.from({ length: sidebarSectionCount }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items, order never changes
							<StaggerItem key={i} index={i}>
								<div className="flex flex-col gap-2.5">
									<Skeleton className="h-4 w-24 rounded-md" />
									<Skeleton className="h-4 w-full rounded-md" />
								</div>
							</StaggerItem>
						))}
					</aside>
				</div>
			</div>
		</StaggerLoop>
	);
}

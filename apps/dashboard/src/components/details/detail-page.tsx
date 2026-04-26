import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type DetailHeaderIcon = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

type DetailPageTitleProps = {
	collectionHref: string;
	collectionLabel: string;
	owner: string;
	repo: string;
	number: number;
	icon: DetailHeaderIcon;
	iconClassName?: string;
	title: string;
	subtitle: ReactNode;
};

export function DetailPageLayout({
	main,
	sidebar,
}: {
	main: ReactNode;
	sidebar: ReactNode;
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
}: DetailPageTitleProps) {
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

export function DetailPageSkeletonLayout({
	children,
	sidebarSectionCount = 3,
}: {
	children: ReactNode;
	sidebarSectionCount?: number;
}) {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-8">{children}</div>
				<aside className="hidden h-fit flex-col gap-6 xl:sticky xl:top-10 xl:flex">
					{Array.from({ length: sidebarSectionCount }, (_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items, order never changes
							key={i}
							className="flex flex-col gap-2.5"
						>
							<Skeleton className="h-4 w-24 rounded-md" />
							<Skeleton className="h-4 w-full rounded-md" />
						</div>
					))}
				</aside>
			</div>
		</div>
	);
}

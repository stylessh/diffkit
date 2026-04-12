import { Skeleton } from "@diffkit/ui/components/skeleton";

export function RepoOverviewSkeleton() {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-10 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-6">
					{/* Header */}
					<div className="flex items-center gap-2">
						<Skeleton className="size-4 rounded" />
						<Skeleton className="h-5 w-48 rounded-md" />
						<Skeleton className="h-5 w-14 rounded-full" />
					</div>

					{/* Toolbar */}
					<div className="flex items-center justify-between">
						<Skeleton className="h-8 w-36 rounded-md" />
						<Skeleton className="h-8 w-20 rounded-md" />
					</div>

					{/* Commit bar + file rows */}
					<div>
						<div className="rounded-t-lg border border-b-0 px-4 py-2.5">
							<div className="flex items-center gap-3">
								<Skeleton className="size-5 rounded-full" />
								<Skeleton className="h-4 w-24 rounded-md" />
								<Skeleton className="h-4 flex-1 rounded-md" />
								<Skeleton className="h-4 w-16 rounded-md" />
							</div>
						</div>
						<div className="overflow-hidden rounded-b-lg border">
							{Array.from({ length: 8 }, (_, i) => `skeleton-row-${i}`).map(
								(key) => (
									<div
										key={key}
										className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
									>
										<Skeleton className="size-4 shrink-0 rounded" />
										<Skeleton className="h-4 w-32 rounded-md" />
										<Skeleton className="h-4 flex-1 rounded-md" />
										<Skeleton className="h-4 w-12 shrink-0 rounded-md" />
									</div>
								),
							)}
						</div>
					</div>
				</div>

				{/* Sidebar skeleton */}
				<aside className="flex h-fit flex-col gap-6 xl:sticky xl:top-10">
					{Array.from({ length: 4 }, (_, i) => `sidebar-skel-${i}`).map(
						(key) => (
							<div key={key} className="flex flex-col gap-2.5">
								<Skeleton className="h-4 w-24 rounded-md" />
								<div className="flex flex-col gap-2">
									<Skeleton className="h-4 w-full rounded-md" />
									<Skeleton className="h-4 w-[85%] rounded-md" />
								</div>
							</div>
						),
					)}
				</aside>
			</div>
		</div>
	);
}

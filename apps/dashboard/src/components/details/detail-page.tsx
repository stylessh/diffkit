import { DetailLayout } from "@diffkit/ui/components/detail-layout";

type DetailHeaderIcon = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

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
			{/* A page without view tabs keeps their row's height, so its content starts where a tabbed page's does. */}
			{tabs ?? <div aria-hidden className="h-11 shrink-0" />}
			<DetailLayout panel={sidebar}>{main}</DetailLayout>
		</div>
	);
}

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
			<h1 className="text-[23px] leading-8 font-semibold tracking-[-0.01em] text-pretty text-foreground">
				{title}
			</h1>
			{subtitle}
		</div>
	);
}

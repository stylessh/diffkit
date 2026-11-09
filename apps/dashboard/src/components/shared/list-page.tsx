import { GroupHeader } from "@diffkit/ui/components/group-header";
import {
	PageHeader,
	PageHeaderCount,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type ComponentType,
	type ReactNode,
	type RefObject,
	useState,
} from "react";
import {
	ActiveFilters,
	ListActions,
	type ListFiltersConfig,
} from "#/components/filters/list-toolbar";
import { SearchQueryProvider } from "./search-highlight";

type ListIcon = ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

export function ListPage({
	title,
	count,
	actions,
	filters,
	toolbar,
	scrollRef,
	className,
	children,
}: {
	title: ReactNode;
	count?: number;
	actions?: ReactNode;
	filters?: ListFiltersConfig;
	toolbar?: ReactNode;
	scrollRef?: RefObject<HTMLDivElement | null>;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader
				actions={
					actions || filters ? (
						<>
							{actions}
							{filters ? <ListActions {...filters} /> : null}
						</>
					) : undefined
				}
			>
				<PageHeaderTitle>{title}</PageHeaderTitle>
				{count !== undefined ? (
					<PageHeaderCount>{count}</PageHeaderCount>
				) : null}
			</PageHeader>
			{filters ? <ActiveFilters {...filters} /> : null}
			{toolbar}
			<div
				ref={scrollRef}
				className={cn(
					"min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-10",
					className,
				)}
			>
				<SearchQueryProvider query={filters?.state.searchQuery ?? ""}>
					{children}
				</SearchQueryProvider>
			</div>
		</div>
	);
}

export function ListGroup({
	id,
	icon: Icon,
	title,
	label,
	count,
	defaultOpen = true,
	children,
}: {
	id?: string;
	icon?: ListIcon;
	title: string;
	label?: string;
	count: number;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	if (count === 0) return null;

	return (
		<section
			id={id}
			aria-label={label ?? title}
			style={{ contentVisibility: "auto", containIntrinsicSize: "auto 44px" }}
		>
			<GroupHeader
				className="sticky top-0 z-10"
				icon={Icon ? <Icon size={14} strokeWidth={2} /> : undefined}
				title={title}
				label={label}
				count={count}
				open={open}
				onToggle={() => setOpen((value) => !value)}
			/>
			{open ? <div className="flex flex-col py-0.5">{children}</div> : null}
		</section>
	);
}

export function ListEmpty({ children }: { children: ReactNode }) {
	return (
		<p className="px-3 py-16 text-center text-[13px] text-pretty text-muted-foreground">
			{children}
		</p>
	);
}

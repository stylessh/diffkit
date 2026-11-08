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

type ListIcon = ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

export function ListPage({
	title,
	count,
	actions,
	toolbar,
	scrollRef,
	className,
	children,
}: {
	title: ReactNode;
	count?: number;
	actions?: ReactNode;
	toolbar?: ReactNode;
	scrollRef?: RefObject<HTMLDivElement | null>;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader actions={actions}>
				<PageHeaderTitle>{title}</PageHeaderTitle>
				{count !== undefined ? (
					<PageHeaderCount>{count}</PageHeaderCount>
				) : null}
			</PageHeader>
			{toolbar ? (
				<div className="flex min-h-11 shrink-0 items-center px-2 py-1.5">
					{toolbar}
				</div>
			) : null}
			<div
				ref={scrollRef}
				className={cn(
					"min-h-0 flex-1 overflow-y-auto px-2 pb-10",
					!toolbar && "pt-2",
					className,
				)}
			>
				{children}
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
	const isEmpty = count === 0;

	return (
		<section
			id={id}
			aria-label={label ?? title}
			style={{ contentVisibility: "auto", containIntrinsicSize: "auto 44px" }}
		>
			<GroupHeader
				className={cn("sticky top-0 z-10", isEmpty && "opacity-60")}
				icon={Icon ? <Icon size={14} strokeWidth={2} /> : undefined}
				title={title}
				label={label}
				count={count}
				open={open && !isEmpty}
				onToggle={isEmpty ? undefined : () => setOpen((value) => !value)}
			/>
			{open && !isEmpty ? (
				<div className="flex flex-col py-0.5">{children}</div>
			) : null}
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

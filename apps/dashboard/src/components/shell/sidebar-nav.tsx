import { ChevronRightIcon } from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ComponentType, type ReactNode, useState } from "react";

export type SidebarDensity = "full" | "rail";

export type SidebarIcon = ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

const rowClassName =
	"group/nav flex h-7 min-w-0 shrink-0 items-center gap-2 rounded-lg text-[13px] font-medium text-text-nav transition-colors hover:bg-nav-hover hover:text-foreground [&.active]:bg-nav-selected [&.active]:text-foreground";

export function sidebarRowClassName(density: SidebarDensity) {
	return cn(
		rowClassName,
		density === "rail"
			? "relative mx-auto w-7 justify-center"
			: "mx-3 px-[9px]",
	);
}

export function RailTooltip({
	density,
	label,
	keys,
	children,
}: {
	density: SidebarDensity;
	label: string;
	keys?: readonly string[];
	children: ReactNode;
}) {
	if (density === "full") return children;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="right" keys={keys}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function NavCount({ count, dot }: { count?: number; dot?: boolean }) {
	if (dot) {
		return (
			<>
				<span
					aria-hidden
					className="mr-0.5 ml-auto size-1.5 shrink-0 rounded-full bg-indigo"
				/>
				<span className="sr-only">Unread</span>
			</>
		);
	}
	if (typeof count !== "number" || count === 0) return null;
	return (
		<span className="ml-auto shrink-0 text-[11px] font-[450] tabular-nums text-muted-foreground">
			{count}
		</span>
	);
}

export function SidebarNavRow({
	to,
	label,
	icon: Icon,
	count,
	dot,
	keys,
	density,
}: {
	to: string;
	label: string;
	icon: SidebarIcon;
	count?: number;
	dot?: boolean;
	keys?: readonly string[];
	density: SidebarDensity;
}) {
	const railLabel =
		typeof count === "number" && count > 0 ? `${label} ${count}` : label;
	return (
		<RailTooltip density={density} label={label} keys={keys}>
			<Link
				to={to}
				preload={false}
				activeOptions={{ exact: true }}
				activeProps={{ className: "active", "aria-current": "page" }}
				aria-label={density === "rail" ? railLabel : undefined}
				className={sidebarRowClassName(density)}
			>
				<Icon size={14} strokeWidth={2} className="shrink-0" />
				{density === "full" ? (
					<>
						<span className="truncate">{label}</span>
						<NavCount count={count} dot={dot} />
					</>
				) : dot ? (
					<span
						aria-hidden
						className="absolute top-1 right-1 size-1.5 rounded-full bg-indigo"
					/>
				) : null}
			</Link>
		</RailTooltip>
	);
}

export function SidebarSection({
	label,
	labelTo,
	action,
	density,
	children,
}: {
	label: string;
	labelTo?: string;
	action?: ReactNode;
	density: SidebarDensity;
	children: ReactNode;
}) {
	const [fold, setFold] = useState<"open" | "folded">("open");
	if (density === "rail") {
		return (
			<div className="mx-3 mt-3 flex flex-col gap-px border-t-[0.5px] border-header-rule pt-3">
				{children}
			</div>
		);
	}
	const open = fold === "open";
	const toggle = () => setFold(open ? "folded" : "open");
	return (
		<section aria-label={label} className="mt-4 flex flex-col">
			<div className="group/section mx-3 mb-0.5 flex h-7 items-center rounded-lg pr-1 pl-[9px] text-xs font-medium text-text-nav hover:bg-nav-hover">
				{labelTo ? (
					<Link
						to={labelTo}
						preload={false}
						className="flex h-full items-center hover:text-foreground"
					>
						{label}
					</Link>
				) : (
					<button
						type="button"
						onClick={toggle}
						className="flex h-full items-center"
					>
						{label}
					</button>
				)}
				<button
					type="button"
					aria-expanded={open}
					aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
					onClick={toggle}
					className="flex h-full items-center pl-0.5"
				>
					<ChevronRightIcon
						size={12}
						strokeWidth={2}
						className={cn("transition-transform", open && "rotate-90")}
					/>
				</button>
				{action ? (
					<span className="ml-auto flex opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100">
						{action}
					</span>
				) : null}
			</div>
			{open ? <div className="flex flex-col gap-px">{children}</div> : null}
		</section>
	);
}

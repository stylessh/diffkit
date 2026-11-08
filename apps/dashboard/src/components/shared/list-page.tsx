import { cn } from "@diffkit/ui/lib/utils";
import {
	type ComponentType,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

type ListIcon = ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

/**
 * The scroll container and two-column frame shared by the list pages
 * (pulls, issues, reviews, repositories): a narrow index on the left, the
 * list on the right. The scroll container is the one sticky group headers
 * measure against.
 */
export const listPageScrollClassName = "h-full overflow-auto py-10";
export const listPageGridClassName =
	"mx-auto grid max-w-7xl gap-8 px-3 md:px-6 xl:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)] xl:gap-12";

/** A list page's title and one line under it: 16px semibold over 13px muted. */
export function ListPageHeading({
	title,
	children,
}: {
	title: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1 px-2">
			<h1 className="text-base font-semibold tracking-tight text-foreground">
				{title}
			</h1>
			{children ? (
				<p className="text-[13px] text-pretty text-muted-foreground">
					{children}
				</p>
			) : null}
		</div>
	);
}

/**
 * One entry in a list page's index: a 32px row like Linear's sidebar items,
 * its count right-aligned in tabular figures. With `href` it jumps to its
 * group; an empty group reads as disabled.
 */
export function ListGroupNavItem({
	href,
	icon: Icon,
	label,
	value,
}: {
	href?: string;
	icon: ListIcon;
	label: string;
	value: number;
}) {
	const content = (
		<>
			<span className="flex min-w-0 items-center gap-2">
				<Icon
					size={14}
					strokeWidth={2}
					className="shrink-0 text-muted-foreground"
				/>
				<span className="truncate text-[13px] font-medium">{label}</span>
			</span>
			<span className="text-xs tabular-nums text-muted-foreground">
				{value}
			</span>
		</>
	);
	const base =
		"flex h-8 items-center justify-between gap-3 rounded-md px-2 text-text-strong";

	if (!href || value === 0) {
		return (
			<div
				aria-disabled={value === 0 ? "true" : undefined}
				className={cn(base, value === 0 && "opacity-60")}
			>
				{content}
			</div>
		);
	}

	return (
		<a
			href={href}
			className={cn(
				base,
				"transition-colors hover:bg-row-hover hover:text-foreground",
			)}
		>
			{content}
		</a>
	);
}

/** The column of `ListGroupNavItem`s under a list page's heading. */
export function ListGroupNav({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<nav aria-label={label} className="flex flex-col gap-px">
			{children}
		</nav>
	);
}

/**
 * A group's banner, after Linear's: 36px, rounded, the group's fill, its count
 * next to its name. It sticks to the top of the list while its rows scroll
 * under it and takes a hairline shadow once stuck.
 */
export function StickyGroupHeader({
	sectionRef,
	scrollContainerRef,
	stickyTop: stickyTopOffset,
	icon: Icon,
	title,
	count,
	isEmpty,
}: {
	sectionRef: RefObject<HTMLElement | null>;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	stickyTop: number;
	icon: ListIcon;
	title: string;
	count: number;
	isEmpty: boolean;
}) {
	const headerRef = useRef<HTMLDivElement>(null);
	const [isStickyActive, setIsStickyActive] = useState(false);

	useEffect(() => {
		const scrollContainer = scrollContainerRef.current;
		const section = sectionRef.current;
		const header = headerRef.current;

		if (!scrollContainer || !section || !header) {
			return;
		}

		const updateStickyState = () => {
			const scrollContainerRect = scrollContainer.getBoundingClientRect();
			const sectionRect = section.getBoundingClientRect();
			const stickyTop = scrollContainerRect.top + stickyTopOffset;
			const headerHeight = header.offsetHeight;
			const isStuck =
				sectionRect.top <= stickyTop &&
				sectionRect.bottom > stickyTop + headerHeight;

			setIsStickyActive((current) => (current === isStuck ? current : isStuck));
		};

		updateStickyState();
		scrollContainer.addEventListener("scroll", updateStickyState, {
			passive: true,
		});
		window.addEventListener("resize", updateStickyState);

		return () => {
			scrollContainer.removeEventListener("scroll", updateStickyState);
			window.removeEventListener("resize", updateStickyState);
		};
	}, [scrollContainerRef, sectionRef, stickyTopOffset]);

	return (
		<div
			ref={headerRef}
			className={cn(
				"sticky -top-8 z-10 flex h-9 items-center gap-2 rounded-lg bg-group px-3 transition-shadow",
				isStickyActive && "shadow-card",
				isEmpty && "opacity-60",
			)}
		>
			<Icon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<h2 className="truncate text-[13px] font-medium text-text-strong">
				{title}
			</h2>
			<span className="text-[13px] tabular-nums text-muted-foreground">
				{count}
			</span>
		</div>
	);
}

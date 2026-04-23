import { ChevronRightIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import {
	type ComponentType,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

const ACCORDION_ANIMATION_ITEM_LIMIT = 5;

export function StickyGroupHeader({
	sectionRef,
	scrollContainerRef,
	stickyTop: stickyTopOffset,
	icon: Icon,
	title,
	count,
	isEmpty,
	isCollapsed,
	onCollapsedChange,
}: {
	sectionRef: RefObject<HTMLElement | null>;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	stickyTop: number;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	title: string;
	count: number;
	isEmpty: boolean;
	isCollapsed: boolean;
	onCollapsedChange: (isCollapsed: boolean) => void;
}) {
	const headerRef = useRef<HTMLButtonElement>(null);
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
		<button
			type="button"
			ref={headerRef}
			aria-expanded={!isCollapsed}
			disabled={isEmpty}
			onClick={() => onCollapsedChange(!isCollapsed)}
			style={{ top: stickyTopOffset }}
			className={cn(
				"sticky z-10 flex w-full items-center justify-between gap-3 rounded-lg bg-surface-1 px-3 py-2 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-surface-2",
				isStickyActive && "shadow-lg",
				isEmpty && "cursor-default opacity-70",
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<ChevronRightIcon
					size={14}
					strokeWidth={2}
					className={cn(
						"shrink-0 text-muted-foreground transition-transform",
						!isCollapsed && !isEmpty && "rotate-90",
						isEmpty && "opacity-35",
					)}
				/>
				<div className="shrink-0 text-muted-foreground">
					<Icon size={15} strokeWidth={1.9} />
				</div>
				<span className="truncate text-sm font-medium">{title}</span>
			</div>
			<span className="text-sm tabular-nums text-muted-foreground">
				{count}
			</span>
		</button>
	);
}

export function StickyGroupContent({
	children,
	isCollapsed,
	itemCount,
}: {
	children: ReactNode;
	isCollapsed: boolean;
	itemCount: number;
}) {
	if (itemCount === 0) {
		return null;
	}

	const usesAccordionAnimation = itemCount < ACCORDION_ANIMATION_ITEM_LIMIT;

	if (usesAccordionAnimation) {
		return (
			<AnimatePresence initial={false}>
				{!isCollapsed && (
					<motion.div
						initial={{ height: 0, opacity: 0, y: -6 }}
						animate={{ height: "auto", opacity: 1, y: 0 }}
						exit={{ height: 0, opacity: 0, y: -6 }}
						transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
						className="overflow-hidden"
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		);
	}

	return (
		<AnimatePresence initial={false}>
			{!isCollapsed && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16, ease: "easeOut" }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

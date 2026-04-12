import { ChevronLeftIcon, ChevronRightIcon } from "@diffkit/icons";
import { motion } from "motion/react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

type SidePanelState = {
	node: HTMLDivElement | null;
	collapsed: boolean;
	hasContent: boolean;
	toggle: () => void;
};

const SidePanelContext = createContext<SidePanelState>({
	node: null,
	collapsed: false,
	hasContent: false,
	toggle: () => {},
});

export function useSidePanelSlot() {
	const [node, setNode] = useState<HTMLDivElement | null>(null);
	const [collapsed, setCollapsed] = useState(false);
	const [hasContent, setHasContent] = useState(false);
	const toggle = useCallback(() => setCollapsed((c) => !c), []);
	return {
		node,
		setNode,
		collapsed,
		hasContent,
		setHasContent,
		toggle,
	} as const;
}

export function SidePanelProvider({
	value,
	children,
}: {
	value: SidePanelState;
	children: React.ReactNode;
}) {
	return <SidePanelContext value={value}>{children}</SidePanelContext>;
}

export function SidePanelPortal({ children }: { children: React.ReactNode }) {
	const { node } = useContext(SidePanelContext);
	if (!node) return null;
	return createPortal(children, node);
}

export function SidePanelSlot({
	slotRef,
	collapsed,
	onHasContent,
}: {
	slotRef: (el: HTMLDivElement | null) => void;
	collapsed: boolean;
	onHasContent: (v: boolean) => void;
}) {
	const [hasChildren, setHasChildren] = useState(false);
	const innerRef = useRef<HTMLDivElement | null>(null);

	const refCallback = useCallback(
		(el: HTMLDivElement | null) => {
			innerRef.current = el;
			slotRef(el);
		},
		[slotRef],
	);

	useEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		const check = () => {
			const has = el.childNodes.length > 0;
			setHasChildren(has);
			onHasContent(has);
		};

		check();
		const observer = new MutationObserver(check);
		observer.observe(el, { childList: true });
		el.addEventListener("sidepanel-content", check);
		return () => {
			observer.disconnect();
			el.removeEventListener("sidepanel-content", check);
		};
	}, [onHasContent]);

	const show = hasChildren && !collapsed;

	return (
		<motion.div
			animate={{ width: show ? "auto" : 0 }}
			transition={{ type: "spring", stiffness: 400, damping: 35 }}
			className="hidden shrink-0 overflow-hidden xl:block"
		>
			<motion.div
				animate={{ opacity: show ? 1 : 0 }}
				transition={{ duration: show ? 0.2 : 0.1, delay: show ? 0.1 : 0 }}
				className="h-full overflow-y-auto overflow-x-hidden pb-2 pl-2"
			>
				<div ref={refCallback} />
			</motion.div>
		</motion.div>
	);
}

export function SidePanelToggle() {
	const { collapsed, toggle, hasContent } = useContext(SidePanelContext);
	if (!hasContent) return null;

	return (
		<button
			type="button"
			onClick={toggle}
			className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 bg-surface-1 py-2.5 pl-0.5 pr-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground xl:flex"
		>
			{collapsed ? (
				<ChevronLeftIcon size={12} strokeWidth={2} />
			) : (
				<ChevronRightIcon size={12} strokeWidth={2} />
			)}
		</button>
	);
}

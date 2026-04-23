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
import { useLocalStorageState } from "#/lib/use-local-storage-state";

// w-72 (288px) + pl-2 (8px)
export const SIDE_PANEL_WIDTH = 296;
const SIDE_PANEL_COLLAPSED_STORAGE_KEY = "diffkit:side-panel-collapsed";

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

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

export function useSidePanelSlot() {
	const [node, setNode] = useState<HTMLDivElement | null>(null);
	const [collapsed, setCollapsed] = useLocalStorageState(
		SIDE_PANEL_COLLAPSED_STORAGE_KEY,
		{
			defaultValue: false,
			parse: (raw) => raw === "true",
			validate: isBoolean,
		},
	);
	const [hasContent, setHasContent] = useState(false);
	const toggle = useCallback(() => setCollapsed((c) => !c), [setCollapsed]);
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
	const ghostRef = useRef<HTMLDivElement | null>(null);
	const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
		const observer = new MutationObserver((mutations) => {
			const has = el.childNodes.length > 0;

			if (!has && ghostRef.current) {
				// Content removed — clone into ghost for exit animation
				ghostRef.current.innerHTML = "";
				for (const mutation of mutations) {
					for (const node of mutation.removedNodes) {
						ghostRef.current.appendChild(node.cloneNode(true));
					}
				}
				if (exitTimer.current) clearTimeout(exitTimer.current);
				exitTimer.current = setTimeout(() => {
					if (ghostRef.current) ghostRef.current.innerHTML = "";
				}, 500);
			} else if (has && ghostRef.current) {
				// Content added — clear ghost
				ghostRef.current.innerHTML = "";
				if (exitTimer.current) clearTimeout(exitTimer.current);
			}

			setHasChildren(has);
			onHasContent(has);
		});
		observer.observe(el, { childList: true });
		el.addEventListener("sidepanel-content", check);
		return () => {
			observer.disconnect();
			el.removeEventListener("sidepanel-content", check);
			if (exitTimer.current) clearTimeout(exitTimer.current);
		};
	}, [onHasContent]);

	const show = hasChildren && !collapsed;

	return (
		<div className="hidden overflow-hidden xl:block">
			<motion.div
				animate={{ opacity: show ? 1 : 0 }}
				transition={{ duration: show ? 0.2 : 0.1, delay: show ? 0.1 : 0 }}
				className="h-full overflow-y-auto overflow-x-hidden pb-2 pl-2"
			>
				<div ref={refCallback} />
				<div ref={ghostRef} className="pointer-events-none" aria-hidden />
			</motion.div>
		</div>
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

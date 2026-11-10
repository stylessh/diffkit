import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type FocusComment = () => void;
type Register = (focus: FocusComment | null) => void;

const CommentTargetContext = createContext<Register | null>(null);

/**
 * Lets a detail page's comment box tell the page layout it exists, so the
 * layout can offer a floating "Comment" action on phones that jumps to it.
 */
export function useCommentTarget(): [FocusComment | null, Register] {
	const [focus, setFocus] = useState<FocusComment | null>(null);
	const register = useCallback<Register>((next) => setFocus(() => next), []);
	return [focus, register];
}

export function CommentTargetProvider({
	register,
	children,
}: {
	register: Register;
	children: ReactNode;
}) {
	return (
		<CommentTargetContext.Provider value={register}>
			{children}
		</CommentTargetContext.Provider>
	);
}

/** Registers the box whose root is `ref`: scroll it into view, then focus its field. */
export function useRegisterCommentTarget(
	ref: RefObject<HTMLElement | null>,
	enabled: boolean,
) {
	const register = useContext(CommentTargetContext);
	useEffect(() => {
		if (!register || !enabled) return;
		register(() => {
			const root = ref.current;
			if (!root) return;
			root.scrollIntoView({ block: "center", behavior: "smooth" });
			root.querySelector<HTMLTextAreaElement>("textarea")?.focus({
				preventScroll: true,
			});
		});
		return () => register(null);
	}, [register, enabled, ref]);
}

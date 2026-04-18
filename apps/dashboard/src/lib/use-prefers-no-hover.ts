import { useEffect, useState } from "react";

/**
 * True when the primary input cannot hover (e.g. touch-first / `(hover: none)`).
 */
export function usePrefersNoHover() {
	const [prefersNoHover, setPrefersNoHover] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(hover: none)");
		const sync = () => setPrefersNoHover(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	return prefersNoHover;
}

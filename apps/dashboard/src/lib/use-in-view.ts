import { useEffect, useRef, useState } from "react";

/** Becomes true once the element nears the viewport, then stays true. */
export function useInView<T extends Element>(enabled: boolean) {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!enabled || inView || !element) return;
		if (typeof IntersectionObserver === "undefined") {
			setInView(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [enabled, inView]);

	return { ref, inView };
}

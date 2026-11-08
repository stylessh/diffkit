import type { SVGProps } from "react";

/**
 * Tag glyph matching the hugeicons stroke style used by `@diffkit/icons`.
 * Local until the icons package exports one (lift it there and delete this).
 */
export function TagIcon({
	size = 24,
	strokeWidth = 1.5,
	...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height={size}
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={strokeWidth}
			viewBox="0 0 24 24"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path d="M7.5 7.5h.01" />
			<path d="M2.5 9.4V4.5a2 2 0 0 1 2-2h4.9a2 2 0 0 1 1.41.59l9.6 9.6a2 2 0 0 1 0 2.82l-4.9 4.9a2 2 0 0 1-2.82 0l-9.6-9.6A2 2 0 0 1 2.5 9.4Z" />
		</svg>
	);
}

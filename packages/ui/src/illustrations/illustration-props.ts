import type { SVGProps } from "react";

/** Shared props for empty-state SVG illustrations */
export type IllustrationProps = SVGProps<SVGSVGElement> & {
	size?: number;
};

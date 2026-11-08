import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 98;
const VIEWBOX_HEIGHT = 87;

export function EmptyCliKeysIllustrationDark({
	size = VIEWBOX_WIDTH,
	width,
	height,
	className,
	...rest
}: IllustrationProps) {
	const uid = useId().replace(/:/g, "");
	const resolvedWidth = width ?? size;
	const resolvedHeight =
		height ??
		(typeof resolvedWidth === "number"
			? (resolvedWidth * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH
			: VIEWBOX_HEIGHT);

	return (
		<svg
			aria-hidden="true"
			className={cn("shrink-0", className)}
			fill="none"
			height={resolvedHeight}
			overflow="visible"
			viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
			width={resolvedWidth}
			xmlns="http://www.w3.org/2000/svg"
			{...rest}
		>
			<g filter={`url(#${uid}-filter0)`}>
				<rect
					width="91.356"
					height="77"
					x="3"
					y="2.5"
					fill={`url(#${uid}-paint0)`}
					rx="10"
				/>
			</g>
			<g filter={`url(#${uid}-filter1)`}>
				<path
					d="m21.061 24.686 15.696 13.885a1.5 1.5 0 0 1 0 2.247L21.061 54.703"
					stroke="#494B4D"
					strokeLinecap="round"
					strokeWidth="2"
				/>
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d="M41.639 56.313H68.35"
					stroke="#494B4D"
					strokeLinecap="round"
					strokeWidth="2"
				/>
			</g>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="49.029"
					x2="49.029"
					y1="-12.805"
					y2="79.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#2A2C2D" />
					<stop offset="1" stopColor="#161718" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="97.356"
					height="86.5"
					x="0"
					y="0"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="-0.5" dy="-1.5" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.709804 0 0 0 0 0.709804 0 0 0 0 0.709804 0 0 0 0.5 0"
					/>
					<feBlend
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="1.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
					/>
					<feBlend
						in2="effect1_dropShadow"
						mode="normal"
						result="effect2_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.710337 0 0 0 0 0.710337 0 0 0 0 0.710337 0 0 0 0.5 0"
					/>
					<feBlend
						in2="effect2_dropShadow"
						mode="normal"
						result="effect3_dropShadow"
					/>
					<feBlend
						in="SourceGraphic"
						in2="effect3_dropShadow"
						mode="normal"
						result="shape"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="6" />
					<feGaussianBlur stdDeviation="11.5" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.126999 0 0 0 0 0.129137 0 0 0 0 0.133413 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="26.203"
					height="42.017"
					x="16.061"
					y="21.686"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-1.5" />
					<feGaussianBlur stdDeviation="0.25" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0.6 0"
					/>
					<feBlend
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"
					/>
					<feBlend
						in2="effect1_dropShadow"
						mode="normal"
						result="effect2_dropShadow"
					/>
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="36.711"
					height="12"
					x="36.639"
					y="53.313"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0.6 0"
					/>
					<feBlend
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"
					/>
					<feBlend
						in2="effect1_dropShadow"
						mode="normal"
						result="effect2_dropShadow"
					/>
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
			</defs>
		</svg>
	);
}

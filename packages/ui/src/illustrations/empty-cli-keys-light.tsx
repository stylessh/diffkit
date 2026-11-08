import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 219;
const VIEWBOX_HEIGHT = 187;

const CARD_PATH =
	"M1.5 17.5c0-8.284 6.716-15 15-15h186c8.284 0 15 6.716 15 15v152c0 8.284-6.716 15-15 15h-186c-8.284 0-15-6.716-15-15z";

const CHEVRON_PATH =
	"m44.7 54.94 38.844 34.352a1.5 1.5 0 0 1 0 2.247L44.7 125.89";

const UNDERSCORE_PATH = "M93.486 129.559h62.885";

export function EmptyCliKeysIllustrationLight({
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
				<path d={CARD_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path
				d={CARD_PATH}
				stroke={`url(#${uid}-card-stroke)`}
				strokeWidth="1.5"
			/>
			<g filter={`url(#${uid}-filter1)`}>
				<path
					d={CHEVRON_PATH}
					stroke="#F6F6F6"
					strokeLinecap="round"
					strokeWidth="5"
				/>
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d={UNDERSCORE_PATH}
					stroke="#F6F6F6"
					strokeLinecap="round"
					strokeWidth="5"
				/>
			</g>
			<defs>
				<linearGradient
					id={`${uid}-card-stroke`}
					x1="1.5"
					x2="217.5"
					y1="93.5"
					y2="93.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E4E4E4" />
					<stop offset="0.12" stopColor="#F0F0F0" />
					<stop offset="0.5" stopColor="#F6F6F6" />
					<stop offset="0.88" stopColor="#F0F0F0" />
					<stop offset="1" stopColor="#E4E4E4" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="110.415"
					x2="108.67"
					y1="51.792"
					y2="184.489"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#E8EDF1" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="219"
					height="187"
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
					<feOffset dy="1" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.5" />
					<feComposite
						in="blur1"
						in2="hardAlpha"
						operator="out"
						result="shadow1"
					/>
					<feColorMatrix
						in="shadow1"
						result="dropShadow1Color"
						type="matrix"
						values="0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0.45 0"
					/>
					<feBlend
						in="dropShadow1Color"
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha2"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-1" result="offset2" />
					<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
					<feComposite
						in="blur2"
						in2="hardAlpha2"
						operator="out"
						result="shadow2"
					/>
					<feColorMatrix
						in="shadow2"
						result="dropShadow2Color"
						type="matrix"
						values="0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 1 0"
					/>
					<feBlend
						in="dropShadow2Color"
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
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha3"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="3.5" result="offset3" />
					<feGaussianBlur in="offset3" result="blur3" stdDeviation="0.25" />
					<feComposite
						in="blur3"
						in2="hardAlpha3"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow1"
					/>
					<feColorMatrix
						in="innerShadow1"
						result="innerShadow1Color"
						type="matrix"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow1Color"
						in2="shape"
						mode="normal"
						result="effect3_innerShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha4"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-3.5" result="offset4" />
					<feGaussianBlur in="offset4" result="blur4" stdDeviation="0.5" />
					<feComposite
						in="blur4"
						in2="hardAlpha4"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow2"
					/>
					<feColorMatrix
						in="innerShadow2"
						result="innerShadow2Color"
						type="matrix"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow2Color"
						in2="effect3_innerShadow"
						mode="normal"
						result="effect4_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="48.35"
					height="79.949"
					x="40.2"
					y="52.441"
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
					<feOffset dy="2" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="1" />
					<feComposite
						in="blur1"
						in2="hardAlpha"
						operator="out"
						result="shadow1"
					/>
					<feColorMatrix
						in="shadow1"
						result="dropShadowColor"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feBlend
						in="SourceGraphic"
						in2="effect1_dropShadow"
						mode="normal"
						result="shape"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha2"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2" result="offset2" />
					<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
					<feComposite
						in="blur2"
						in2="hardAlpha2"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow1"
					/>
					<feColorMatrix
						in="innerShadow1"
						result="innerShadow1Color"
						type="matrix"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow1Color"
						in2="shape"
						mode="normal"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="71.886"
					height="9"
					x="88.986"
					y="127.059"
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
					<feOffset dy="2" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="1" />
					<feComposite
						in="blur1"
						in2="hardAlpha"
						operator="out"
						result="shadow1"
					/>
					<feColorMatrix
						in="shadow1"
						result="dropShadowColor"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						mode="normal"
						result="effect1_dropShadow"
					/>
					<feBlend
						in="SourceGraphic"
						in2="effect1_dropShadow"
						mode="normal"
						result="shape"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha2"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2" result="offset2" />
					<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
					<feComposite
						in="blur2"
						in2="hardAlpha2"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow1"
					/>
					<feColorMatrix
						in="innerShadow1"
						result="innerShadow1Color"
						type="matrix"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow1Color"
						in2="shape"
						mode="normal"
						result="effect2_innerShadow"
					/>
				</filter>
			</defs>
		</svg>
	);
}

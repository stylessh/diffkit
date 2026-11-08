import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 267;
const VIEWBOX_HEIGHT = 253;

const TRAY_PATH =
	"M18.034 231.102V128.135H85.78a5 5 0 0 1 5 5.001v14.033a8 8 0 0 0 8 8h68.542a8 8 0 0 0 8-8v-14.034a5 5 0 0 1 5-5h69.712v102.967c0 8.284-6.716 15-15 15h-202c-8.284 0-15-6.716-15-15";

const TRAY_STROKE_PATH = `${TRAY_PATH}Z`;

export function EmptyInboxIllustrationDark({
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
			<path
				d="M59.905 19.017h148.258a5 5 0 0 1 4.712 3.329l37.159 104.806v83.56h-232v-83.56L55.193 22.346a5 5 0 0 1 4.712-3.33Z"
				fill={`url(#${uid}-paint0)`}
				stroke={`url(#${uid}-paint1)`}
			/>
			<g filter={`url(#${uid}-filter0)`}>
				<path
					d="M63.254 136.983v-116H59.46a4 4 0 0 0-3.815 2.799L20 136.983z"
					fill="#131515"
				/>
			</g>
			<g filter={`url(#${uid}-filter1)`}>
				<path
					d="M202.847 128.136V20h3.858a4 4 0 0 1 3.79 2.72l35.607 105.416z"
					fill="#141516"
				/>
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path d={TRAY_PATH} fill={`url(#${uid}-paint2)`} />
			</g>
			<path
				d={TRAY_STROKE_PATH}
				stroke={`url(#${uid}-paint3)`}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="134.034"
					x2="134.034"
					y1="19.017"
					y2="210.712"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1F20" />
					<stop offset="1" stopColor="#0D0F0F" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="134.034"
					x2="134.034"
					y1="33.345"
					y2="201.819"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#8F8F8F" />
					<stop offset="0.55" stopColor="#5D5D5D" />
					<stop offset="1" stopColor="#151515" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="135.017"
					x2="134.334"
					y1="160.085"
					y2="246.104"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#202324" />
					<stop offset="1" stopColor="#141617" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="134.034"
					x2="134.147"
					y1="134.017"
					y2="204.517"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#515151" />
					<stop offset="1" stopColor="#282828" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="83.254"
					height="156"
					x="0"
					y="0.983"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						in="SourceGraphic"
						in2="BackgroundImageFix"
						mode="normal"
						result="shape"
					/>
					<feGaussianBlur result="effect1_foregroundBlur" stdDeviation="10" />
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="83.254"
					height="148.135"
					x="182.847"
					y="0"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						in="SourceGraphic"
						in2="BackgroundImageFix"
						mode="normal"
						result="shape"
					/>
					<feGaussianBlur result="effect1_foregroundBlur" stdDeviation="10" />
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="241"
					height="126.966"
					x="13.534"
					y="125.635"
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
					<feOffset dy="2" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0"
					/>
					<feBlend
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
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.164706 0 0 0 0 0.168627 0 0 0 0 0.172549 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
			</defs>
		</svg>
	);
}

import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 267;
const VIEWBOX_HEIGHT = 253;

const TRAY_PATH =
	"M18.034 231.102V128.135H85.78a5 5 0 0 1 5 5.001v14.033a8 8 0 0 0 8 8h68.542a8 8 0 0 0 8-8v-14.034a5 5 0 0 1 5-5h69.712v102.967c0 8.284-6.716 15-15 15h-202c-8.284 0-15-6.716-15-15";

const TRAY_STROKE_PATH = `${TRAY_PATH}Z`;

export function InboxSelectNotificationIllustrationDark({
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
				d="M59.92 17.017h148.229a5 5 0 0 1 4.718 3.347l37.167 106.089v84.564h-232v-84.564L55.2 20.363a5 5 0 0 1 4.72-3.346Z"
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
					d="M202.848 128.136V20h3.857a4 4 0 0 1 3.79 2.72l35.607 105.416z"
					fill="#141516"
				/>
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d="M189.457 34.017a5 5 0 0 0-5-5H84.356a5 5 0 0 0-5 5v56.97a5 5 0 0 0 5 5h100.101a5 5 0 0 0 5-5z"
					fill="#262828"
				/>
				<path
					d="M184.457 29.267H84.356a4.75 4.75 0 0 0-4.75 4.75v56.97a4.75 4.75 0 0 0 4.75 4.75h100.101a4.75 4.75 0 0 0 4.75-4.75v-56.97a4.75 4.75 0 0 0-4.75-4.75Z"
					stroke={`url(#${uid}-paint2)`}
					strokeWidth="0.5"
				/>
			</g>
			<g filter={`url(#${uid}-filter3)`}>
				<path
					d="M199.288 53.213a5 5 0 0 0-5-5H74.525a5 5 0 0 0-5 5v56.97a5 5 0 0 0 5 5h119.763a5 5 0 0 0 5-5z"
					fill="#262828"
				/>
				<path
					d="M194.288 48.463H74.525a4.75 4.75 0 0 0-4.75 4.75v56.97a4.75 4.75 0 0 0 4.75 4.75h119.763a4.75 4.75 0 0 0 4.75-4.75v-56.97a4.75 4.75 0 0 0-4.75-4.75Z"
					stroke={`url(#${uid}-paint3)`}
					strokeWidth="0.5"
				/>
			</g>
			<g filter={`url(#${uid}-filter4)`}>
				<path
					d="M209.119 72.91a5 5 0 0 0-5-5H64.695a5 5 0 0 0-5 5v72.728a5 5 0 0 0 5 5h139.424a5 5 0 0 0 5-5z"
					fill="#262828"
				/>
				<path
					d="M204.119 68.16H64.695a4.75 4.75 0 0 0-4.75 4.75v72.728a4.75 4.75 0 0 0 4.75 4.75h139.424a4.75 4.75 0 0 0 4.75-4.75V72.91l-.006-.244a4.75 4.75 0 0 0-4.744-4.506Z"
					stroke={`url(#${uid}-paint4)`}
					strokeWidth="0.5"
				/>
			</g>
			<g filter={`url(#${uid}-filter5)`}>
				<path
					d="M218.949 92.608a5 5 0 0 0-5-5H54.864a5 5 0 0 0-5 5v96.364a5 5 0 0 0 5 5H213.95a5 5 0 0 0 5-5z"
					fill="#262828"
				/>
				<path
					d="M213.949 87.858H54.864a4.75 4.75 0 0 0-4.75 4.75v96.363a4.75 4.75 0 0 0 4.75 4.75H213.95a4.75 4.75 0 0 0 4.75-4.75V92.608a4.75 4.75 0 0 0-4.75-4.75Z"
					stroke={`url(#${uid}-paint5)`}
					strokeWidth="0.5"
				/>
			</g>
			<g filter={`url(#${uid}-filter6)`}>
				<rect
					width="188.746"
					height="124.091"
					fill="#262828"
					rx="5"
					transform="matrix(-1 0 0 1 228.78 107.305)"
				/>
				<rect
					width="188.246"
					height="123.591"
					x="-0.25"
					y="0.25"
					rx="4.75"
					stroke={`url(#${uid}-paint6)`}
					strokeWidth="0.5"
					transform="matrix(-1 0 0 1 228.28 107.305)"
				/>
			</g>
			<g filter={`url(#${uid}-filter7)`}>
				<path d={TRAY_PATH} fill={`url(#${uid}-paint7)`} />
			</g>
			<path
				d={TRAY_STROKE_PATH}
				stroke={`url(#${uid}-paint8)`}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="134.034"
					x2="134.034"
					y1="17.017"
					y2="211.017"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1F20" />
					<stop offset="1" stopColor="#0D0F0F" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="134.034"
					x2="134.034"
					y1="31.517"
					y2="202.017"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#8F8F8F" />
					<stop offset="0.55" stopColor="#5D5D5D" />
					<stop offset="1" stopColor="#151515" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="134.407"
					x2="134.407"
					y1="29.017"
					y2="95.987"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D4D4" />
					<stop offset="1" stopColor="#292929" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="134.407"
					x2="134.407"
					y1="48.213"
					y2="115.183"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D4D4" />
					<stop offset="1" stopColor="#292929" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint4`}
					x1="134.407"
					x2="134.407"
					y1="67.91"
					y2="150.638"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D4D4" />
					<stop offset="1" stopColor="#292929" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint5`}
					x1="134.407"
					x2="134.407"
					y1="87.608"
					y2="193.972"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D4D4" />
					<stop offset="1" stopColor="#292929" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint6`}
					x1="94.373"
					x2="94.373"
					y1="0"
					y2="124.091"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D4D4" />
					<stop offset="1" stopColor="#292929" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint7`}
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
					id={`${uid}-paint8`}
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
					x="182.848"
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
					width="116.102"
					height="74.97"
					x="76.356"
					y="25.017"
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
					<feGaussianBlur stdDeviation="1.5" />
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
					<feGaussianBlur stdDeviation="10" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.24521 0 0 0 0 0.247901 0 0 0 0 0.248798 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter3`}
					width="135.763"
					height="74.97"
					x="66.525"
					y="44.213"
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
					<feGaussianBlur stdDeviation="1.5" />
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
					<feGaussianBlur stdDeviation="10" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.24521 0 0 0 0 0.247901 0 0 0 0 0.248798 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter4`}
					width="155.424"
					height="90.727"
					x="56.695"
					y="63.91"
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
					<feGaussianBlur stdDeviation="1.5" />
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
					<feGaussianBlur stdDeviation="10" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.24521 0 0 0 0 0.247901 0 0 0 0 0.248798 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter5`}
					width="175.085"
					height="114.364"
					x="46.864"
					y="83.608"
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
					<feGaussianBlur stdDeviation="1.5" />
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
					<feGaussianBlur stdDeviation="10" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.24521 0 0 0 0 0.247901 0 0 0 0 0.248798 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter6`}
					width="194.746"
					height="132.091"
					x="37.034"
					y="103.305"
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
					<feGaussianBlur stdDeviation="1.5" />
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
					<feGaussianBlur stdDeviation="10" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.24521 0 0 0 0 0.247901 0 0 0 0 0.248798 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter7`}
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

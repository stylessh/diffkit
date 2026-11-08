import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 219;
const VIEWBOX_HEIGHT = 243;

const HEX_PATH =
	"M1.5 61.024a15 15 0 0 1 8.642-13.586l93-43.524a15 15 0 0 1 12.716 0l93 43.524a15 15 0 0 1 8.642 13.586v120.57a15 15 0 0 1-8.613 13.572l-93 43.767a15 15 0 0 1-12.774 0l-93-43.767A15 15 0 0 1 1.5 181.594z";

const KEY_PATH =
	"M109.5 74.939c11.598 0 21 9.402 21 21 0 8.839-5.462 16.402-13.194 19.5h.194v16.5h5.5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5.5v8h4.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-4.5v4.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-43.698c-8.156-2.883-14-10.659-14-19.802 0-11.598 9.402-21 21-21m0 11.66a9.34 9.34 0 1 0 0 18.68 9.34 9.34 0 0 0 0-18.68";

const KEY_STROKE_PATH =
	"m117.306 115.439-.372-.929.372 1.929zm.194 0h1v-1h-1zm0 16.5h-1v1h1zm5.5 8v1zm-5.5 0v-1h-1v1zm0 8h-1v1h1zm6.5 2h1zm-2 5v1zm-4.5 0v-1h-1v1zm-3 7.5v1zm-12-46.698h1v-.707l-.667-.235zm7-40.802v1c11.046 0 20 8.954 20 20h2c0-12.15-9.85-22-22-22zm21 21h-1c0 8.416-5.2 15.62-12.566 18.571l.372.929.372.928c8.098-3.245 13.822-11.166 13.822-20.428zm-13.194 19.5v1h.194v-2h-.194zm.194 0h-1v16.5h2v-16.5zm0 16.5v1h5.5v-2h-5.5zm5.5 0v1a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zm2 2h-1v4h2v-4zm0 4h-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zm-2 2v-1h-5.5v2h5.5zm-5.5 0h-1v8h2v-8zm0 8v1h4.5v-2h-4.5zm4.5 0v1a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zm2 2h-1v3h2v-3zm0 3h-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zm-2 2v-1h-4.5v2h4.5zm-4.5 0h-1v4.5h2v-4.5zm0 4.5h-1a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4zm-3 3v-1h-9v2h9zm-9 0v-1a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4zm-3-3h1v-43.698h-2v43.698zm0-43.698.333-.942c-7.769-2.747-13.333-10.154-13.333-18.86h-2c0 9.58 6.124 17.725 14.667 20.745zm-14-19.802h1c0-11.046 8.954-20 20-20v-2c-12.15 0-22 9.85-22 22zm21-9.34v-1c-5.711 0-10.34 4.629-10.34 10.34h2a8.34 8.34 0 0 1 8.34-8.34zm-9.34 9.34h-1c0 5.71 4.629 10.339 10.34 10.339v-2a8.34 8.34 0 0 1-8.34-8.34zm9.34 9.339v1c5.711 0 10.34-4.629 10.34-10.34h-2a8.34 8.34 0 0 1-8.34 8.34zm9.34-9.34h1c0-5.71-4.629-10.34-10.34-10.34v2a8.34 8.34 0 0 1 8.34 8.34z";

export function EmptySshKeysIllustrationLight({
	size = VIEWBOX_WIDTH,
	width,
	height,
	className,
	...rest
}: IllustrationProps) {
	const uid = useId().replace(/:/g, "");
	const keyMaskId = `${uid}-key-mask`;
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
				<path d={HEX_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path d={HEX_PATH} stroke={`url(#${uid}-hex-stroke)`} strokeWidth="1.5" />
			<g filter={`url(#${uid}-filter1)`}>
				<circle cx="109.5" cy="95.939" fill="#F4F6F9" r="10" />
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path d={KEY_PATH} fill={`url(#${uid}-paint1)`} />
			</g>
			<mask id={keyMaskId} fill="white">
				<path d={KEY_PATH} />
			</mask>
			<path
				d={KEY_STROKE_PATH}
				fill={`url(#${uid}-key-stroke)`}
				mask={`url(#${keyMaskId})`}
			/>
			<defs>
				<linearGradient
					id={`${uid}-hex-stroke`}
					x1="1.5"
					x2="217.5"
					y1="121.5"
					y2="121.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E4E4E4" />
					<stop offset="0.12" stopColor="#F0F0F0" />
					<stop offset="0.5" stopColor="#F6F6F6" />
					<stop offset="0.88" stopColor="#F0F0F0" />
					<stop offset="1" stopColor="#E4E4E4" />
				</linearGradient>
				<linearGradient
					id={`${uid}-key-stroke`}
					x1="109.5"
					x2="109.5"
					y1="74.939"
					y2="165.939"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F0F0F0" />
					<stop offset="0.35" stopColor="#DEDEDE" />
					<stop offset="1" stopColor="#D2D2D2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="110.415"
					x2="107.356"
					y1="66.209"
					y2="241.901"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#E8EDF1" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="109.5"
					x2="109.5"
					y1="74.939"
					y2="116.939"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F6F8FB" />
					<stop offset="1" stopColor="#F1F3F7" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="219"
					height="242.861"
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
					<feOffset dy="4" result="offset3" />
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
					<feOffset dy="-4.5" result="offset4" />
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
					width="20"
					height="24"
					x="99.5"
					y="85.939"
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
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="4.5" />
					<feComposite
						in="blur1"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow1"
					/>
					<feColorMatrix
						in="innerShadow1"
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						mode="normal"
						result="effect1_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="47"
					height="92.5"
					x="86"
					y="73.939"
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
					<feOffset dy="1.5" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="1.25" />
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
						values="0 0 0 0 0.72476 0 0 0 0 0.72476 0 0 0 0 0.72476 0 0 0 0.5 0"
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
					<feOffset dy="2.5" result="offset2" />
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

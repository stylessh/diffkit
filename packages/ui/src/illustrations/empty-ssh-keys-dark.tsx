import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 223;
const VIEWBOX_HEIGHT = 246;

const SHIELD_PATH =
	"M3 63.295a20 20 0 0 1 11.532-18.119L102.72 3.958a20 20 0 0 1 16.937 0l88.189 41.218a20 20 0 0 1 11.531 18.119v114.264a20 20 0 0 1-11.492 18.101l-88.189 41.448a20 20 0 0 1-17.014 0l-88.19-41.448A20 20 0 0 1 3 177.559z";

const KEY_PATH =
	"M111 78c11.598 0 21 9.402 21 21 0 8.765-5.371 16.274-13 19.42v15.08h5.5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H119v8h4.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H119v4.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-42.197C95.844 115.92 90 108.143 90 99c0-11.598 9.402-21 21-21m0 11.66a9.34 9.34 0 1 0 0 18.68 9.34 9.34 0 0 0 0-18.68";

export function EmptySshKeysIllustrationDark({
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
				<path d={SHIELD_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path
				d={SHIELD_PATH}
				stroke={`url(#${uid}-shield-stroke)`}
				strokeWidth="2"
			/>
			<g filter={`url(#${uid}-filter1)`}>
				<path d={KEY_PATH} fill={`url(#${uid}-paint1)`} />
			</g>
			<path d={KEY_PATH} stroke={`url(#${uid}-key-stroke)`} strokeWidth="1.5" />
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="112.021"
					x2="112.021"
					y1="-47.923"
					y2="241.106"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#272A2B" />
					<stop offset="1" stopColor="#131416" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="115.25"
					x2="115.25"
					y1="117"
					y2="164"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#262929" />
					<stop offset="1" stopColor="#232424" />
				</linearGradient>
				<linearGradient
					id={`${uid}-shield-stroke`}
					x1="112.021"
					x2="112.021"
					y1="3.958"
					y2="241.106"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#B8B8B8" stopOpacity="0.55" />
					<stop offset="0.45" stopColor="#6E7376" stopOpacity="0.35" />
					<stop offset="1" stopColor="#3A3D3F" stopOpacity="0.2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-key-stroke`}
					x1="115.25"
					x2="115.25"
					y1="78"
					y2="164"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#C4C4C4" stopOpacity="0.45" />
					<stop offset="1" stopColor="#5A5D5F" stopOpacity="0.25" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="242.377"
					height="268.931"
					x="-10"
					y="-9.423"
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
					<feOffset dy="-0.5" result="offset1" />
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
						values="0 0 0 0 0.917067 0 0 0 0 0.917067 0 0 0 0 0.917067 0 0 0 0.85 0"
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
					<feOffset dy="4" result="offset2" />
					<feGaussianBlur in="offset2" result="blur2" stdDeviation="1.5" />
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
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
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
					<feOffset dy="10.5" result="offset3" />
					<feGaussianBlur in="offset3" result="blur3" stdDeviation="14.5" />
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
						values="0 0 0 0 0.134332 0 0 0 0 0.143335 0 0 0 0 0.147837 0 0 0 1 0"
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
					<feOffset dx="1" result="offset4" />
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
						values="0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0.17 0"
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
					width="54"
					height="98"
					x="84"
					y="71.5"
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
					<feOffset dy="-0.5" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.5" />
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
						values="0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0 0.917647 0 0 0 0.5 0"
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
				</filter>
			</defs>
		</svg>
	);
}

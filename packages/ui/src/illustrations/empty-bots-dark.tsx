import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 102;
const VIEWBOX_HEIGHT = 91;

export function EmptyBotsIllustrationDark({
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
				<path
					d="M90.053 50.43h7.888a1.284 1.284 0 1 1 0 2.568h-7.888z"
					fill="#232526"
				/>
			</g>
			<g filter={`url(#${uid}-filter1)`}>
				<path
					d="M11.172 50.613H3.284a1.284 1.284 0 0 0 0 2.568h7.888z"
					fill="#232627"
				/>
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d="M39.964 4.22A1.11 1.11 0 0 1 39.983 2H47.8a4.28 4.28 0 0 1 4.28 4.28v7.46a1.1 1.1 0 1 1-2.201 0V7.833a3.505 3.505 0 0 0-3.447-3.505z"
					fill="#292C2D"
				/>
			</g>
			<g filter={`url(#${uid}-filter3)`}>
				<path
					d="M21.252 84h59.102c5.523 0 10-4.477 10-10V23.913c0-5.523-4.477-10-10-10H21.252c-5.523 0-10 4.477-10 10V74c0 5.523 4.477 10 10 10"
					fill={`url(#${uid}-paint0)`}
				/>
			</g>
			<g filter={`url(#${uid}-filter4)`}>
				<rect
					width="23.114"
					height="2.935"
					x="39.424"
					y="61.069"
					fill="#464648"
					rx="1.468"
				/>
			</g>
			<g filter={`url(#${uid}-filter5)`}>
				<path
					d="M34.469 33.553a1.467 1.467 0 1 1 2.935 0v8.071a1.468 1.468 0 0 1-2.935 0z"
					fill={`url(#${uid}-paint1)`}
				/>
			</g>
			<g filter={`url(#${uid}-filter6)`}>
				<path
					d="M64.92 33.553a1.468 1.468 0 0 1 2.935 0v8.071a1.468 1.468 0 1 1-2.935 0z"
					fill={`url(#${uid}-paint2)`}
				/>
			</g>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="51.107"
					x2="51.107"
					y1="-0.018"
					y2="84"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#272A2B" />
					<stop offset="1" stopColor="#131416" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="35.936"
					x2="35.936"
					y1="32.085"
					y2="43.092"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#6C6E71" />
					<stop offset="1" stopColor="#3E4142" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="66.388"
					x2="66.388"
					y1="32.085"
					y2="43.092"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#6C6E71" />
					<stop offset="1" stopColor="#3E4142" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="13.172"
					height="8.568"
					x="88.053"
					y="49.429"
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
					<feOffset dy="-0.5" />
					<feGaussianBlur stdDeviation="0.25" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.580529 0 0 0 0 0.580529 0 0 0 0 0.580529 0 0 0 1 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="13.172"
					height="8.568"
					x="0"
					y="49.613"
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
					<feOffset dy="-0.5" />
					<feGaussianBlur stdDeviation="0.25" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.74399 0 0 0 0 0.74399 0 0 0 0 0.74399 0 0 0 0.85 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="17.209"
					height="19.841"
					x="36.873"
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
					<feOffset dx="-0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.816181 0 0 0 0 0.816181 0 0 0 0 0.816181 0 0 0 0.85 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter3`}
					width="85.102"
					height="79.087"
					x="8.252"
					y="11.913"
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
					<feOffset dx="-0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.671875 0 0 0 0 0.671875 0 0 0 0 0.671875 0 0 0 0.85 0"
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
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
					<feGaussianBlur stdDeviation="14.5" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix
						result="innerShadowColor"
						type="matrix"
						values="0 0 0 0 0.172549 0 0 0 0 0.184314 0 0 0 0 0.188235 0 0 0 1 0"
					/>
					<feBlend in="innerShadowColor" in2="shape" mode="normal" />
				</filter>
				<filter
					id={`${uid}-filter4`}
					width="27.113"
					height="9.935"
					x="37.424"
					y="59.069"
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
					<feOffset dx="-0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.691106 0 0 0 0 0.691106 0 0 0 0 0.691106 0 0 0 1 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter5`}
					width="6.936"
					height="18.007"
					x="32.469"
					y="30.085"
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
					<feOffset dx="-0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.792067 0 0 0 0 0.792067 0 0 0 0 0.792067 0 0 0 0.85 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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
					<feBlend
						in="SourceGraphic"
						in2="effect2_dropShadow"
						mode="normal"
						result="shape"
					/>
				</filter>
				<filter
					id={`${uid}-filter6`}
					width="6.936"
					height="18.007"
					x="62.92"
					y="30.085"
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
					<feOffset dx="-0.5" dy="-1" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0.792067 0 0 0 0 0.792067 0 0 0 0 0.792067 0 0 0 0.85 0"
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
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="1" />
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

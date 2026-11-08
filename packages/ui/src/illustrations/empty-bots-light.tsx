import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 105;
const VIEWBOX_HEIGHT = 93;
/** Extra top room so body stroke + highlight aren't clipped by the viewBox. */
const VIEWBOX_MIN_Y = -2;
const VIEWBOX_RENDER_HEIGHT = VIEWBOX_HEIGHT - VIEWBOX_MIN_Y;

const BODY_PATH =
	"M20.397 90h64.445c5.523 0 10-4.477 10-10V23.243c0-5.523-4.477-10-10-10H20.397c-5.523 0-10 4.477-10 10V80c0 5.523 4.477 10 10 10";

const BODY_STROKE_PATH =
	"M20.397 90h64.445c5.523 0 10-4.477 10-10V23.243c0-5.523-4.477-10-10-10H20.397c-5.523 0-10 4.477-10 10V80c0 5.523 4.477 10 10 10Z";

const STROKE_EYE = "#D4D7DC";
const STROKE_MOUTH = "#DFE4EB";
const EYE_FILL = "#EDEFF3";

export function EmptyBotsIllustrationLight({
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
			? (resolvedWidth * VIEWBOX_RENDER_HEIGHT) / VIEWBOX_WIDTH
			: VIEWBOX_RENDER_HEIGHT);
	const supersample = 2;
	const renderWidth =
		typeof resolvedWidth === "number"
			? resolvedWidth * supersample
			: resolvedWidth;
	const renderHeight =
		typeof resolvedHeight === "number"
			? resolvedHeight * supersample
			: resolvedHeight;

	return (
		<svg
			aria-hidden="true"
			className={cn("shrink-0", className)}
			fill="none"
			height={renderHeight}
			overflow="visible"
			style={
				typeof resolvedWidth === "number"
					? { width: resolvedWidth, height: resolvedHeight }
					: undefined
			}
			viewBox={`0 ${VIEWBOX_MIN_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_RENDER_HEIGHT}`}
			width={renderWidth}
			xmlns="http://www.w3.org/2000/svg"
			{...rest}
		>
			<g filter={`url(#${uid}-filter0)`}>
				<g filter={`url(#${uid}-filter1)`}>
					<path
						d="M1.5 54.5A2.5 2.5 0 0 1 4 52h6.5v5H4a2.5 2.5 0 0 1-2.5-2.5"
						fill="#F1F3F7"
					/>
				</g>
				<g filter={`url(#${uid}-filter2)`}>
					<path
						d="M103.5 54.5A2.5 2.5 0 0 0 101 52h-6.5v5h6.5a2.5 2.5 0 0 0 2.5-2.5"
						fill="#F1F3F7"
					/>
				</g>
				<g filter={`url(#${uid}-filter3)`}>
					<path
						d="M41.785 4.774a1.887 1.887 0 1 1 0-3.774h10.341a1 1 0 0 1 1 1v11.454a2.313 2.313 0 0 1-4.626 0v-7.68a1 1 0 0 0-1-1z"
						fill="#F5F7FA"
					/>
				</g>
			</g>
			<path
				d="M4 52.5h6v4H4a2 2 0 1 1 0-4Z"
				stroke={`url(#${uid}-outer-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1"
			/>
			<path
				d="M101 52.5h-6v4h6a2 2 0 1 0 0-4Z"
				stroke={`url(#${uid}-outer-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1"
			/>
			<path
				d="M41.784 1.5h10.342a.5.5 0 0 1 .5.5v11.454a1.813 1.813 0 1 1-3.626 0v-7.68a1.5 1.5 0 0 0-1.5-1.5h-5.716a1.388 1.388 0 0 1 0-2.774Z"
				stroke={`url(#${uid}-outer-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1"
			/>
			<g filter={`url(#${uid}-filter4)`}>
				<path d={BODY_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path
				d={BODY_STROKE_PATH}
				stroke={`url(#${uid}-outer-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1"
			/>
			<g filter={`url(#${uid}-filter5)`}>
				<path
					d="M35.666 37.826a2.07 2.07 0 0 1 4.14 0v8.316a2.07 2.07 0 0 1-4.14 0z"
					fill={EYE_FILL}
				/>
			</g>
			<path
				d="M37.736 36.006a1.82 1.82 0 0 1 1.82 1.82v8.316a1.82 1.82 0 1 1-3.64 0v-8.316a1.82 1.82 0 0 1 1.82-1.82Z"
				stroke={STROKE_EYE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter6)`}>
				<path
					d="M66.494 37.826a2.07 2.07 0 0 1 4.14 0v8.316a2.07 2.07 0 1 1-4.14 0z"
					fill={EYE_FILL}
				/>
			</g>
			<path
				d="M68.565 36.006a1.82 1.82 0 0 1 1.819 1.82v8.316a1.82 1.82 0 1 1-3.64 0v-8.316a1.82 1.82 0 0 1 1.82-1.82Z"
				stroke={STROKE_EYE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter7)`}>
				<rect
					width="25.919"
					height="4.018"
					x="39.691"
					y="63.079"
					fill="#F5F7FA"
					rx="2.009"
				/>
			</g>
			<rect
				width="25.419"
				height="3.518"
				x="39.941"
				y="63.329"
				rx="1.759"
				stroke={STROKE_MOUTH}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter8)`}>
				<path d="M93.5 53h3v3h-3z" fill="#F1F3F7" />
			</g>
			<g filter={`url(#${uid}-filter9)`}>
				<path d="M6.5 53h5v3h-5z" fill="#F1F3F7" />
			</g>
			<defs>
				<linearGradient
					id={`${uid}-outer-stroke`}
					x1="10"
					x2="95"
					y1="46.5"
					y2="46.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E8E8E8" stopOpacity="0.72" />
					<stop offset="0.12" stopColor="#F0F0F0" stopOpacity="0.78" />
					<stop offset="0.5" stopColor="#F6F6F6" stopOpacity="0.82" />
					<stop offset="0.88" stopColor="#F0F0F0" stopOpacity="0.78" />
					<stop offset="1" stopColor="#E8E8E8" stopOpacity="0.72" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="52.977"
					x2="52.183"
					y1="34.031"
					y2="89.994"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#E8EDF1" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="105"
					height="92.5"
					x="0"
					y="0"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="0.5" result="offsetDropShadow" />
					<feGaussianBlur
						in="offsetDropShadow"
						result="blurDropShadow"
						stdDeviation="0.75"
					/>
					<feComposite
						in="blurDropShadow"
						in2="hardAlpha"
						operator="out"
						result="dropShadowShape"
					/>
					<feColorMatrix
						in="dropShadowShape"
						result="dropShadowColor"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						result="effect1_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="9"
					height="6"
					x="1.5"
					y="52"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect1_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="9"
					height="6"
					x="94.5"
					y="52"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect1_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter3`}
					width="14.23"
					height="15.767"
					x="39.897"
					y="1"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="2" dy="2.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect1_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter4`}
					width="87.445"
					height="81.757"
					x="8.896"
					y="10.743"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1" result="offsetDropShadow1" />
					<feGaussianBlur
						in="offsetDropShadow1"
						result="blurDropShadow1"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurDropShadow1"
						in2="hardAlpha"
						operator="out"
						result="dropShadow1Shape"
					/>
					<feColorMatrix
						in="dropShadow1Shape"
						result="dropShadow1Color"
						values="0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0.45 0"
					/>
					<feBlend
						in="dropShadow1Color"
						in2="BackgroundImageFix"
						result="effect1_dropShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-1" result="offsetDropShadow2" />
					<feGaussianBlur
						in="offsetDropShadow2"
						result="blurDropShadow2"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurDropShadow2"
						in2="hardAlpha"
						operator="out"
						result="dropShadow2Shape"
					/>
					<feColorMatrix
						in="dropShadow2Shape"
						result="dropShadow2Color"
						values="0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 1 0"
					/>
					<feBlend
						in="dropShadow2Color"
						in2="effect1_dropShadow"
						result="effect2_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect2_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2.5" result="offsetInnerShadow1" />
					<feGaussianBlur
						in="offsetInnerShadow1"
						result="blurInnerShadow1"
						stdDeviation="0.25"
					/>
					<feComposite
						in="blurInnerShadow1"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow1Shape"
					/>
					<feColorMatrix
						in="innerShadow1Shape"
						result="innerShadow1Color"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow1Color"
						in2="shape"
						result="effect3_innerShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-2" result="offsetInnerShadow2" />
					<feGaussianBlur
						in="offsetInnerShadow2"
						result="blurInnerShadow2"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow2"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow2Shape"
					/>
					<feColorMatrix
						in="innerShadow2Shape"
						result="innerShadow2Color"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadow2Color"
						in2="effect3_innerShadow"
						result="effect4_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter5`}
					width="6.141"
					height="14.956"
					x="34.666"
					y="35.756"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1.5" result="offsetDropShadow" />
					<feGaussianBlur
						in="offsetDropShadow"
						result="blurDropShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurDropShadow"
						in2="hardAlpha"
						operator="out"
						result="dropShadowShape"
					/>
					<feColorMatrix
						in="dropShadowShape"
						result="dropShadowColor"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						result="effect1_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="2" dy="2.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter6`}
					width="6.141"
					height="14.956"
					x="65.494"
					y="35.756"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1.5" result="offsetDropShadow" />
					<feGaussianBlur
						in="offsetDropShadow"
						result="blurDropShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurDropShadow"
						in2="hardAlpha"
						operator="out"
						result="dropShadowShape"
					/>
					<feColorMatrix
						in="dropShadowShape"
						result="dropShadowColor"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						result="effect1_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="2" dy="2.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter7`}
					width="29.918"
					height="8.018"
					x="37.691"
					y="62.079"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1" result="offsetDropShadow" />
					<feGaussianBlur
						in="offsetDropShadow"
						result="blurDropShadow"
						stdDeviation="1"
					/>
					<feComposite
						in="blurDropShadow"
						in2="hardAlpha"
						operator="out"
						result="dropShadowShape"
					/>
					<feColorMatrix
						in="dropShadowShape"
						result="dropShadowColor"
						values="0 0 0 0 0.384615 0 0 0 0 0.384615 0 0 0 0 0.384615 0 0 0 0.25 0"
					/>
					<feBlend
						in="dropShadowColor"
						in2="BackgroundImageFix"
						result="effect1_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter8`}
					width="3"
					height="4"
					x="93.5"
					y="53"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect1_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter9`}
					width="5"
					height="4"
					x="6.5"
					y="53"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1.5" result="offsetInnerShadow" />
					<feGaussianBlur
						in="offsetInnerShadow"
						result="blurInnerShadow"
						stdDeviation="0.5"
					/>
					<feComposite
						in="blurInnerShadow"
						in2="hardAlpha"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadowShape"
					/>
					<feColorMatrix
						in="innerShadowShape"
						result="innerShadowColor"
						values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
					/>
					<feBlend
						in="innerShadowColor"
						in2="shape"
						result="effect1_innerShadow"
					/>
				</filter>
			</defs>
		</svg>
	);
}

import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 235;
const VIEWBOX_HEIGHT = 238;

const RING_PATH =
	"M231 116c0 62.684-50.816 113.5-113.5 113.5S4 178.684 4 116 54.816 2.5 117.5 2.5 231 53.316 231 116m-208.528 0c0 52.482 42.546 95.028 95.028 95.028s95.028-42.546 95.028-95.028-42.546-95.028-95.028-95.028S22.472 63.518 22.472 116";

const RING_STROKE_PATH =
	"M231 116c0 62.684-50.816 113.5-113.5 113.5S4 178.684 4 116 54.816 2.5 117.5 2.5 231 53.316 231 116Zm-208.528 0c0 52.482 42.546 95.028 95.028 95.028s95.028-42.546 95.028-95.028-42.546-95.028-95.028-95.028S22.472 63.518 22.472 116Z";

const EXCLAMATION_PATH =
	"M108.957 72.675a9.153 9.153 0 1 1 18.306 0v57.36a9.153 9.153 0 0 1-18.306 0z";

export function EmptyIssuesIllustrationLight({
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
	/** Render at 2× then display smaller — keeps neumorphic filters crisp. */
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
			viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
			width={renderWidth}
			xmlns="http://www.w3.org/2000/svg"
			{...rest}
		>
			<g filter={`url(#${uid}-filter0)`}>
				<mask id={`${uid}-mask0`} fill="#fff">
					<path d={RING_PATH} />
				</mask>
				<path d={RING_PATH} fill={`url(#${uid}-paint0)`} />
				<path
					d={RING_STROKE_PATH}
					mask={`url(#${uid}-mask0)`}
					stroke="#DBDADA"
					strokeWidth="2"
				/>
			</g>
			<g filter={`url(#${uid}-filter1)`}>
				<circle cx="117.5" cy="116" r="95.194" fill={`url(#${uid}-paint1)`} />
			</g>
			<circle cx="117.5" cy="116" r="94.694" stroke="#DBDADA" />
			<g filter={`url(#${uid}-filter2)`}>
				<mask id={`${uid}-mask1`} fill="#fff">
					<path d={RING_PATH} />
				</mask>
				<path d={RING_PATH} fill={`url(#${uid}-paint2)`} />
				<path
					d={RING_STROKE_PATH}
					mask={`url(#${uid}-mask1)`}
					stroke="#DBDADA"
					strokeWidth="2"
				/>
			</g>
			<g filter={`url(#${uid}-filter3)`} shapeRendering="crispEdges">
				<path d={EXCLAMATION_PATH} fill={`url(#${uid}-paint3)`} />
				<path d={EXCLAMATION_PATH} stroke={`url(#${uid}-paint4)`} />
			</g>
			<g filter={`url(#${uid}-filter4)`} shapeRendering="crispEdges">
				<circle
					cx="117.5"
					cy="159.935"
					r="9.763"
					fill={`url(#${uid}-paint5)`}
				/>
				<circle
					cx="117.5"
					cy="159.935"
					r="9.763"
					stroke={`url(#${uid}-paint6)`}
				/>
			</g>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="117.5"
					x2="117.5"
					y1="2.5"
					y2="229.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#2D3131" />
					<stop offset="1" stopColor="#161718" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="117.5"
					x2="117.5"
					y1="20.806"
					y2="211.193"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F4F6F8" />
					<stop offset="1" stopColor="#E8EBF1" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="117.5"
					x2="117.5"
					y1="2.5"
					y2="229.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F9FAFC" />
					<stop offset="1" stopColor="#EBEEF3" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="118.11"
					x2="118.11"
					y1="63.522"
					y2="139.188"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#FAFCFE" />
					<stop offset="1" stopColor="#F4F6F8" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint4`}
					x1="118.11"
					x2="118.11"
					y1="63.522"
					y2="139.188"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6DADC" stopOpacity="0.56" />
					<stop offset="1" stopColor="#D4D7E0" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint5`}
					x1="117.5"
					x2="117.5"
					y1="150.172"
					y2="169.699"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F2F4F8" />
					<stop offset="1" stopColor="#F1F3F6" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint6`}
					x1="117.5"
					x2="117.5"
					y1="150.172"
					y2="169.699"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6DADC" stopOpacity="0.56" />
					<stop offset="1" stopColor="#D4D7E0" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="229"
					height="229.5"
					x="3"
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
					<feOffset dy="-1.5" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix values="0 0 0 0 0.831806 0 0 0 0 0.831806 0 0 0 0 0.831806 0 0 0 0.85 0" />
					<feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
				</filter>
				<filter
					id={`${uid}-filter1`}
					width="190.387"
					height="192.387"
					x="22.307"
					y="18.806"
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
					<feOffset dy="-2" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix values="0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0.08 0" />
					<feBlend in2="shape" result="effect1_innerShadow" />
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="235"
					height="235"
					x="0"
					y="2.5"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix values="0 0 0 0 0.807843 0 0 0 0 0.827451 0 0 0 0 0.858824 0 0 0 1 0" />
					<feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="1" />
					<feGaussianBlur stdDeviation="1.25" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
					<feBlend in2="shape" result="effect2_innerShadow" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
					<feBlend in2="effect2_innerShadow" result="effect3_innerShadow" />
				</filter>
				<filter
					id={`${uid}-filter3`}
					width="27.307"
					height="84.666"
					x="104.457"
					y="61.522"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2.5" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
					<feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
					<feBlend in2="shape" result="effect2_innerShadow" />
				</filter>
				<filter
					id={`${uid}-filter4`}
					width="28.527"
					height="28.527"
					x="103.236"
					y="148.172"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="2.5" />
					<feGaussianBlur stdDeviation="2" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
					<feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
					<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="3" />
					<feGaussianBlur stdDeviation="0.5" />
					<feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
					<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
					<feBlend in2="shape" result="effect2_innerShadow" />
				</filter>
			</defs>
		</svg>
	);
}

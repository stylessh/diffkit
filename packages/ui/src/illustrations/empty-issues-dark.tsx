import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 235;
const VIEWBOX_HEIGHT = 238;

const RING_PATH =
	"M231 113.5c0 62.684-50.816 113.5-113.5 113.5S4 176.184 4 113.5 54.816 0 117.5 0 231 50.816 231 113.5m-208.528 0c0 52.482 42.546 95.028 95.028 95.028s95.028-42.546 95.028-95.028-42.546-95.028-95.028-95.028S22.472 61.018 22.472 113.5";

const RING_STROKE_PATH =
	"M231 113.5c0 62.684-50.816 113.5-113.5 113.5S4 176.184 4 113.5 54.816 0 117.5 0 231 50.816 231 113.5Zm-208.528 0c0 52.482 42.546 95.028 95.028 95.028s95.028-42.546 95.028-95.028-42.546-95.028-95.028-95.028S22.472 61.018 22.472 113.5Z";

const RING_OVERLAY_PATH =
	"M231 116c0 62.684-50.816 113.5-113.5 113.5S4 178.684 4 116 54.816 2.5 117.5 2.5 231 53.316 231 116m-208.528 0c0 52.482 42.546 95.028 95.028 95.028s95.028-42.546 95.028-95.028-42.546-95.028-95.028-95.028S22.472 63.518 22.472 116";

const EXCLAMATION_PATH =
	"M108.957 72.675a9.153 9.153 0 1 1 18.306 0v57.36a9.153 9.153 0 0 1-18.306 0z";

export function EmptyIssuesIllustrationDark({
	size = VIEWBOX_WIDTH,
	width,
	height,
	className,
	...rest
}: IllustrationProps) {
	const uid = useId().replace(/:/g, "");
	const ringMaskId = `${uid}-ring-mask`;
	const resolvedWidth = width ?? size;
	const resolvedHeight =
		height ??
		(typeof resolvedWidth === "number"
			? (resolvedWidth * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH
			: VIEWBOX_HEIGHT);
	/** Render at 3× then display smaller — keeps neumorphic filters crisp at ~96px. */
	const supersample =
		typeof resolvedWidth === "number" && resolvedWidth <= 120 ? 3 : 2;
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
			<mask id={ringMaskId} fill="white">
				<path d={RING_PATH} />
			</mask>
			<path
				d={RING_STROKE_PATH}
				fill={`url(#${uid}-paint0)`}
				mask={`url(#${ringMaskId})`}
				stroke="#BEBEBE"
				strokeWidth="4"
			/>
			<g filter={`url(#${uid}-filter0)`}>
				<circle cx="117.5" cy="116" fill={`url(#${uid}-paint1)`} r="95.194" />
			</g>
			<circle
				cx="117.5"
				cy="116"
				fill="none"
				r="94.444"
				stroke={`url(#${uid}-paint2)`}
				strokeWidth="1.5"
			/>
			<g filter={`url(#${uid}-filter1)`}>
				<path d={RING_OVERLAY_PATH} fill={`url(#${uid}-paint3)`} />
			</g>
			<path
				d={EXCLAMATION_PATH}
				fill={`url(#${uid}-paint4)`}
				stroke={`url(#${uid}-paint5)`}
			/>
			<g filter={`url(#${uid}-filter2)`}>
				<circle
					cx="117.5"
					cy="159.936"
					fill={`url(#${uid}-paint6)`}
					r="9.763"
				/>
				<circle
					cx="117.5"
					cy="159.936"
					r="9.263"
					stroke={`url(#${uid}-paint7)`}
				/>
			</g>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="117.5"
					x2="117.5"
					y1="0"
					y2="227"
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
					<stop stopColor="#202224" />
					<stop offset="1" stopColor="#111214" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="115.5"
					x2="117.5"
					y1="123.5"
					y2="211.193"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#161718" />
					<stop offset="1" stopColor="#B6B6B6" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
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
					id={`${uid}-paint4`}
					x1="118.11"
					x2="118.11"
					y1="63.522"
					y2="139.188"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#424546" />
					<stop offset="1" stopColor="#313334" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint5`}
					x1="118.11"
					x2="118.11"
					y1="63.522"
					y2="139.188"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6DADC" stopOpacity="0.56" />
					<stop offset="1" stopColor="#252628" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint6`}
					x1="117.5"
					x2="117.5"
					y1="150.172"
					y2="169.699"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#37383A" />
					<stop offset="1" stopColor="#232526" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint7`}
					x1="117.5"
					x2="117.5"
					y1="150.172"
					y2="169.699"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#A3A3A3" />
					<stop offset="1" stopColor="#1F2122" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="190.387"
					height="194.387"
					x="22.306"
					y="20.806"
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
					<feOffset dy="6" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="2" />
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
						result="innerShadow1Color"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0"
					/>
					<feBlend
						in="innerShadow1Color"
						in2="shape"
						mode="normal"
						result="effect1_innerShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha2"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="38" result="offset2" />
					<feGaussianBlur in="offset2" result="blur2" stdDeviation="2" />
					<feComposite
						in="blur2"
						in2="hardAlpha2"
						k2="-1"
						k3="1"
						operator="arithmetic"
						result="innerShadow2"
					/>
					<feColorMatrix
						in="innerShadow2"
						result="innerShadow2Color"
						type="matrix"
						values="0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0.08 0"
					/>
					<feBlend
						in="innerShadow2Color"
						in2="effect1_innerShadow"
						mode="normal"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter1`}
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
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="2" />
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
						result="effect2_dropShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="22.527"
					height="23.527"
					x="106.237"
					y="150.172"
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
					<feOffset dy="2.5" result="offset1" />
					<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.75" />
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
						result="effect2_dropShadow"
					/>
				</filter>
			</defs>
		</svg>
	);
}

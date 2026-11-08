import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 201;
const VIEWBOX_HEIGHT = 194;

const CHECKBOX_PATHS = [
	"M66 48c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.36 0a8.36 8.36 0 1 0 16.72 0 8.36 8.36 0 0 0-16.72 0",
	"M66 95c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.36 0a8.36 8.36 0 1 0 16.72 0 8.36 8.36 0 0 0-16.72 0",
	"M66 142c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.36 0a8.36 8.36 0 1 0 16.72 0 8.36 8.36 0 0 0-16.72 0",
] as const;

const BAR_Y = [45, 92, 139] as const;
const CHECKBOX_GRADIENT_Y = [
	[34, 62],
	[81, 109],
	[128, 156],
] as const;

function BarRecessFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			filterUnits="objectBoundingBox"
			height="2.5"
			width="1.2"
			x="-0.1"
			y="-0.75"
			colorInterpolationFilters="sRGB"
		>
			<feFlood floodOpacity="0" result="BackgroundImageFix" />
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="-1" result="offsetHighlight" />
			<feGaussianBlur
				in="offsetHighlight"
				result="blurHighlight"
				stdDeviation="0.25"
			/>
			<feComposite
				in="blurHighlight"
				in2="hardAlpha"
				operator="out"
				result="highlightShape"
			/>
			<feColorMatrix
				in="highlightShape"
				result="highlightColor"
				values="0 0 0 0 0.822116 0 0 0 0 0.822116 0 0 0 0 0.822116 0 0 0 0.5 0"
			/>
			<feBlend
				in="highlightColor"
				in2="BackgroundImageFix"
				result="effect1_dropShadow"
			/>
			<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
		</filter>
	);
}

function CheckboxRecessFilter({ id, dd }: { id: string; dd: boolean }) {
	return (
		<filter
			id={id}
			filterUnits="objectBoundingBox"
			height="2"
			width="1.5"
			x="-0.25"
			y="-0.5"
			colorInterpolationFilters="sRGB"
		>
			<feFlood floodOpacity="0" result="BackgroundImageFix" />
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="-0.5" result="offsetHighlight" />
			<feGaussianBlur
				in="offsetHighlight"
				result="blurHighlight"
				stdDeviation="0.25"
			/>
			<feComposite
				in="blurHighlight"
				in2="hardAlpha"
				operator="out"
				result="highlightShape"
			/>
			<feColorMatrix
				in="highlightShape"
				result="highlightColor"
				values="0 0 0 0 0.822116 0 0 0 0 0.822116 0 0 0 0 0.822116 0 0 0 0.5 0"
			/>
			<feBlend
				in="highlightColor"
				in2="BackgroundImageFix"
				result="effect1_dropShadow"
			/>
			{dd ? (
				<>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="4" result="offsetDropShadow" />
					<feGaussianBlur
						in="offsetDropShadow"
						result="blurDropShadow"
						stdDeviation="2"
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
						in2="effect1_dropShadow"
						result="effect2_dropShadow"
					/>
					<feBlend in="SourceGraphic" in2="effect2_dropShadow" result="shape" />
				</>
			) : (
				<feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
			)}
		</filter>
	);
}

function CardDiFilter({
	id,
	width,
	height,
	x,
	y,
}: {
	id: string;
	width: number;
	height: number;
	x: number;
	y: number;
}) {
	return (
		<filter
			id={id}
			width={width}
			height={height}
			x={x}
			y={y}
			colorInterpolationFilters="sRGB"
			filterUnits="userSpaceOnUse"
		>
			<feFlood floodOpacity="0" result="BackgroundImageFix" />
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="4" result="offsetDropShadow" />
			<feGaussianBlur
				in="offsetDropShadow"
				result="blurDropShadow"
				stdDeviation="1.5"
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
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dx="5" dy="6" result="offsetInnerShadow" />
			<feGaussianBlur
				in="offsetInnerShadow"
				result="blurInnerShadow"
				stdDeviation="15"
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
				values="0 0 0 0 0.131339 0 0 0 0 0.135236 0 0 0 0 0.143029 0 0 0 1 0"
			/>
			<feBlend in="innerShadowColor" in2="shape" result="effect2_innerShadow" />
		</filter>
	);
}

export function EmptyReviewsIllustrationDark({
	size = VIEWBOX_WIDTH,
	width,
	height,
	className,
	...rest
}: IllustrationProps) {
	const uid = useId().replace(/:/g, "");
	const barRecessFilterId = `${uid}-barRecess`;
	const checkboxRecessFilterId = `${uid}-checkboxRecess`;
	const checkboxRecessDdFilterId = `${uid}-checkboxRecessDd`;
	const resolvedWidth = width ?? size;
	const resolvedHeight =
		height ??
		(typeof resolvedWidth === "number"
			? (resolvedWidth * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH
			: VIEWBOX_HEIGHT);
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
			<g filter={`url(#${uid}-filter0)`}>
				<rect
					width="194"
					height="185"
					x="3.5"
					y="0.5"
					fill={`url(#${uid}-paint0)`}
					rx="25"
				/>
			</g>
			<rect width="194" height="185" x="3.5" y="0.5" rx="25" stroke="#8D8D8D" />
			<g filter={`url(#${uid}-filter1)`}>
				<rect
					width="194"
					height="185"
					x="4"
					y="2"
					fill={`url(#${uid}-paint1)`}
					rx="25"
				/>
			</g>
			{BAR_Y.map((y, index) => (
				<g key={y}>
					<g filter={`url(#${barRecessFilterId})`}>
						<rect width="84" height="6" x="81" y={y} fill="#3A3D3F" rx="3" />
					</g>
					<g
						filter={`url(#${index === 0 ? checkboxRecessDdFilterId : checkboxRecessFilterId})`}
					>
						<path
							d={CHECKBOX_PATHS[index]}
							fill={`url(#${uid}-paint${index + 2})`}
							fillRule="evenodd"
						/>
					</g>
				</g>
			))}
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="100.5"
					x2="100.5"
					y1="0.5"
					y2="185.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1E20" />
					<stop offset="1" stopColor="#131516" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="101"
					x2="101"
					y1="2"
					y2="187"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1E20" />
					<stop offset="1" stopColor="#131516" />
				</linearGradient>
				{CHECKBOX_GRADIENT_Y.map(([y1, y2], index) => (
					<linearGradient
						key={y1}
						id={`${uid}-paint${index + 2}`}
						x1="52"
						x2="52"
						y1={y1}
						y2={y2}
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#4D4E50" />
						<stop offset="1" stopColor="#2C2E30" />
					</linearGradient>
				))}
				<CardDiFilter
					id={`${uid}-filter0`}
					height={193}
					width={203}
					x={0}
					y={0}
				/>
				<CardDiFilter
					id={`${uid}-filter1`}
					height={192}
					width={202}
					x={1}
					y={2}
				/>
				<BarRecessFilter id={barRecessFilterId} />
				<CheckboxRecessFilter id={checkboxRecessFilterId} dd={false} />
				<CheckboxRecessFilter id={checkboxRecessDdFilterId} dd={true} />
			</defs>
		</svg>
	);
}

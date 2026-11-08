import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 210;
const VIEWBOX_HEIGHT = 214;

const SHIELD_OUTER_FILL =
	"M46.199 29.395c16.812-2.995 29.614-8.55 44.99-19.426 7.798-5.516 18.262-5.412 26.035.137 14.391 10.276 27.158 15.746 44.888 19.023 9.679 1.79 17.09 9.65 18.52 19.387 2.48 16.88 7.626 29.156 17.701 43.147 5.367 7.453 5.778 17.447.811 25.172-10.227 15.905-15.371 28.707-17.925 45.245-1.426 9.237-8.244 16.82-17.373 18.828-18.861 4.15-32.138 9.857-47.37 20.191-7.398 5.019-17.112 5.132-24.564.192-15.422-10.224-28.706-16.134-48.058-20.512-8.5-1.924-15.08-8.69-16.74-17.245-3.608-18.595-8.712-31.616-17.962-46.263-5.034-7.972-4.496-18.228 1.042-25.86C19.828 78.138 24.71 65.75 27.51 48.23c1.536-9.612 9.107-17.128 18.69-18.834";

const SHIELD_OUTER_STROKE =
	"M46.199 29.395c16.812-2.995 29.614-8.55 44.99-19.426 7.798-5.516 18.262-5.412 26.035.137 14.391 10.276 27.158 15.746 44.888 19.023 9.679 1.79 17.09 9.65 18.52 19.387 2.48 16.88 7.626 29.156 17.701 43.147 5.367 7.453 5.778 17.447.811 25.172-10.227 15.905-15.371 28.707-17.925 45.245-1.426 9.237-8.244 16.82-17.373 18.828-18.861 4.15-32.138 9.857-47.37 20.191-7.398 5.019-17.112 5.132-24.564.192-15.422-10.224-28.706-16.134-48.058-20.512-8.5-1.924-15.08-8.69-16.74-17.245-3.608-18.595-8.712-31.616-17.962-46.263-5.034-7.972-4.496-18.228 1.042-25.86C19.828 78.138 24.71 65.75 27.51 48.23c1.536-9.612 9.107-17.128 18.69-18.834Z";

const SHIELD_INNER_FILL =
	"M47.34 30.549c16.956-3.01 29.849-8.602 45.353-19.579 7.795-5.518 18.26-5.415 26.03.139 14.508 10.369 27.365 15.878 45.249 19.174 9.679 1.784 17.092 9.644 18.517 19.383 2.49 17.025 7.673 29.389 17.841 43.493 5.371 7.45 5.782 17.447.811 25.17-10.318 16.033-15.496 28.923-18.062 45.599-1.421 9.238-8.241 16.821-17.37 18.825-19.017 4.176-32.383 9.922-47.734 20.345-7.395 5.022-17.11 5.134-24.56.192-15.54-10.31-28.91-16.259-48.418-20.666-8.501-1.92-15.082-8.687-16.74-17.243-3.631-18.747-8.77-31.855-18.102-46.617-5.038-7.97-4.5-18.227 1.043-25.854 9.725-13.382 14.64-25.857 17.456-43.53 1.531-9.612 9.103-17.13 18.687-18.831";

const RING_OUTER_PATH =
	"M186.5 107.5c0 44.183-35.817 80-80 80s-80-35.817-80-80 35.817-80 80-80 80 35.817 80 80m-152.574 0c0 40.081 32.493 72.574 72.574 72.574s72.574-32.493 72.574-72.574-32.493-72.574-72.574-72.574S33.926 67.42 33.926 107.5";

const RING_OUTER_STROKE_PATH =
	"M186.5 107.5c0 44.183-35.817 80-80 80s-80-35.817-80-80 35.817-80 80-80 80 35.817 80 80Z";

const RING_INNER_STROKE_PATH =
	"M33.926 107.5c0 40.081 32.493 72.574 72.574 72.574s72.574-32.493 72.574-72.574-32.493-72.574-72.574-72.574S33.926 67.42 33.926 107.5Z";

const RING_INNER_PATH =
	"M186 107c0 44.183-35.817 80-80 80s-80-35.817-80-80 35.817-80 80-80 80 35.817 80 80m-152.574 0c0 40.081 32.493 72.574 72.574 72.574s72.574-32.493 72.574-72.574S146.081 34.426 106 34.426 33.426 66.92 33.426 107";

const CHECK_FILL =
	"m91.415 132.594-22.581-21.452a5 5 0 0 1 .017-7.266l1.285-1.21a5 5 0 0 1 6.786-.062l14.53 13.178a5 5 0 0 0 6.915-.189l35.812-36.232a5 5 0 0 1 6.864-.235l1.024.903a5 5 0 0 1 .278 7.234l-43.9 45.19a5 5 0 0 1-7.03.141";

const CHECK_STROKE =
	"M134.534 79.712a4.5 4.5 0 0 1 6.178-.211l1.024.903a4.5 4.5 0 0 1 .25 6.51l-43.9 45.19a4.5 4.5 0 0 1-6.326.127l-22.582-21.452a4.5 4.5 0 0 1 .015-6.539l1.285-1.21a4.5 4.5 0 0 1 6.108-.056l14.53 13.178a5.5 5.5 0 0 0 7.607-.208z";

const CHECK_OVERLAY_FILL =
	"m91.415 133.594-22.581-21.452a5 5 0 0 1 .017-7.266l1.285-1.21a5 5 0 0 1 6.786-.062l14.53 13.178a5 5 0 0 0 6.915-.189l35.812-36.232a5 5 0 0 1 6.864-.235l1.024.903a5 5 0 0 1 .278 7.234l-43.9 45.19a5 5 0 0 1-7.03.141";

const CHECK_OVERLAY_STROKE =
	"M134.534 80.712a4.5 4.5 0 0 1 6.178-.211l1.024.903a4.5 4.5 0 0 1 .25 6.51l-43.9 45.19a4.5 4.5 0 0 1-6.326.127l-22.582-21.452a4.5 4.5 0 0 1 .015-6.539l1.285-1.21a4.5 4.5 0 0 1 6.108-.056l14.53 13.178a5.5 5.5 0 0 0 7.607-.208z";

function ShieldDiFilter({ id, x, y }: { id: string; x: number; y: number }) {
	return (
		<filter
			id={id}
			width="205.941"
			height="215.043"
			x={x}
			y={y}
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
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="1.5" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
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
			<feOffset dx="5" dy="15" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="21.75" />
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
				result="innerShadowColor"
				type="matrix"
				values="0 0 0 0 0.137255 0 0 0 0 0.145098 0 0 0 0 0.152941 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadowColor"
				in2="shape"
				mode="normal"
				result="effect2_innerShadow"
			/>
		</filter>
	);
}

function RingIiFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="160.5"
			height="164.5"
			x="26"
			y="27"
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
				result="innerShadow1Color"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadow1Color"
				in2="shape"
				mode="normal"
				result="effect1_innerShadow"
			/>
		</filter>
	);
}

function RingIFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="160"
			height="164"
			x="26"
			y="27"
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
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadowColor"
				in2="shape"
				mode="normal"
				result="effect1_innerShadow"
			/>
		</filter>
	);
}

function CheckDropFilter({ id, y }: { id: string; y: number }) {
	return (
		<filter
			id={id}
			width="79.481"
			height="61.594"
			x="65.777"
			y={y}
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
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.75" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
			<feColorMatrix
				in="shadow1"
				result="dropShadowColor"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.31 0"
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
	);
}

export function EmptyGpgKeysIllustrationDark({
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
				<path d={SHIELD_OUTER_FILL} fill={`url(#${uid}-paint0)`} />
			</g>
			<path
				d={SHIELD_OUTER_STROKE}
				stroke={`url(#${uid}-shield-stroke)`}
				strokeLinejoin="round"
				strokeWidth="2"
			/>
			<g filter={`url(#${uid}-filter1)`}>
				<path d={SHIELD_INNER_FILL} fill={`url(#${uid}-paint1)`} />
			</g>
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d={RING_OUTER_PATH}
					fill={`url(#${uid}-paint2)`}
					fillRule="evenodd"
				/>
			</g>
			<path
				d={RING_OUTER_STROKE_PATH}
				stroke={`url(#${uid}-ring-stroke)`}
				strokeWidth="2"
			/>
			<g filter={`url(#${uid}-filter3)`}>
				<path
					d={RING_INNER_PATH}
					fill={`url(#${uid}-paint3)`}
					fillRule="evenodd"
				/>
			</g>
			<path
				d={RING_INNER_STROKE_PATH}
				stroke={`url(#${uid}-ring-inner-stroke)`}
				strokeWidth="2"
			/>
			<g filter={`url(#${uid}-filter4)`}>
				<path d={CHECK_FILL} fill={`url(#${uid}-paint4)`} />
			</g>
			<path
				d={CHECK_STROKE}
				stroke={`url(#${uid}-check-stroke)`}
				strokeWidth="1.5"
			/>
			<g filter={`url(#${uid}-filter5)`}>
				<path d={CHECK_OVERLAY_FILL} fill={`url(#${uid}-paint6)`} />
			</g>
			<path
				d={CHECK_OVERLAY_STROKE}
				stroke={`url(#${uid}-check-overlay-stroke)`}
				strokeWidth="1.5"
			/>
			<defs>
				<linearGradient
					id={`${uid}-shield-stroke`}
					x1="104"
					x2="104"
					y1="0"
					y2="210"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#B8B8B8" stopOpacity="0.55" />
					<stop offset="0.45" stopColor="#6E7376" stopOpacity="0.35" />
					<stop offset="1" stopColor="#3A3D3F" stopOpacity="0.2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-ring-stroke`}
					x1="106.5"
					x2="106.5"
					y1="27.5"
					y2="187.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#828282" stopOpacity="0.55" />
					<stop offset="0.45" stopColor="#6E7376" stopOpacity="0.35" />
					<stop offset="1" stopColor="#3A3D3F" stopOpacity="0.2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-ring-inner-stroke`}
					x1="33.926"
					x2="179.074"
					y1="34.926"
					y2="180.074"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#6E7376" stopOpacity="0.20" />
					<stop offset="0.35" stopColor="#828282" stopOpacity="0.20" />
					<stop offset="1" stopColor="#B6B6B6" stopOpacity="0.30" />
				</linearGradient>
				<linearGradient
					id={`${uid}-check-stroke`}
					x1="105.5"
					x2="105.5"
					y1="76"
					y2="136"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#C4C4C4" stopOpacity="0.45" />
					<stop offset="1" stopColor="#5A5D5F" stopOpacity="0.25" />
				</linearGradient>
				<linearGradient
					id={`${uid}-check-overlay-stroke`}
					x1="105.5"
					x2="105.5"
					y1="77"
					y2="137"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#C4C4C4" stopOpacity="0.2" />
					<stop offset="1" stopColor="#5A5D5F" stopOpacity="0.12" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="104"
					x2="104"
					y1="0"
					y2="210"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1E20" />
					<stop offset="1" stopColor="#131516" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="105.5"
					x2="105.5"
					y1="1"
					y2="212"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#1D1E20" />
					<stop offset="1" stopColor="#131516" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="106.5"
					x2="106.5"
					y1="27.5"
					y2="187.5"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#2D3131" />
					<stop offset="1" stopColor="#161718" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="106"
					x2="106"
					y1="27"
					y2="187"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#2D3131" />
					<stop offset="1" stopColor="#161718" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint4`}
					x1="105.5"
					x2="105.5"
					y1="76"
					y2="136"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#323333" />
					<stop offset="1" stopColor="#161819" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint6`}
					x1="105.5"
					x2="105.5"
					y1="77"
					y2="137"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#323333" />
					<stop offset="1" stopColor="#161819" />
				</linearGradient>
				<ShieldDiFilter id={`${uid}-filter0`} x={2.186} y={5.388} />
				<ShieldDiFilter id={`${uid}-filter1`} x={3.686} y={6.887} />
				<RingIiFilter id={`${uid}-filter2`} />
				<RingIFilter id={`${uid}-filter3`} />
				<CheckDropFilter id={`${uid}-filter4`} y={77.875} />
				<CheckDropFilter id={`${uid}-filter5`} y={78.875} />
			</defs>
		</svg>
	);
}

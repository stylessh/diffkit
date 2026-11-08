import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 210;
const VIEWBOX_HEIGHT = 213;

const SHIELD_OUTER_FILL =
	"M46.481 29.843c17.086-3.036 30.061-8.686 45.675-19.796 7.81-5.556 18.321-5.453 26.105.14 14.611 10.495 27.552 16.062 45.576 19.39 9.677 1.786 17.091 9.645 18.496 19.385 2.502 17.335 7.739 29.878 18.063 44.227 5.344 7.428 5.753 17.384.81 25.085-10.471 16.313-15.702 29.387-18.28 46.355-1.403 9.238-8.22 16.819-17.344 18.828-19.162 4.22-32.613 10.025-48.069 20.571-7.411 5.058-17.169 5.171-24.635.193-15.642-10.428-29.094-16.44-48.742-20.892-8.5-1.925-15.078-8.697-16.722-17.255-3.665-19.07-8.856-32.358-18.324-47.366-5.012-7.946-4.48-18.163 1.04-25.766 9.877-13.608 14.845-26.264 17.68-44.26 1.516-9.614 9.088-17.136 18.671-18.839";

const SHIELD_OUTER_STROKE =
	"M92.446 10.455c7.633-5.43 17.91-5.332 25.524.138 14.67 10.538 27.679 16.134 45.776 19.474 9.462 1.747 16.717 9.434 18.093 18.966 2.514 17.419 7.783 30.037 18.151 44.448 5.229 7.266 5.624 17 .795 24.523-10.503 16.363-15.763 29.503-18.353 46.551-1.374 9.041-8.044 16.451-16.957 18.414-19.223 4.232-32.734 10.063-48.244 20.646-7.245 4.944-16.781 5.053-24.075.191-15.692-10.462-29.2-16.498-48.91-20.964-8.306-1.882-14.735-8.501-16.342-16.863-3.675-19.126-8.887-32.474-18.39-47.538-4.9-7.765-4.384-17.76 1.02-25.205 9.93-13.68 14.924-26.412 17.77-44.475 1.482-9.398 8.885-16.758 18.264-18.425 17.167-3.05 30.211-8.734 45.878-19.88Z";

const SHIELD_INNER_FILL =
	"M46.84 30.549c16.957-3.01 29.849-8.602 45.353-19.579 7.794-5.518 18.26-5.415 26.03.139 14.508 10.369 27.365 15.878 45.249 19.174 9.679 1.784 17.092 9.644 18.517 19.383 2.49 17.025 7.673 29.389 17.841 43.493 5.371 7.45 5.782 17.447.811 25.17-10.318 16.033-15.496 28.923-18.062 45.599-1.421 9.238-8.241 16.821-17.37 18.825-19.017 4.176-32.383 9.922-47.734 20.345-7.395 5.022-17.11 5.134-24.56.192-15.54-10.31-28.91-16.259-48.418-20.666-8.501-1.92-15.082-8.687-16.74-17.243-3.631-18.747-8.77-31.855-18.102-46.617-5.038-7.97-4.5-18.227 1.043-25.854 9.725-13.382 14.64-25.857 17.456-43.53 1.531-9.612 9.103-17.13 18.687-18.831";

const SHIELD_INNER_STROKE =
	"M92.481 11.379c7.619-5.393 17.852-5.295 25.452.137 14.567 10.411 27.492 15.949 45.448 19.258 9.464 1.745 16.719 9.432 18.113 18.964 2.503 17.109 7.718 29.547 17.931 43.713 5.255 7.289 5.651 17.063.796 24.608-10.35 16.082-15.558 29.037-18.136 45.793-1.391 9.043-8.066 16.454-16.983 18.413-19.078 4.189-32.503 9.96-47.908 20.42-7.23 4.909-16.725 5.016-24.003.188-15.589-10.342-29.016-16.316-48.584-20.736-8.308-1.877-14.74-8.49-16.359-16.851-3.643-18.804-8.803-31.971-18.17-46.789-4.925-7.789-4.404-17.825 1.024-25.294C20.88 79.751 25.822 67.2 28.649 49.458c1.496-9.396 8.9-16.752 18.28-18.417 17.036-3.024 29.997-8.648 45.553-19.662Z";

const RING_PATH =
	"M185.5 107c0 44.183-35.817 80-80 80s-80-35.817-80-80 35.817-80 80-80 80 35.817 80 80m-152.574 0c0 40.081 32.493 72.574 72.574 72.574s72.574-32.493 72.574-72.574-32.493-72.574-72.574-72.574S32.926 66.92 32.926 107";

const RING_OUTER_STROKE_PATH =
	"M185.5 107c0 44.183-35.817 80-80 80s-80-35.817-80-80 35.817-80 80-80 80 35.817 80 80Z";

const RING_INNER_STROKE_PATH =
	"M32.926 107c0 40.081 32.493 72.574 72.574 72.574s72.574-32.493 72.574-72.574-32.493-72.574-72.574-72.574S32.926 66.92 32.926 107Z";

const CHECK_FILL =
	"m90.915 133.594-22.581-21.452a5 5 0 0 1 .017-7.266l1.285-1.21a5 5 0 0 1 6.786-.062l14.53 13.178a5 5 0 0 0 6.915-.189l35.812-36.232a5 5 0 0 1 6.864-.235l1.024.903a5 5 0 0 1 .278 7.234l-43.9 45.19a5 5 0 0 1-7.03.141";

const CHECK_STROKE =
	"m90.915 133.594-22.581-21.452a5 5 0 0 1 .017-7.266l1.285-1.21a5 5 0 0 1 6.786-.062l14.53 13.178a5 5 0 0 0 6.915-.189l35.812-36.232a5 5 0 0 1 6.864-.235l1.024.903a5 5 0 0 1 .278 7.234l-43.9 45.19a5 5 0 0 1-7.03.141Z";

function ShieldOuterIFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="199.034"
			height="203.953"
			x="5.639"
			y="3.936"
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
			<feOffset dy="-2" result="offset1" />
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
				result="innerShadowColor"
				type="matrix"
				values="0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0 0.138221 0 0 0 0.08 0"
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

function ShieldInnerIiFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="197.941"
			height="202.544"
			x="6.186"
			y="5.387"
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
			<feOffset dy="-3" result="offset1" />
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.75" />
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
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
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
			<feOffset dy="3.5" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
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
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadow2Color"
				in2="effect1_innerShadow"
				mode="normal"
				result="effect2_innerShadow"
			/>
		</filter>
	);
}

function RingDiFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="162"
			height="162.5"
			x="23.5"
			y="24.5"
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
			<feOffset dx="-1" dy="-1.5" result="offset1" />
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.5" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
			<feColorMatrix
				in="shadow1"
				result="dropShadowColor"
				type="matrix"
				values="0 0 0 0 0.61899 0 0 0 0 0.61899 0 0 0 0 0.61899 0 0 0 0.5 0"
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
			<feOffset dx="-1" dy="-1.5" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.25" />
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
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
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

function CheckDiFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width="85.481"
			height="65.094"
			x="62.277"
			y="76.875"
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
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="2" />
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
			<feOffset dy="3.5" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.25" />
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
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
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

export function EmptyGpgKeysIllustrationLight({
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
			<g filter={`url(#${uid}-filter1)`}>
				<path d={SHIELD_INNER_FILL} fill={`url(#${uid}-paint1)`} />
			</g>
			<path
				d={SHIELD_INNER_STROKE}
				stroke={`url(#${uid}-shield-inner-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
			<path
				d={SHIELD_OUTER_STROKE}
				stroke={`url(#${uid}-shield-outer-stroke)`}
				strokeLinejoin="round"
				strokeWidth="1"
			/>
			<g filter={`url(#${uid}-filter2)`}>
				<path d={RING_PATH} fill={`url(#${uid}-paint2)`} fillRule="evenodd" />
			</g>
			<path
				d={RING_OUTER_STROKE_PATH}
				stroke={`url(#${uid}-ring-stroke)`}
				strokeWidth="1"
			/>
			<path
				d={RING_INNER_STROKE_PATH}
				stroke={`url(#${uid}-ring-inner-stroke)`}
				strokeWidth="1.5"
			/>
			<g filter={`url(#${uid}-filter3)`}>
				<path d={CHECK_FILL} fill={`url(#${uid}-paint3)`} />
			</g>
			<path
				d={CHECK_STROKE}
				stroke={`url(#${uid}-check-stroke)`}
				strokeWidth="1.5"
			/>
			<defs>
				<linearGradient
					id={`${uid}-shield-outer-stroke`}
					x1="46"
					x2="164"
					y1="10"
					y2="203"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#DADADA" stopOpacity="0.72" />
					<stop offset="0.5" stopColor="#E0E0E0" stopOpacity="0.78" />
					<stop offset="1" stopColor="#D6D6D6" stopOpacity="0.7" />
				</linearGradient>
				<linearGradient
					id={`${uid}-shield-inner-stroke`}
					x1="46"
					x2="164"
					y1="11"
					y2="204"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E8E8E8" />
					<stop offset="0.5" stopColor="#F0F0F0" />
					<stop offset="1" stopColor="#EAEAEA" />
				</linearGradient>
				<linearGradient
					id={`${uid}-ring-stroke`}
					x1="32.926"
					x2="178.074"
					y1="34.426"
					y2="179.574"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D4D7DC" stopOpacity="0.48" />
					<stop offset="0.5" stopColor="#DCDEE3" stopOpacity="0.52" />
					<stop offset="1" stopColor="#D0D3D8" stopOpacity="0.46" />
				</linearGradient>
				<linearGradient
					id={`${uid}-ring-inner-stroke`}
					x1="32.926"
					x2="178.074"
					y1="34.426"
					y2="179.574"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E0E2E6" stopOpacity="0.38" />
					<stop offset="0.5" stopColor="#E8EBF0" stopOpacity="0.48" />
					<stop offset="1" stopColor="#D6DADC" stopOpacity="0.45" />
				</linearGradient>
				<linearGradient
					id={`${uid}-check-stroke`}
					x1="105"
					x2="105"
					y1="77"
					y2="137"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6DADC" stopOpacity="0.56" />
					<stop offset="1" stopColor="#D4D7E0" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="105"
					x2="105"
					y1="0"
					y2="213"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F4F6F8" />
					<stop offset="1" stopColor="#E8EBF1" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="105"
					x2="105"
					y1="1"
					y2="212"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F4F6F8" />
					<stop offset="1" stopColor="#E8EBF1" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="105.5"
					x2="105.5"
					y1="27"
					y2="187"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#DEDFE3" />
					<stop offset="1" stopColor="#E4E4E6" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="105"
					x2="105"
					y1="77"
					y2="137"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#FAFCFE" />
					<stop offset="1" stopColor="#F4F6F8" />
				</linearGradient>
				<ShieldOuterIFilter id={`${uid}-filter0`} />
				<ShieldInnerIiFilter id={`${uid}-filter1`} />
				<RingDiFilter id={`${uid}-filter2`} />
				<CheckDiFilter id={`${uid}-filter3`} />
			</defs>
		</svg>
	);
}

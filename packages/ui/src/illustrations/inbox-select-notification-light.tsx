import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 267;
const VIEWBOX_HEIGHT = 249;

const ENVELOPE_PATH =
	"M204.641 18.042H63.427a10 10 0 0 0-9.42 6.646L18.034 125.71v83.197h232V125.71L214.061 24.688a10 10 0 0 0-9.42-6.646";

const ENVELOPE_STROKE_PATH = `${ENVELOPE_PATH}Z`;

const TRAY_PATH =
	"M18.034 229.144V126.688H85.78a5 5 0 0 1 5 5v13.917a8 8 0 0 0 8 8h68.542a8 8 0 0 0 8-8v-13.917a5 5 0 0 1 5-5h69.712v102.456c0 8.284-6.716 15-15 15h-202c-8.284 0-15-6.716-15-15";

const TRAY_STROKE_PATH = `${TRAY_PATH}Z`;

const CARD_STROKE = "#EAEEF3";

export function InboxSelectNotificationIllustrationLight({
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
					d="M20 164.861h228.068v65.261c0 8.285-6.716 15-15 15H35c-8.284 0-15-6.715-15-15z"
					fill="#D9D9D9"
				/>
			</g>
			<g filter={`url(#${uid}-filter1)`}>
				<path d={ENVELOPE_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path d={ENVELOPE_STROKE_PATH} stroke="#E5E5E5" />
			<g filter={`url(#${uid}-filter2)`}>
				<path
					d="M63.254 135.498V20h-3.798a4 4 0 0 0-3.814 2.794L20 135.498z"
					fill="#E4E7ED"
				/>
			</g>
			<g filter={`url(#${uid}-filter3)`}>
				<path
					d="M203.034 127.042v-105a9.39 9.39 0 0 1 8.875 6.322l34.125 98.678z"
					fill="#E4E7ED"
				/>
			</g>
			<g filter={`url(#${uid}-filter4)`}>
				<path d="M203.534 22.042v104" stroke={`url(#${uid}-paint1)`} />
			</g>
			<g filter={`url(#${uid}-filter5)`}>
				<path d="M63.534 22.042v104" stroke={`url(#${uid}-paint2)`} />
			</g>
			<g filter={`url(#${uid}-filter6)`}>
				<path
					d="M189.085 35.913a5 5 0 0 0-5-5H83.983a5 5 0 0 0-5 5v56.535a5 5 0 0 0 5 5h100.102a5 5 0 0 0 5-5z"
					fill="#E8EBF2"
				/>
			</g>
			<path
				d="M184.085 31.163H83.983a4.75 4.75 0 0 0-4.75 4.75v56.534a4.75 4.75 0 0 0 4.75 4.75h100.102a4.75 4.75 0 0 0 4.75-4.75V35.913l-.006-.244a4.75 4.75 0 0 0-4.744-4.506Z"
				stroke={CARD_STROKE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter7)`}>
				<path
					d="M198.915 55.482a5 5 0 0 0-5-5H74.153a5 5 0 0 0-5 5v56.535a5 5 0 0 0 5 5h119.762a5 5 0 0 0 5-5z"
					fill="#E8EBF2"
				/>
			</g>
			<path
				d="M193.915 50.732H74.153a4.75 4.75 0 0 0-4.75 4.75v56.534a4.75 4.75 0 0 0 4.75 4.75h119.762a4.75 4.75 0 0 0 4.75-4.75V55.482l-.006-.244a4.75 4.75 0 0 0-4.744-4.506Z"
				stroke={CARD_STROKE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter8)`}>
				<path
					d="M208.746 75.05a5 5 0 0 0-5-5H64.322a5 5 0 0 0-5 5v72.191a5 5 0 0 0 5 5h139.424a5 5 0 0 0 5-5z"
					fill="#E8EBF2"
				/>
			</g>
			<path
				d="M203.746 70.3H64.322a4.75 4.75 0 0 0-4.75 4.75v72.19a4.75 4.75 0 0 0 4.75 4.75h139.424a4.75 4.75 0 0 0 4.75-4.75V75.05a4.75 4.75 0 0 0-4.75-4.75Z"
				stroke={CARD_STROKE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter9)`}>
				<path
					d="M218.576 94.62a5 5 0 0 0-5-5H54.492a5 5 0 0 0-5 5v95.672a5 5 0 0 0 5 5h159.084a5 5 0 0 0 5-5z"
					fill="#E8EBF2"
				/>
			</g>
			<path
				d="M213.576 89.87H54.491a4.75 4.75 0 0 0-4.75 4.75v95.673a4.75 4.75 0 0 0 4.75 4.75h159.085a4.75 4.75 0 0 0 4.75-4.75V94.62a4.75 4.75 0 0 0-4.75-4.75Z"
				stroke={CARD_STROKE}
				strokeWidth="0.5"
			/>
			<g filter={`url(#${uid}-filter10)`}>
				<rect
					width="188.746"
					height="123.284"
					fill="#E8EBF2"
					rx="5"
					transform="matrix(-1 0 0 1 228.407 109.189)"
				/>
			</g>
			<rect
				width="188.246"
				height="122.784"
				x="-0.25"
				y="0.25"
				rx="4.75"
				stroke={CARD_STROKE}
				strokeWidth="0.5"
				transform="matrix(-1 0 0 1 227.907 109.189)"
			/>
			<g filter={`url(#${uid}-filter11)`}>
				<path d={TRAY_PATH} fill={`url(#${uid}-paint3)`} />
			</g>
			<path d={TRAY_STROKE_PATH} stroke="#E8E8E8" strokeWidth="1.5" />
			<path
				d="M21.534 191.042h225l2.103 37.153c.487 8.603-6.359 15.847-14.976 15.847H34.758c-8.562 0-15.387-7.154-14.983-15.706z"
				fill={`url(#${uid}-paint4)`}
			/>
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="134.034"
					x2="134.034"
					y1="18.042"
					y2="241.207"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.115" stopColor="#EDEFF6" />
					<stop offset="1" stopColor="#D3D9E1" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="203.034"
					x2="203.034"
					y1="22.042"
					y2="126.042"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D7DAE2" />
					<stop offset="1" stopColor="#C5CCD5" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="63.034"
					x2="63.034"
					y1="22.042"
					y2="126.042"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D7DAE2" />
					<stop offset="1" stopColor="#C5CCD5" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="135.017"
					x2="134.34"
					y1="158.499"
					y2="244.146"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F4F6FA" />
					<stop offset="1" stopColor="#E5E9EE" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint4`}
					x1="129.534"
					x2="130.034"
					y1="191.042"
					y2="241.542"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F1F3F8" />
					<stop offset="1" stopColor="#E5E9EE" />
				</linearGradient>
				<filter
					id={`${uid}-filter0`}
					width="232.068"
					height="84.261"
					x="18"
					y="163.861"
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
					width="235"
					height="192.865"
					x="16.534"
					y="17.542"
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
					<feOffset dx="3" dy="4" result="offsetInnerShadow1" />
					<feGaussianBlur
						in="offsetInnerShadow1"
						result="blurInnerShadow1"
						stdDeviation="0.5"
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
						result="effect1_innerShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="-3" dy="4" result="offsetInnerShadow2" />
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
						in2="effect1_innerShadow"
						result="effect2_innerShadow"
					/>
				</filter>
				<filter
					id={`${uid}-filter2`}
					width="83.254"
					height="155.498"
					x="0"
					y="0"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feGaussianBlur
						in="shape"
						result="effect1_foregroundBlur"
						stdDeviation="10"
					/>
				</filter>
				<filter
					id={`${uid}-filter3`}
					width="83"
					height="145"
					x="183.034"
					y="2.042"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feGaussianBlur
						in="shape"
						result="effect1_foregroundBlur"
						stdDeviation="10"
					/>
				</filter>
				<filter
					id={`${uid}-filter4`}
					width="13"
					height="116"
					x="197.034"
					y="16.042"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feGaussianBlur
						in="shape"
						result="effect1_foregroundBlur"
						stdDeviation="3"
					/>
				</filter>
				<filter
					id={`${uid}-filter5`}
					width="13"
					height="116"
					x="57.034"
					y="16.042"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
					<feGaussianBlur
						in="shape"
						result="effect1_foregroundBlur"
						stdDeviation="3"
					/>
				</filter>
				<CardDiFilter
					uid={uid}
					index={6}
					x={76.483}
					y={28.413}
					w={115.102}
					h={71.534}
				/>
				<CardDiFilter
					uid={uid}
					index={7}
					x={66.653}
					y={47.982}
					w={134.763}
					h={71.534}
				/>
				<CardDiFilter
					uid={uid}
					index={8}
					x={56.822}
					y={67.551}
					w={154.424}
					h={87.19}
				/>
				<CardDiFilter
					uid={uid}
					index={9}
					x={46.992}
					y={87.12}
					w={174.085}
					h={110.672}
				/>
				<CardDiFilter
					uid={uid}
					index={10}
					x={37.161}
					y={106.689}
					w={193.746}
					h={128.284}
				/>
				<filter
					id={`${uid}-filter11`}
					width="241.5"
					height="126.955"
					x="13.284"
					y="119.938"
					colorInterpolationFilters="sRGB"
					filterUnits="userSpaceOnUse"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dy="-2" result="offsetDropShadow" />
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
						values="0 0 0 0 0.0661055 0 0 0 0 0.0661055 0 0 0 0 0.0661055 0 0 0 0.04 0"
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
					<feOffset dx="2.5" dy="2.5" result="offsetInnerShadow1" />
					<feGaussianBlur
						in="offsetInnerShadow1"
						result="blurInnerShadow1"
						stdDeviation="0.5"
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
						result="effect2_innerShadow"
					/>
					<feColorMatrix
						in="SourceAlpha"
						result="hardAlpha"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					/>
					<feOffset dx="-2.5" dy="2.5" result="offsetInnerShadow2" />
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
						in2="effect2_innerShadow"
						result="effect3_innerShadow"
					/>
				</filter>
			</defs>
		</svg>
	);
}

function CardDiFilter({
	uid,
	index,
	x,
	y,
	w,
	h,
}: {
	uid: string;
	index: number;
	x: number;
	y: number;
	w: number;
	h: number;
}) {
	return (
		<filter
			id={`${uid}-filter${index}`}
			width={w}
			height={h}
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
			<feOffset result="offsetDropShadow" />
			<feGaussianBlur
				in="offsetDropShadow"
				result="blurDropShadow"
				stdDeviation="1.25"
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
			<feBlend in="innerShadowColor" in2="shape" result="effect2_innerShadow" />
		</filter>
	);
}

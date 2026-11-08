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

/** Inner front lip — same path as inbox-select-notification-light. */
const FRONT_POCKET_PATH =
	"M21.534 191.042h225l2.103 37.153c.487 8.603-6.359 15.847-14.976 15.847H34.758c-8.562 0-15.387-7.154-14.983-15.706z";

export function EmptyInboxIllustrationLight({
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
				<path d={TRAY_PATH} fill={`url(#${uid}-paint3)`} />
			</g>
			<path d={TRAY_STROKE_PATH} stroke="#E8E8E8" strokeWidth="1.5" />
			<path d={FRONT_POCKET_PATH} fill={`url(#${uid}-paint4)`} />
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
				<filter
					id={`${uid}-filter6`}
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

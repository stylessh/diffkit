import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 233;
const VIEWBOX_HEIGHT = 221;

const RIGHT_BLOB_FILL =
	"M116.176 35.68c11.996 0 21.741 9.717 21.741 21.727 0 4.44-1.334 8.566-3.619 12.004l22.084 39.704a57 57 0 0 1 18.5-3.073c31.448 0 56.963 25.468 56.963 56.907 0 31.44-25.515 56.907-56.963 56.907a56.8 56.8 0 0 1-35.601-12.481c-4.311-3.452-5.008-9.744-1.557-14.056s9.745-5.008 14.057-1.556a36.8 36.8 0 0 0 23.101 8.093c20.425 0 36.963-16.535 36.963-36.907s-16.538-36.907-36.963-36.907c-6.534 0-12.646 1.685-17.951 4.635-4.826 2.683-10.914.947-13.598-3.879l-26.518-47.674a22 22 0 0 1-.639.01c-11.996 0-21.74-9.717-21.74-21.727s9.744-21.726 21.74-21.726";

const RIGHT_BLOB_STROKE =
	"M116.176 35.68v-.5zm21.741 21.727h.5zm-3.619 12.004-.416-.277-.169.254.148.266zm22.084 39.704-.437.243.204.366.396-.136zm18.5-3.073v-.5zm56.963 56.907h.5zm-56.963 56.907v.5zm-35.601-12.481-.313.39zm-1.557-14.056-.39-.312zm14.057-1.556-.313.39zm23.101 8.093v.5zm36.963-36.907h.5zm-36.963-36.907v-.5zm-17.951 4.635-.243-.437zm-13.598-3.879-.437.243zm-26.518-47.674.437-.243-.148-.266-.303.01zm-.639.01v.5zm-21.74-21.727h-.5zm21.74-21.726v.5c11.721 0 21.241 9.493 21.241 21.226h1c0-12.287-9.969-22.226-22.241-22.226zm21.741 21.726h-.5c0 4.339-1.303 8.368-3.535 11.727l.416.277.417.277a22.1 22.1 0 0 0 3.702-12.28zm-3.619 12.004-.437.243 22.084 39.704.437-.243.437-.243-22.084-39.704zm22.084 39.704.163.473a56.4 56.4 0 0 1 18.337-3.046v-1a57.5 57.5 0 0 0-18.662 3.1zm18.5-3.073v.5c31.173 0 56.463 25.244 56.463 56.407h1c0-31.716-25.739-57.407-57.463-57.407zm56.963 56.907h-.5c0 31.163-25.29 56.407-56.463 56.407v1c31.724 0 57.463-25.69 57.463-57.407zm-56.963 56.907v-.5a56.3 56.3 0 0 1-35.289-12.371l-.312.39-.313.39a57.3 57.3 0 0 0 35.914 12.591zm-35.601-12.481.312-.39c-4.095-3.279-4.757-9.258-1.479-13.353l-.39-.313-.39-.312c-3.624 4.527-2.892 11.134 1.634 14.758zm-1.557-14.056.39.313a9.5 9.5 0 0 1 13.354-1.479l.313-.39.312-.391c-4.527-3.624-11.135-2.892-14.759 1.635zm14.057-1.556-.313.39a37.3 37.3 0 0 0 23.414 8.203v-1a36.3 36.3 0 0 1-22.789-7.984zm23.101 8.093v.5c20.701 0 37.463-16.759 37.463-37.407h-1c0 20.095-16.314 36.407-36.463 36.407zm36.963-36.907h.5c0-20.648-16.762-37.407-37.463-37.407v1c20.149 0 36.463 16.312 36.463 36.407zm-36.963-36.907v-.5a37.3 37.3 0 0 0-18.194 4.698l.243.437.243.437c5.233-2.91 11.261-4.572 17.708-4.572zm-17.951 4.635-.243-.437c-4.585 2.549-10.368.899-12.919-3.685l-.436.243-.437.243c2.818 5.067 9.211 6.89 14.278 4.073zm-13.598-3.879.436-.243-26.517-47.674-.437.243-.437.243 26.518 47.674zm-26.518-47.674-.014-.5q-.316.01-.625.01v1q.332 0 .653-.01zm-.639.01v-.5c-11.72 0-21.24-9.493-21.24-21.227h-1c0 12.287 9.969 22.228 22.24 22.228zm-21.74-21.727h.5c0-11.733 9.52-21.226 21.24-21.226v-1c-12.271 0-22.24 9.94-22.24 22.226z";

const WAVE_FILL =
	"M29.861 113.156c4.83-2.677 10.918-.932 13.595 3.898s.931 10.917-3.898 13.594C28.167 136.962 20.5 149.07 20.5 162.946c0 20.372 16.538 36.907 36.963 36.907s36.963-16.535 36.963-36.907c0-5.523 4.477-10 10-10h51.136c3.622-6.97 10.912-11.726 19.304-11.727 11.996.001 21.741 9.717 21.741 21.727s-9.745 21.727-21.741 21.727c-8.393 0-15.683-4.756-19.305-11.727h-42.012c-4.732 26.667-28.05 46.907-56.086 46.907C26.014 219.853.5 194.386.5 162.946c0-21.445 11.877-40.099 29.361-49.79";

const WAVE_STROKE =
	"m29.861 113.156-.242-.437zm13.595 3.898.437-.242zm-3.898 13.594.242.437zM20.5 162.946H20zm36.963 36.907v.5zm36.963-36.907h-.5zm61.136-10v.5h.303l.14-.269zm19.304-11.727v-.5zm21.741 21.727h.5zm-21.741 21.727v.5zm-19.305-11.727.443-.231-.14-.269h-.303zm-42.012 0v-.5h-.419l-.073.413zm-56.086 46.907v.5zM.5 162.946H0zm29.361-49.79.243.437c4.589-2.543 10.371-.885 12.915 3.704l.437-.243.437-.242c-2.81-5.072-9.202-6.904-14.274-4.093zm13.595 3.898-.437.243c2.543 4.588.885 10.37-3.704 12.914l.243.437.242.437c5.071-2.811 6.904-9.201 4.093-14.273zm-3.898 13.594-.243-.437C27.772 136.609 20 148.881 20 162.946h1c0-13.687 7.562-25.632 18.8-31.861zM20.5 162.946H20c0 20.648 16.762 37.407 37.463 37.407v-1c-20.15 0-36.463-16.312-36.463-36.407zm36.963 36.907v.5c20.7 0 37.463-16.759 37.463-37.407h-1c0 20.095-16.314 36.407-36.463 36.407zm36.963-36.907h.5a9.5 9.5 0 0 1 9.5-9.5v-1c-5.8 0-10.5 4.701-10.5 10.5zm10-10v.5h51.136v-1h-51.136zm51.136 0 .443.231c3.54-6.811 10.662-11.457 18.861-11.458v-1c-8.586.001-16.043 4.867-19.748 11.996zm19.304-11.727v.5c11.72.001 21.241 9.493 21.241 21.227h1c0-12.287-9.97-22.226-22.241-22.227zm21.741 21.727h-.5c0 11.734-9.52 21.227-21.241 21.227v1c12.272 0 22.241-9.94 22.241-22.227zm-21.741 21.727v-.5c-8.199 0-15.322-4.646-18.862-11.458l-.443.231-.444.23c3.705 7.13 11.163 11.997 19.749 11.997zm-19.305-11.727v-.5h-42.012v1h42.012zm-42.012 0-.492-.087c-4.69 26.432-27.805 46.494-55.594 46.494v1c28.282 0 51.805-20.417 56.578-47.32zm-56.086 46.907v-.5C26.29 219.353 1 194.109 1 162.946H0c0 31.716 25.739 57.407 57.463 57.407zM.5 162.946H1c0-21.255 11.772-39.746 29.104-49.353l-.243-.437-.242-.437C11.983 122.494 0 141.312 0 162.946z";

const LEFT_BLOB_FILL =
	"M116.175.5c31.448 0 56.963 25.467 56.963 56.907 0 5.523-4.477 10-10 10s-10-4.477-10-10c0-20.372-16.538-36.907-36.963-36.907S79.212 37.035 79.212 57.407c0 13.858 7.647 25.952 19.013 32.273a10 10 0 0 1 3.879 13.6l-26.513 47.664a21.6 21.6 0 0 1 3.62 12.005c-.001 12.011-9.747 21.728-21.742 21.728-11.995-.001-21.74-9.717-21.74-21.728 0-12.01 9.745-21.726 21.74-21.726q.32 0 .639.009l22.087-39.709C67.404 91.099 59.212 75.216 59.212 57.407 59.212 25.967 84.727.5 116.175.5";

const LEFT_BLOB_STROKE =
	"M116.175.5V0zm56.963 56.907h.5zm-10 10v.5zm-10-10h.5zM116.175 20.5V20zM79.212 57.407h-.5zM98.225 89.68l.243-.437zm4.756 5.997.481-.137zm-.877 7.603.437.243zm-26.513 47.664-.437-.243-.148.266.169.254zm3.62 12.005h.5zm-21.742 21.728v.5zm-21.74-21.728h-.5zm21.74-21.726v-.5zm.639.009-.015.5.304.009.148-.266zm22.087-39.709.437.243.203-.366-.325-.264zM59.212 57.407h-.5zM116.175.5V1c31.172 0 56.463 25.244 56.463 56.407h1C173.638 25.69 147.898 0 116.175 0zm56.963 56.907h-.5a9.5 9.5 0 0 1-9.5 9.5v1c5.799 0 10.5-4.7 10.5-10.5zm-10 10v-.5a9.5 9.5 0 0 1-9.5-9.5h-1c0 5.8 4.701 10.5 10.5 10.5zm-10-10h.5C153.638 36.76 136.875 20 116.175 20v1c20.149 0 36.463 16.312 36.463 36.407zM116.175 20.5V20c-20.7 0-37.463 16.759-37.463 37.407h1C79.712 37.312 96.026 21 116.175 21zM79.212 57.407h-.5c0 14.047 7.751 26.304 19.27 32.71l.243-.437.243-.437c-11.214-6.237-18.756-18.167-18.756-31.836zM98.225 89.68l-.243.437a9.5 9.5 0 0 1 4.518 5.697l.481-.137.481-.137a10.5 10.5 0 0 0-4.994-6.297zm4.756 5.997-.481.137a9.5 9.5 0 0 1-.833 7.223l.437.243.437.243a10.5 10.5 0 0 0 .921-7.983zm-.877 7.603-.437-.243-26.513 47.664.437.243.437.243 26.513-47.664zm-26.513 47.664-.416.277a21.1 21.1 0 0 1 3.535 11.728h1c0-4.542-1.364-8.764-3.703-12.281zm3.62 12.005h-.5c-.001 11.734-9.522 21.228-21.242 21.228v1c12.27-.001 22.241-9.94 22.241-22.228zm-21.742 21.728v-.5c-11.72-.001-21.24-9.494-21.24-21.228h-1c0 12.288 9.97 22.227 22.24 22.228zm-21.74-21.728h.5c0-11.734 9.52-21.226 21.24-21.226v-1c-12.27 0-22.24 9.939-22.24 22.226zm21.74-21.726v.5q.312 0 .624.009l.015-.5.014-.499q-.324-.01-.653-.01zm.639.009.437.243 22.087-39.709-.437-.243-.437-.243-22.087 39.709zm22.087-39.709.316-.387C67.83 90.802 59.711 75.059 59.711 57.407h-1c0 17.966 8.265 33.989 21.167 44.504zM59.212 57.407h.5C59.712 26.244 85.002 1 116.175 1V0C84.451 0 58.712 25.69 58.712 57.407z";

function InnerShadowIiFilter({
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
			<feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dx="2" dy="3.5" result="offsetInnerShadow1" />
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
				result="innerShadowShape1"
			/>
			<feColorMatrix
				in="innerShadowShape1"
				result="innerShadowColor1"
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadowColor1"
				in2="shape"
				result="effect1_innerShadow"
			/>
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha2"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dx="-2" dy="3" result="offsetInnerShadow2" />
			<feGaussianBlur
				in="offsetInnerShadow2"
				result="blurInnerShadow2"
				stdDeviation="0.5"
			/>
			<feComposite
				in="blurInnerShadow2"
				in2="hardAlpha2"
				k2="-1"
				k3="1"
				operator="arithmetic"
				result="innerShadowShape2"
			/>
			<feColorMatrix
				in="innerShadowShape2"
				result="innerShadowColor2"
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadowColor2"
				in2="effect1_innerShadow"
				result="effect2_innerShadow"
			/>
		</filter>
	);
}

export function EmptyWebhooksIllustrationLight({
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
				<path d={RIGHT_BLOB_FILL} fill={`url(#${uid}-paint0)`} />
			</g>
			<path d={RIGHT_BLOB_STROKE} fill={`url(#${uid}-paint1)`} />
			<g filter={`url(#${uid}-filter1)`}>
				<path d={WAVE_FILL} fill={`url(#${uid}-paint2)`} />
			</g>
			<path d={WAVE_STROKE} fill={`url(#${uid}-paint3)`} />
			<g filter={`url(#${uid}-filter2)`}>
				<path d={LEFT_BLOB_FILL} fill={`url(#${uid}-paint4)`} />
			</g>
			<path d={LEFT_BLOB_STROKE} fill={`url(#${uid}-paint5)`} />
			<defs>
				<linearGradient
					id={`${uid}-paint0`}
					x1="163.723"
					x2="160.914"
					y1="85.562"
					y2="219.81"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#EAEEF2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint1`}
					x1="163.723"
					x2="160.914"
					y1="-71.755"
					y2="219.835"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6D6D6" />
					<stop offset="1" stopColor="#D6D6D6" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint2`}
					x1="99.385"
					x2="98.708"
					y1="141.138"
					y2="219.855"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#EAEEF2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint3`}
					x1="99.385"
					x2="98.708"
					y1="48.929"
					y2="219.854"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6D6D6" />
					<stop offset="1" stopColor="#D6D6D6" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint4`}
					x1="105.016"
					x2="102.207"
					y1="50.381"
					y2="184.63"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#EAEEF2" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint5`}
					x1="105.016"
					x2="102.206"
					y1="-106.936"
					y2="184.655"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D6D6D6" />
					<stop offset="1" stopColor="#D6D6D6" />
				</linearGradient>
				<InnerShadowIiFilter
					id={`${uid}-filter0`}
					width={140.409}
					height={186.176}
					x={92.936}
					y={35.181}
				/>
				<InnerShadowIiFilter
					id={`${uid}-filter1`}
					width={199.107}
					height={109.953}
					x={-1}
					y={111.401}
				/>
				<InnerShadowIiFilter
					id={`${uid}-filter2`}
					width={140.409}
					height={186.177}
					x={34.229}
					y={0}
				/>
			</defs>
		</svg>
	);
}

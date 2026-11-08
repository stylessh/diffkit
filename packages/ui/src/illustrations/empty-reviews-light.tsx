import { useId } from "react";

import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";

const VIEWBOX_WIDTH = 197;
const VIEWBOX_HEIGHT = 190;

const CARD_PATH =
	"M1.5 17.5c0-8.284 6.716-15 15-15h164c8.284 0 15 6.716 15 15v155c0 8.284-6.716 15-15 15h-164c-8.284 0-15-6.716-15-15z";

const ROWS = [
	{
		barFill: "M78.5 48.5a5 5 0 0 1 5-5h74a5 5 0 0 1 0 10h-74a5 5 0 0 1-5-5",
		barStroke: "M83.5 44h74a4.5 4.5 0 0 1 0 9h-74a4.5 4.5 0 1 1 0-9Z",
		checkboxPath:
			"M63.5 48.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.145 0a8.145 8.145 0 1 0 16.29 0 8.145 8.145 0 0 0-16.29 0",
		checkboxStroke:
			"M63.5 48.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14Zm-22.145 0a8.145 8.145 0 1 0 16.29 0 8.145 8.145 0 0 0-16.29 0Z",
		gradientY1: 34.5,
		gradientY2: 62.5,
		barFilterY: 43,
		checkboxFilterY: 34,
	},
	{
		barFill: "M78.5 95.5a5 5 0 0 1 5-5h74a5 5 0 0 1 0 10h-74a5 5 0 0 1-5-5",
		barStroke: "M83.5 91h74a4.5 4.5 0 0 1 0 9h-74a4.5 4.5 0 1 1 0-9Z",
		checkboxPath:
			"M63.5 95.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.163 0a8.163 8.163 0 1 0 16.326 0 8.163 8.163 0 0 0-16.326 0",
		checkboxStroke:
			"M63.5 95.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14Zm-22.163 0a8.163 8.163 0 1 0 16.326 0 8.163 8.163 0 0 0-16.326 0Z",
		gradientY1: 81.5,
		gradientY2: 109.5,
		barFilterY: 90,
		checkboxFilterY: 81,
	},
	{
		barFill: "M78.5 142.5a5 5 0 0 1 5-5h74a5 5 0 0 1 0 10h-74a5 5 0 0 1-5-5",
		barStroke: "M83.5 138h74a4.5 4.5 0 0 1 0 9h-74a4.5 4.5 0 0 1 0-9Z",
		checkboxPath:
			"M63.5 142.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14m-22.161 0a8.161 8.161 0 1 0 16.322 0 8.161 8.161 0 0 0-16.322 0",
		checkboxStroke:
			"M63.5 142.5c0 7.732-6.268 14-14 14s-14-6.268-14-14 6.268-14 14-14 14 6.268 14 14Zm-22.161 0a8.161 8.161 0 1 0 16.322 0 8.161 8.161 0 0 0-16.322 0Z",
		gradientY1: 128.5,
		gradientY2: 156.5,
		barFilterY: 137,
		checkboxFilterY: 128,
	},
] as const;

function CardFilter({ id }: { id: string }) {
	return (
		<filter
			id={id}
			width={VIEWBOX_WIDTH}
			height={VIEWBOX_HEIGHT}
			x="0"
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
			<feOffset dy="1" result="offset1" />
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="0.5" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
			<feColorMatrix
				in="shadow1"
				result="dropShadow1Color"
				type="matrix"
				values="0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0 0.600962 0 0 0 0.45 0"
			/>
			<feBlend
				in="dropShadow1Color"
				in2="BackgroundImageFix"
				mode="normal"
				result="effect1_dropShadow"
			/>
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha2"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="-1" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
			<feComposite
				in="blur2"
				in2="hardAlpha2"
				operator="out"
				result="shadow2"
			/>
			<feColorMatrix
				in="shadow2"
				result="dropShadow2Color"
				type="matrix"
				values="0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 0 0.905882 0 0 0 1 0"
			/>
			<feBlend
				in="dropShadow2Color"
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
				result="hardAlpha3"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="3.5" result="offset3" />
			<feGaussianBlur in="offset3" result="blur3" stdDeviation="0.25" />
			<feComposite
				in="blur3"
				in2="hardAlpha3"
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
				result="effect3_innerShadow"
			/>
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha4"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="-3.5" result="offset4" />
			<feGaussianBlur in="offset4" result="blur4" stdDeviation="0.5" />
			<feComposite
				in="blur4"
				in2="hardAlpha4"
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
				in2="effect3_innerShadow"
				mode="normal"
				result="effect4_innerShadow"
			/>
		</filter>
	);
}

function BarFilter({ id, y }: { id: string; y: number }) {
	return (
		<filter
			id={id}
			width="89"
			height="15"
			x="76"
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
			<feOffset dy="2" result="offset1" />
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="1.25" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
			<feColorMatrix
				in="shadow1"
				result="dropShadowColor"
				type="matrix"
				values="0 0 0 0 0.384615 0 0 0 0 0.384615 0 0 0 0 0.384615 0 0 0 0.25 0"
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
			<feOffset dy="3" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="0.5" />
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
				result="innerShadow1Color"
				type="matrix"
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadow1Color"
				in2="shape"
				mode="normal"
				result="effect2_innerShadow"
			/>
		</filter>
	);
}

function CheckboxFilter({ id, y }: { id: string; y: number }) {
	return (
		<filter
			id={id}
			width="32"
			height="32"
			x="33.5"
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
			<feOffset dy="1.5" result="offset1" />
			<feGaussianBlur in="offset1" result="blur1" stdDeviation="1" />
			<feComposite in="blur1" in2="hardAlpha" operator="out" result="shadow1" />
			<feColorMatrix
				in="shadow1"
				result="dropShadowColor"
				type="matrix"
				values="0 0 0 0 0.807843 0 0 0 0 0.827451 0 0 0 0 0.858824 0 0 0 1 0"
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
			<feOffset dy="1" result="offset2" />
			<feGaussianBlur in="offset2" result="blur2" stdDeviation="1.25" />
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
				result="innerShadow1Color"
				type="matrix"
				values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
			/>
			<feBlend
				in="innerShadow1Color"
				in2="shape"
				mode="normal"
				result="effect2_innerShadow"
			/>
			<feColorMatrix
				in="SourceAlpha"
				result="hardAlpha3"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
			/>
			<feOffset dy="3" result="offset3" />
			<feGaussianBlur in="offset3" result="blur3" stdDeviation="0.5" />
			<feComposite
				in="blur3"
				in2="hardAlpha3"
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
				in2="effect2_innerShadow"
				mode="normal"
				result="effect3_innerShadow"
			/>
		</filter>
	);
}

export function EmptyReviewsIllustrationLight({
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
				<path d={CARD_PATH} fill={`url(#${uid}-paint0)`} />
			</g>
			<path
				d={CARD_PATH}
				stroke={`url(#${uid}-card-stroke)`}
				strokeWidth="1.5"
			/>
			{ROWS.map((row, index) => {
				const barFilter = index * 2 + 1;
				const checkboxFilter = index * 2 + 2;
				const maskId = `${uid}-mask${index}`;
				return (
					<g key={row.gradientY1}>
						<g filter={`url(#${uid}-filter${barFilter})`}>
							<path d={row.barFill} fill="#F5F7FA" />
						</g>
						<path d={row.barStroke} stroke="#DFE4EB" />
						<g filter={`url(#${uid}-filter${checkboxFilter})`}>
							<path
								d={row.checkboxPath}
								fill={`url(#${uid}-paint${index + 1})`}
							/>
						</g>
						<mask id={maskId} fill="#fff">
							<path d={row.checkboxPath} />
						</mask>
						<path
							d={row.checkboxStroke}
							mask={`url(#${maskId})`}
							stroke="#DBDADA"
							strokeWidth="2"
						/>
					</g>
				);
			})}
			<defs>
				<linearGradient
					id={`${uid}-card-stroke`}
					x1="1.5"
					x2="195.5"
					y1="95"
					y2="95"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#E4E4E4" />
					<stop offset="0.12" stopColor="#F0F0F0" />
					<stop offset="0.5" stopColor="#F6F6F6" />
					<stop offset="0.88" stopColor="#F0F0F0" />
					<stop offset="1" stopColor="#E4E4E4" />
				</linearGradient>
				<linearGradient
					id={`${uid}-paint0`}
					x1="99.322"
					x2="97.314"
					y1="52.604"
					y2="187.482"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0.168" stopColor="#F6F7FA" />
					<stop offset="1" stopColor="#E8EDF1" />
				</linearGradient>
				{ROWS.map((row, index) => (
					<linearGradient
						key={row.gradientY1}
						id={`${uid}-paint${index + 1}`}
						x1="49.5"
						x2="49.5"
						y1={row.gradientY1}
						y2={row.gradientY2}
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="#F9FAFC" />
						<stop offset="1" stopColor="#EBEEF3" />
					</linearGradient>
				))}
				<CardFilter id={`${uid}-filter0`} />
				{ROWS.map((row, index) => {
					const barFilter = index * 2 + 1;
					const checkboxFilter = index * 2 + 2;
					return (
						<g key={row.gradientY1}>
							<BarFilter id={`${uid}-filter${barFilter}`} y={row.barFilterY} />
							<CheckboxFilter
								id={`${uid}-filter${checkboxFilter}`}
								y={row.checkboxFilterY}
							/>
						</g>
					);
				})}
			</defs>
		</svg>
	);
}

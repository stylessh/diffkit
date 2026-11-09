export function SplitDiffGlyph({ size = 14 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="1.75"
				y="2.25"
				width="10.5"
				height="9.5"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.25"
			/>
			<path
				d="M7 2.25v9.5M3.75 7h1.5M8.75 7h1.5"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function UnifiedDiffGlyph({ size = 14 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="1.75"
				y="2.25"
				width="10.5"
				height="9.5"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.25"
			/>
			<path
				d="M5.5 5.25h3M7 3.75v3M5.5 9h3"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
			/>
		</svg>
	);
}

import type { SVGProps } from "react";
import { cn } from "../lib/utils";

export function Spinner({
	size = 16,
	className,
	...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
	return (
		<svg
			aria-hidden="true"
			className={cn("animate-spin", className)}
			fill="none"
			height={size}
			viewBox="0 0 16 16"
			width={size}
			{...props}
		>
			<circle
				cx="8"
				cy="8"
				opacity="0.25"
				r="6.5"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path
				d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="2"
			/>
		</svg>
	);
}

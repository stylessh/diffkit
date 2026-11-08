import type { ReactNode } from "react";
import {
	segmentedInsetClassName,
	segmentedTriggerBaseClassName,
	segmentedTriggerSelectedClassName,
} from "../lib/segmented-control-classes";
import { cn } from "../lib/utils";

type SegmentedOption<T extends string> = {
	value: T;
	label: ReactNode;
	"aria-label"?: string;
	title?: string;
};

export function SegmentedToggle<T extends string>({
	value,
	onValueChange,
	first,
	second,
	third,
	options,
	className,
	"aria-label": ariaLabel,
}: {
	value: T;
	onValueChange: (next: T) => void;
	first?: SegmentedOption<T>;
	second?: SegmentedOption<T>;
	third?: SegmentedOption<T>;
	options?: SegmentedOption<T>[];
	className?: string;
	"aria-label"?: string;
}) {
	const resolvedOptions =
		options ??
		(first && second ? (third ? [first, second, third] : [first, second]) : []);

	if (resolvedOptions.length < 2) {
		throw new Error("SegmentedToggle requires at least 2 options");
	}

	return (
		<fieldset
			className={cn(segmentedInsetClassName, className)}
			aria-label={ariaLabel}
		>
			{resolvedOptions.map((option) => (
				<button
					key={option.value}
					type="button"
					className={cn(
						segmentedTriggerBaseClassName,
						value === option.value ? segmentedTriggerSelectedClassName : null,
					)}
					aria-pressed={value === option.value}
					aria-label={option["aria-label"]}
					title={option.title}
					onClick={() => onValueChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}

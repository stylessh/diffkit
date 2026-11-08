import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { cn } from "@diffkit/ui/lib/utils";

export function OptionSelect<T extends string>({
	value,
	options,
	label,
	disabled,
	className,
	onChange,
}: {
	value: T;
	options: readonly { value: T; label: string }[];
	label: string;
	disabled?: boolean;
	className?: string;
	onChange: (value: T) => void;
}) {
	return (
		<Select
			value={value}
			disabled={disabled}
			onValueChange={(next) => onChange(next as T)}
		>
			<SelectTrigger
				size="sm"
				aria-label={label}
				className={cn("w-28", className)}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

import { CloseIcon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import {
	type ActiveFilter,
	type FilterDefinition,
	type FilterOption,
	operatorLabel,
} from "./filter-model";
import { FilterValueOptions } from "./filter-value-options";
import type { ListFilterState } from "./use-list-filters";

const segmentClassName =
	"flex items-center gap-1.5 px-1.5 transition-colors hover:bg-button-hover hover:text-foreground data-[state=open]:bg-button-hover";

function ValueSummary({ selected }: { selected: FilterOption[] }) {
	if (selected.length <= 2) {
		return (
			<span className="flex min-w-0 items-center gap-1.5">
				{selected.map((option) => (
					<span key={option.value} className="flex min-w-0 items-center gap-1">
						{option.icon ? (
							<span className="flex shrink-0 [&_img]:size-3.5">
								{option.icon}
							</span>
						) : null}
						<span className="max-w-40 truncate">{option.label}</span>
					</span>
				))}
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex items-center -space-x-1">
				{selected
					.filter((option) => option.icon)
					.slice(0, 3)
					.map((option) => (
						<span key={option.value} className="flex [&_img]:size-3.5">
							{option.icon}
						</span>
					))}
			</span>
			{selected.length} selected
		</span>
	);
}

export function FilterPill({
	filter,
	definition,
	options,
	state,
}: {
	filter: ActiveFilter;
	definition: FilterDefinition;
	options: FilterOption[];
	state: ListFilterState;
}) {
	const byValue = new Map(options.map((option) => [option.value, option]));
	const selected = [...filter.values].map(
		(value) => byValue.get(value) ?? { value, label: value },
	);
	const operator = operatorLabel(filter);
	const summary = `${definition.label} ${operator} ${selected.map((option) => option.label).join(", ")}`;
	const negatable = definition.negatable !== false;

	return (
		<fieldset
			aria-label={summary}
			className="m-0 flex h-6 min-w-0 max-w-full items-stretch overflow-hidden rounded-md border-0 bg-button p-0 text-xs font-[450] text-muted-foreground shadow-button"
		>
			<span className="flex shrink-0 items-center gap-1.5 pr-1 pl-2">
				<definition.icon size={12} strokeWidth={2} />
				{definition.label}
			</span>
			{negatable ? (
				<button
					type="button"
					onClick={() =>
						state.setOperator(
							filter.fieldId,
							filter.operator === "is" ? "is-not" : "is",
						)
					}
					aria-label={`${definition.label} ${operator}; switch operator`}
					className={segmentClassName}
				>
					{operator}
				</button>
			) : (
				<span className="flex items-center px-1">{operator}</span>
			)}
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`Edit ${definition.label} filter`}
						className={`${segmentClassName} min-w-0 font-medium text-text-strong`}
					>
						<ValueSummary selected={selected} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-60 p-0">
					<FilterValueOptions
						definition={definition}
						options={options}
						selected={filter.values}
						onToggle={(value) => state.toggleValue(filter.fieldId, value)}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
			<button
				type="button"
				onClick={() => state.removeFilter(filter.fieldId)}
				aria-label={`Remove ${definition.label} filter`}
				className="flex shrink-0 items-center border-l-[0.5px] border-header-rule px-1.5 transition-colors hover:bg-button-hover hover:text-foreground"
			>
				<CloseIcon size={12} />
			</button>
		</fieldset>
	);
}

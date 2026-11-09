import {
	CheckIcon,
	ChevronDownIcon,
	GitBranchIcon,
	PlusSignIcon,
	TagIcon,
} from "@diffkit/icons";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { cn } from "@diffkit/ui/lib/utils";
import { useMemo, useState } from "react";
import { validateReleaseTag } from "./release-save-utils";

const triggerClass =
	"flex h-9 w-full items-center justify-between gap-2 rounded-md border-[0.5px] bg-surface-1 px-3 text-left text-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

/**
 * Tag combobox over the first 100 tags. With `allowCreate`, a typed name that
 * isn't in the list can be picked as a new tag (GitHub creates it on publish).
 */
export function ReleaseTagPicker({
	value,
	onChange,
	tags,
	loading,
	allowCreate = true,
	exclude,
	placeholder = "Choose a tag",
	disabled,
	invalid,
	id,
}: {
	value: string;
	onChange: (tag: string) => void;
	tags: readonly string[];
	loading?: boolean;
	allowCreate?: boolean;
	exclude?: string;
	placeholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	id?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const typed = search.trim();
	const options = useMemo(
		() => tags.filter((tag) => tag !== exclude),
		[tags, exclude],
	);
	const canCreate =
		allowCreate &&
		typed.length > 0 &&
		!tags.includes(typed) &&
		validateReleaseTag(typed) == null;

	const pick = (tag: string) => {
		onChange(tag);
		setOpen(false);
		setSearch("");
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSearch("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					disabled={disabled}
					aria-invalid={invalid || undefined}
					className={triggerClass}
				>
					<span className="flex min-w-0 items-center gap-2">
						<TagIcon size={14} className="shrink-0 text-muted-foreground" />
						<span
							className={cn(
								"truncate font-mono text-xs",
								!value && "font-sans text-sm text-muted-foreground",
							)}
						>
							{value || placeholder}
						</span>
					</span>
					<ChevronDownIcon size={14} className="shrink-0 opacity-60" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
				align="start"
			>
				<Command>
					<CommandInput
						placeholder={allowCreate ? "Find or create a tag…" : "Find a tag…"}
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						<CommandEmpty>
							{loading
								? "Loading tags…"
								: allowCreate && typed
									? "Not a valid tag name."
									: "No tags found."}
						</CommandEmpty>
						{canCreate ? (
							<CommandItem
								value={`__create__${typed}`}
								keywords={[typed]}
								onSelect={() => pick(typed)}
							>
								<PlusSignIcon size={14} className="shrink-0" />
								<span className="truncate">
									Create new tag{" "}
									<span className="font-mono text-xs">{typed}</span> on publish
								</span>
							</CommandItem>
						) : null}
						{options.map((tag) => (
							<CommandItem key={tag} value={tag} onSelect={() => pick(tag)}>
								<CheckIcon
									size={14}
									className={cn(
										"shrink-0",
										tag === value ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="truncate font-mono text-xs">{tag}</span>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export function ReleaseBranchPicker({
	value,
	onChange,
	branches,
	defaultBranch,
	loading,
	disabled,
	id,
}: {
	value: string;
	onChange: (branch: string) => void;
	branches: readonly string[];
	defaultBranch: string;
	loading?: boolean;
	disabled?: boolean;
	id?: string;
}) {
	const [open, setOpen] = useState(false);
	const options = useMemo(
		() => [defaultBranch, ...branches.filter((name) => name !== defaultBranch)],
		[branches, defaultBranch],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					disabled={disabled}
					className={triggerClass}
				>
					<span className="flex min-w-0 items-center gap-2">
						<GitBranchIcon
							size={14}
							className="shrink-0 text-muted-foreground"
						/>
						<span className="truncate font-mono text-xs">
							{value || defaultBranch}
						</span>
					</span>
					<ChevronDownIcon size={14} className="shrink-0 opacity-60" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
				align="start"
			>
				<Command>
					<CommandInput placeholder="Find a branch…" />
					<CommandList>
						<CommandEmpty>
							{loading ? "Loading branches…" : "No branches found."}
						</CommandEmpty>
						{options.map((branch) => (
							<CommandItem
								key={branch}
								value={branch}
								onSelect={() => {
									onChange(branch);
									setOpen(false);
								}}
							>
								<CheckIcon
									size={14}
									className={cn(
										"shrink-0",
										branch === value ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="truncate font-mono text-xs">{branch}</span>
								{branch === defaultBranch ? (
									<span className="ml-auto text-[10px] text-muted-foreground">
										default
									</span>
								) : null}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

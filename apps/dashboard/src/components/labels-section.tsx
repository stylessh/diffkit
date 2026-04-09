import { CheckIcon, CloseIcon, PlusSignIcon, SearchIcon } from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { createRepoLabel, setIssueLabels } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubRepoLabelsQueryOptions,
} from "#/lib/github.query";
import type { GitHubLabel } from "#/lib/github.types";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";

function randomLabelColor(): string {
	const colors = [
		"0075ca",
		"e4e669",
		"d73a4a",
		"a2eeef",
		"7057ff",
		"008672",
		"e99695",
		"d876e3",
		"f9d0c4",
		"c5def5",
		"bfdadc",
		"c2e0c6",
	];
	return colors[Math.floor(Math.random() * colors.length)];
}

type PageDataWithLabels = {
	detail: { labels: GitHubLabel[] } | null;
};

export function LabelsSection({
	currentLabels,
	owner,
	repo,
	issueNumber,
	scope,
	pageQueryKey,
}: {
	currentLabels: GitHubLabel[];
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	pageQueryKey: readonly unknown[];
}) {
	const { mutate } = useOptimisticMutation();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [pending, setPending] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	const repoLabelsQuery = useQuery({
		...githubRepoLabelsQueryOptions(scope, { owner, repo }),
		enabled: pickerOpen,
	});
	const repoLabels = repoLabelsQuery.data ?? [];

	const activeNames = useMemo(
		() => new Set(currentLabels.map((l) => l.name)),
		[currentLabels],
	);

	const filtered = useMemo(() => {
		if (!search) return repoLabels;
		const q = search.toLowerCase();
		return repoLabels.filter((l) => l.name.toLowerCase().includes(q));
	}, [repoLabels, search]);

	const hasExactMatch = useMemo(() => {
		if (!search) return true;
		const q = search.toLowerCase();
		return repoLabels.some((l) => l.name.toLowerCase() === q);
	}, [repoLabels, search]);

	const showCreate = search.trim() !== "" && !hasExactMatch;
	const totalItems = filtered.length + (showCreate ? 1 : 0);

	const scrollToFocused = useCallback((index: number) => {
		const el = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (el) {
			el.scrollIntoView({ block: "nearest" });
		}
	}, []);

	const labelsUpdater = (nextLabels: GitHubLabel[]) => ({
		queryKey: pageQueryKey,
		updater: (prev: PageDataWithLabels) => ({
			...prev,
			detail: prev.detail
				? { ...prev.detail, labels: nextLabels }
				: prev.detail,
		}),
	});

	const toggleLabel = (labelName: string) => {
		const isActive = activeNames.has(labelName);
		const nextLabels = isActive
			? currentLabels.filter((l) => l.name !== labelName)
			: [
					...currentLabels,
					repoLabels.find((l) => l.name === labelName) ?? {
						name: labelName,
						color: "000000",
						description: null,
					},
				];

		mutate({
			mutationFn: () =>
				setIssueLabels({
					data: {
						owner,
						repo,
						issueNumber,
						labels: nextLabels.map((l) => l.name),
					},
				}),
			updates: [labelsUpdater(nextLabels)],
		});
	};

	const createAndAssign = async () => {
		const name = search.trim();
		if (!name) return;

		setPending(true);
		try {
			const label = await createRepoLabel({
				data: { owner, repo, name, color: randomLabelColor() },
			});
			if (label) {
				const nextLabels = [...currentLabels, label];
				setSearch("");
				await mutate({
					mutationFn: () =>
						setIssueLabels({
							data: {
								owner,
								repo,
								issueNumber,
								labels: nextLabels.map((l) => l.name),
							},
						}),
					updates: [labelsUpdater(nextLabels)],
				});
			}
		} finally {
			setPending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (totalItems === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = focusedIndex < totalItems - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : totalItems - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (focusedIndex < 0) return;
			if (focusedIndex < filtered.length) {
				toggleLabel(filtered[focusedIndex].name);
			} else if (showCreate) {
				createAndAssign();
			}
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Labels
				</h3>
				<Popover
					open={pickerOpen}
					onOpenChange={(open) => {
						setPickerOpen(open);
						if (!open) {
							setSearch("");
							setFocusedIndex(-1);
						}
					}}
				>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
						>
							<PlusSignIcon size={14} strokeWidth={2} />
						</button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-64 p-0">
						<div className="flex items-center gap-2 border-b px-3 py-2">
							<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
							<input
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setFocusedIndex(-1);
								}}
								onKeyDown={handleKeyDown}
								placeholder="Search labels..."
								className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{repoLabelsQuery.isLoading ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									Loading…
								</p>
							) : (
								<>
									{filtered.map((label, i) => {
										const isSelected = activeNames.has(label.name);
										return (
											<button
												key={label.name}
												type="button"
												data-index={i}
												disabled={pending}
												onClick={() => toggleLabel(label.name)}
												onMouseEnter={() => setFocusedIndex(i)}
												className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === i ? "bg-surface-1" : ""}`}
											>
												<span
													className="size-3 shrink-0 rounded-full"
													style={{
														backgroundColor: `#${label.color}`,
													}}
												/>
												<span className="min-w-0 flex-1 truncate">
													{label.name}
												</span>
												{isSelected && (
													<CheckIcon
														size={14}
														strokeWidth={2}
														className="shrink-0 text-green-500"
													/>
												)}
											</button>
										);
									})}
									{showCreate && (
										<button
											type="button"
											data-index={filtered.length}
											disabled={pending}
											onClick={createAndAssign}
											onMouseEnter={() => setFocusedIndex(filtered.length)}
											className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === filtered.length ? "bg-surface-1" : ""}`}
										>
											<PlusSignIcon
												size={13}
												strokeWidth={2}
												className="shrink-0 text-muted-foreground"
											/>
											<span className="min-w-0 flex-1 truncate">
												Create{" "}
												<span className="font-medium">"{search.trim()}"</span>
											</span>
										</button>
									)}
									{filtered.length === 0 && !search.trim() && (
										<p className="px-3 py-4 text-center text-xs text-muted-foreground">
											No labels found
										</p>
									)}
								</>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{currentLabels.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{currentLabels.map((label) => (
						<span
							key={label.name}
							className="group/label label-pill relative rounded-full px-2.5 py-0.5 text-xs font-medium"
							style={
								{
									"--label-color": `#${label.color}`,
								} as React.CSSProperties
							}
						>
							{label.name}
							<button
								type="button"
								disabled={pending}
								onClick={() => toggleLabel(label.name)}
								className="label-pill-close-gradient absolute inset-y-0 right-0 flex items-center overflow-hidden rounded-r-full pl-5 pr-1.5 opacity-0 transition-opacity group-hover/label:opacity-100 disabled:opacity-50"
							>
								<span className="relative flex size-4 items-center justify-center rounded-full hover:bg-black/15">
									<CloseIcon size={10} strokeWidth={2.5} />
								</span>
							</button>
						</span>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No labels</p>
			)}
		</div>
	);
}

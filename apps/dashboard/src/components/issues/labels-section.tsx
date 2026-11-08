import { PlusSignIcon } from "@diffkit/icons";
import {
	PanelAddButton,
	PanelPill,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import { MenuRowEnd, menuRowClassName } from "@diffkit/ui/components/menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	PanelPicker,
	PanelPickerEmpty,
} from "#/components/details/panel-picker";
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
	const queryClient = useQueryClient();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [pending, setPending] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	const labelsOptions = githubRepoLabelsQueryOptions(scope, { owner, repo });

	const repoLabelsQuery = useQuery({
		...labelsOptions,
		enabled: pickerOpen,
	});

	const prefetchLabels = useCallback(() => {
		void queryClient.prefetchQuery(labelsOptions);
	}, [queryClient, labelsOptions]);
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

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
		} else if (!search && /^[1-9]$/.test(e.key)) {
			const label = filtered[Number(e.key) - 1];
			if (!label) return;
			e.preventDefault();
			toggleLabel(label.name);
		}
	};

	const openPicker = () => {
		prefetchLabels();
		setPickerOpen(true);
	};

	return (
		<PanelSection label="Labels">
			<PanelPicker
				open={pickerOpen}
				onOpenChange={(open) => {
					setPickerOpen(open);
					if (!open) {
						setSearch("");
						setFocusedIndex(-1);
					}
				}}
				search={search}
				onSearchChange={(value) => {
					setSearch(value);
					setFocusedIndex(-1);
				}}
				onKeyDown={handleKeyDown}
				placeholder="Change labels…"
				listRef={listRef}
				anchor={
					currentLabels.length > 0 ? (
						<div className="flex flex-wrap items-center gap-1.5">
							{currentLabels.map((label) => (
								<button
									key={label.name}
									type="button"
									aria-haspopup="listbox"
									aria-expanded={pickerOpen}
									onMouseEnter={prefetchLabels}
									onClick={openPicker}
									className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-chip px-2 text-xs font-[450] text-text-header shadow-chip transition-colors hover:bg-row-hover"
								>
									<span
										aria-hidden
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: `#${label.color}` }}
									/>
									<span className="truncate">{label.name}</span>
								</button>
							))}
							<PanelAddButton
								aria-label="Add label"
								aria-haspopup="listbox"
								aria-expanded={pickerOpen}
								onMouseEnter={prefetchLabels}
								onClick={openPicker}
								className="ml-0"
							/>
						</div>
					) : (
						<PanelPill asChild muted>
							<button
								type="button"
								aria-haspopup="listbox"
								aria-expanded={pickerOpen}
								onMouseEnter={prefetchLabels}
								onClick={openPicker}
							>
								Add labels
							</button>
						</PanelPill>
					)
				}
			>
				{repoLabelsQuery.isLoading ? (
					<PanelPickerEmpty>Loading…</PanelPickerEmpty>
				) : (
					<>
						{filtered.map((label, i) => {
							const isSelected = activeNames.has(label.name);
							return (
								<button
									key={label.name}
									type="button"
									role="option"
									aria-selected={isSelected}
									data-index={i}
									data-active={focusedIndex === i}
									disabled={pending}
									onClick={() => toggleLabel(label.name)}
									onMouseEnter={() => setFocusedIndex(i)}
									className={menuRowClassName}
								>
									<span className="flex size-4 shrink-0 items-center justify-center">
										<span
											aria-hidden
											className="size-2.5 rounded-full"
											style={{ backgroundColor: `#${label.color}` }}
										/>
									</span>
									<span className="truncate">{label.name}</span>
									<MenuRowEnd
										checked={isSelected}
										shortcut={!search && i < 9 ? i + 1 : undefined}
									/>
								</button>
							);
						})}
						{showCreate && (
							<button
								type="button"
								data-index={filtered.length}
								data-active={focusedIndex === filtered.length}
								disabled={pending}
								onClick={createAndAssign}
								onMouseEnter={() => setFocusedIndex(filtered.length)}
								className={menuRowClassName}
							>
								<span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
									<PlusSignIcon size={14} strokeWidth={2} />
								</span>
								<span className="truncate">
									Create label{" "}
									<span className="text-foreground">“{search.trim()}”</span>
								</span>
							</button>
						)}
						{filtered.length === 0 && !search.trim() && (
							<PanelPickerEmpty>No labels in this repository</PanelPickerEmpty>
						)}
					</>
				)}
			</PanelPicker>
		</PanelSection>
	);
}

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useReducer,
	useState,
	useSyncExternalStore,
} from "react";
import {
	type BulkRun,
	type BulkRunEvent,
	bulkRunReducer,
	type CountNoun,
	IDLE_BULK_RUN,
	planBulkAction,
	runBulkAction,
} from "#/lib/bulk-actions";
import {
	createListSelectionStore,
	type ListSelectionStore,
} from "#/lib/list-selection";
import { useMediaQuery } from "#/lib/use-media-query";
import { type BulkAction, type BulkItemSummary, barMode } from "./bulk-action";
import { BulkBar } from "./bulk-bar";
import { ListSelectionScope } from "./list-selection";

export type { BulkAction, BulkItemSummary };

/** Matches the `md:` breakpoint the row checkboxes and the bar appear at. */
const CHECKBOXES_VISIBLE = "(min-width: 768px)";

/** How long a finished run stays announced in the bar. */
const FEEDBACK_MS = 2500;

function useSelectedItems<T>(
	store: ListSelectionStore,
	items: readonly T[],
	getKey: (item: T) => string,
) {
	const keys = useSyncExternalStore(store.subscribe, store.get);

	useEffect(() => {
		store.retain(new Set(items.map(getKey)));
	}, [store, items, getKey]);

	return useMemo(() => {
		const seen = new Set<string>();
		return items.filter((item) => {
			const key = getKey(item);
			if (!keys.has(key) || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [items, keys, getKey]);
}

/**
 * Checkboxes on the rows inside it and a floating bar with the actions that
 * apply to the selection. Picking an action grows the bar into a review of the
 * rows it will run on, which then reports the run; a clean run is announced in
 * the bar itself.
 */
export function BulkSelection<T>({
	items,
	getKey,
	noun,
	actions,
	describe,
	children,
}: {
	/** Every row currently listed; a selected row that leaves the list is deselected. */
	items: readonly T[];
	getKey: (item: T) => string;
	noun: CountNoun;
	actions: BulkAction<T>[];
	describe: (item: T) => BulkItemSummary;
	children: ReactNode;
}) {
	const [store] = useState(createListSelectionStore);
	const hasCheckboxes = useMediaQuery(CHECKBOXES_VISIBLE);
	const selected = useSelectedItems(store, items, getKey);
	const [run, dispatch] = useReducer<BulkRun<T>, [BulkRunEvent<T>]>(
		bulkRunReducer,
		IDLE_BULK_RUN,
	);

	const action =
		run.status === "idle"
			? undefined
			: actions.find((candidate) => candidate.id === run.actionId);
	const mode = barMode(run, action, noun);

	const nothingLeftToConfirm =
		mode.kind === "review" &&
		mode.review.run.status === "confirming" &&
		planBulkAction(selected, mode.review.action.skipReason).targets.length ===
			0;
	useEffect(() => {
		if (nothingLeftToConfirm) dispatch({ type: "dismissed" });
	}, [nothingLeftToConfirm]);

	const isAnnouncing = run.status === "succeeded";
	useEffect(() => {
		if (!isAnnouncing) return;
		const dismiss = () => dispatch({ type: "dismissed" });
		const timer = setTimeout(dismiss, FEEDBACK_MS);
		const stopListening = store.subscribe(dismiss);
		return () => {
			clearTimeout(timer);
			stopListening();
		};
	}, [isAnnouncing, store]);

	const start = async (targets: readonly T[]) => {
		if (!action) return;
		dispatch({ type: "started", targets });
		const { succeeded } = await runBulkAction({
			targets,
			run: action.run,
			onOutcome: (item, outcome) =>
				dispatch({ type: "outcome", item, outcome }),
		});
		store.remove(succeeded.map(getKey));
		action.onSettled?.(succeeded);
		dispatch({ type: "finished" });
	};

	const isReporting = run.status === "running" || run.status === "settled";

	return (
		<>
			<ListSelectionScope
				store={store}
				shortcutsEnabled={hasCheckboxes && !isReporting}
				onEscape={() => {
					if (run.status === "idle") store.clear();
					else dispatch({ type: "dismissed" });
				}}
			>
				{children}
			</ListSelectionScope>
			<MotionConfig reducedMotion="user">
				<AnimatePresence>
					{selected.length > 0 || mode.kind !== "actions" ? (
						<BulkBar
							key="bar"
							mode={mode}
							selected={selected}
							noun={noun}
							actions={actions}
							describe={describe}
							getKey={getKey}
							onAction={(actionId) => dispatch({ type: "opened", actionId })}
							onStart={(targets) => void start(targets)}
							onDismiss={() => dispatch({ type: "dismissed" })}
							onClear={store.clear}
						/>
					) : null}
				</AnimatePresence>
			</MotionConfig>
		</>
	);
}

/** A labelled choice for an action's `settings`, e.g. the merge method. */
export function BulkChoiceSetting<V extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly { value: V; label: string }[];
	value: V;
	onChange: (value: V) => void;
}) {
	const labelId = useId();
	return (
		<div className="flex items-center gap-3">
			<span
				id={labelId}
				className="flex-1 text-[13px] font-[450] text-muted-foreground"
			>
				{label}
			</span>
			<Select
				value={value}
				onValueChange={(next) => {
					const option = options.find((option) => option.value === next);
					if (option) onChange(option.value);
				}}
			>
				<SelectTrigger className="w-[200px]" aria-labelledby={labelId}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="end">
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

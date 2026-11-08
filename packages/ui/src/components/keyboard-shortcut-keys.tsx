import type { ReactNode } from "react";

import {
	formatCombinedShortcutKeys,
	shouldCombineShortcutKeys,
} from "../lib/keyboard-shortcut-keys";
import { cn } from "../lib/utils";

type KeyboardShortcutKeysVariant = "elevated" | "flat";

const flatShortcutClassName =
	"inline-flex items-center px-1 py-1 leading-none font-medium";

const keyBoxClassName =
	"inline-flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-[4px] px-1 font-sans text-[11px] leading-none font-medium text-muted-foreground shadow-key";

function KeyboardShortcutKeys({
	keys,
	className,
	renderKey,
	variant = "elevated",
}: {
	keys: readonly string[];
	className?: string;
	renderKey?: (key: string) => ReactNode;
	variant?: KeyboardShortcutKeysVariant;
}) {
	const render = renderKey ?? ((key: string) => key);

	if (variant === "flat") {
		if (shouldCombineShortcutKeys(keys)) {
			return (
				<span className={cn(flatShortcutClassName, className)}>
					{formatCombinedShortcutKeys(keys)}
				</span>
			);
		}

		return (
			<span className={cn("flex items-center gap-1", className)}>
				{keys
					.reduce<{ id: string; key: string }[]>((acc, key) => {
						const same = acc.filter((entry) => entry.key === key).length;
						acc.push({
							id: same === 0 ? key : `${key}~${same + 1}`,
							key,
						});
						return acc;
					}, [])
					.map((entry) => (
						<span key={entry.id} className={flatShortcutClassName}>
							{render(entry.key)}
						</span>
					))}
			</span>
		);
	}

	if (shouldCombineShortcutKeys(keys)) {
		return (
			<kbd
				aria-label={formatCombinedShortcutKeys(keys)}
				className={cn("flex items-center gap-1", className)}
			>
				{keys.map((key, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a sequence can repeat a key
					<span key={index} className="flex items-center gap-1">
						{index > 0 ? (
							<span className="font-sans text-[11px] font-[450] text-muted-foreground">
								then
							</span>
						) : null}
						<span className={keyBoxClassName}>{render(key)}</span>
					</span>
				))}
			</kbd>
		);
	}

	return (
		<kbd className={cn("flex items-center gap-1", className)}>
			{keys
				.reduce<{ id: string; key: string }[]>((acc, key) => {
					const same = acc.filter((entry) => entry.key === key).length;
					acc.push({
						id: same === 0 ? key : `${key}~${same + 1}`,
						key,
					});
					return acc;
				}, [])
				.map((entry) => (
					<span key={entry.id} className={keyBoxClassName}>
						{render(entry.key)}
					</span>
				))}
		</kbd>
	);
}

export { KeyboardShortcutKeys, type KeyboardShortcutKeysVariant };

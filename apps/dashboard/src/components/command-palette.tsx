import { CommentIcon, StarIcon } from "@diffkit/icons";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem as CommandItemUI,
	CommandList,
	CommandShortcut,
} from "@diffkit/ui/components/command";
import { cn } from "@diffkit/ui/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import type { CommandItem, CommandItemMeta } from "#/lib/command-palette/types";
import { useCommandItems } from "#/lib/command-palette/use-command-items";
import { useCommandPalette } from "#/lib/command-palette/use-command-palette";

export function CommandPalette() {
	const { open, setOpen, close } = useCommandPalette();
	const router = useRouter();
	const items = useCommandItems();

	const groups = new Map<string, CommandItem[]>();
	for (const item of items) {
		const list = groups.get(item.group) ?? [];
		list.push(item);
		groups.set(item.group, list);
	}

	function handleSelect(item: CommandItem) {
		close();
		if (item.action.type === "navigate") {
			void router.navigate({ to: item.action.to });
		} else {
			void item.action.fn();
		}
	}

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				{Array.from(groups.entries()).map(([groupName, groupItems]) => (
					<CommandGroup key={groupName} heading={groupName}>
						{groupItems.map((item) => (
							<CommandItemUI
								key={item.id}
								value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
								onSelect={() => handleSelect(item)}
							>
								{item.icon && (
									<item.icon
										className={cn("size-4 shrink-0", item.iconClassName)}
									/>
								)}
								<div className="mr-4 min-w-0 flex-1">
									<p className="truncate text-sm">{item.label}</p>
									{item.meta && <ItemMeta meta={item.meta} />}
								</div>
								{item.meta?.comments != null && item.meta.comments > 0 && (
									<span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
										<CommentIcon className="size-4" />
										{item.meta.comments}
									</span>
								)}
								{item.shortcut && <CommandShortcut keys={item.shortcut} />}
							</CommandItemUI>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}

function ItemMeta({ meta }: { meta: CommandItemMeta }) {
	const parts: string[] = [];
	if (meta.repo) parts.push(meta.repo);
	if (meta.language) parts.push(meta.language);

	if (!parts.length && meta.stars == null && !meta.updatedAt) {
		return null;
	}

	return (
		<span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
			{parts.length > 0 && <span>{parts.join(" · ")}</span>}
			{meta.stars != null && meta.stars > 0 && (
				<>
					{parts.length > 0 && <span>·</span>}
					<span className="inline-flex items-center gap-0.5">
						<StarIcon className="size-4" />
						{meta.stars}
					</span>
				</>
			)}
			{meta.updatedAt && (
				<>
					{(parts.length > 0 || (meta.stars != null && meta.stars > 0)) && (
						<span>·</span>
					)}
					<span>{formatRelativeTime(meta.updatedAt)}</span>
				</>
			)}
		</span>
	);
}

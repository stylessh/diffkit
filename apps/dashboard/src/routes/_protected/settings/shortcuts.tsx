import { CommandIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

function ShiftIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M2.5 6.5 6 2l3.5 4.5H7.5V10h-3V6.5H2.5Z"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function OptionIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M1.5 3.5h3L7.5 8.5h3M7.5 3.5h3"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ControlIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M3 7 6 4l3 3"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ArrowLeftIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M2.5 6h7M5 3.5 2.5 6 5 8.5"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ArrowRightIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M9.5 6h-7M7 3.5 9.5 6 7 8.5"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function SpaceIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M2 4.5V8h8V4.5"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ReturnIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M9.5 3v3.5a1 1 0 0 1-1 1H3M4.5 5.5 3 7.5 4.5 9"
				stroke="currentColor"
				strokeWidth="1.1"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Key rendering: maps special key names to SVG icons, falls back to text
// ---------------------------------------------------------------------------

type KeyToken = string | { icon: ReactNode; label: string };

const specialKeys: Record<string, { icon: ReactNode; label: string }> = {
	command: { icon: <CommandIcon size={12} strokeWidth={2} />, label: "Cmd" },
	cmd: { icon: <CommandIcon size={12} strokeWidth={2} />, label: "Cmd" },
	"\u2318": { icon: <CommandIcon size={12} strokeWidth={2} />, label: "Cmd" },
	shift: { icon: <ShiftIcon />, label: "Shift" },
	option: { icon: <OptionIcon />, label: "Option" },
	alt: { icon: <OptionIcon />, label: "Alt" },
	control: { icon: <ControlIcon />, label: "Ctrl" },
	ctrl: { icon: <ControlIcon />, label: "Ctrl" },
	space: { icon: <SpaceIcon />, label: "Space" },
	return: { icon: <ReturnIcon />, label: "Return" },
	enter: { icon: <ReturnIcon />, label: "Enter" },
	"\u2190": { icon: <ArrowLeftIcon />, label: "Left" },
	"\u2192": { icon: <ArrowRightIcon />, label: "Right" },
};

function resolveKey(key: string): KeyToken {
	return specialKeys[key.toLowerCase()] ?? key;
}

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

type Shortcut = {
	keys: string[];
	description: string;
};

type ShortcutGroup = {
	title: string;
	shortcuts: Shortcut[];
};

const isMac =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl";

const shortcutGroups: ShortcutGroup[] = [
	{
		title: "Navigation",
		shortcuts: [
			{ keys: ["G", "H"], description: "Go to Overview" },
			{ keys: ["G", "G"], description: "Open Current Page on GitHub" },
			{ keys: ["G", "U"], description: "Go to Profile" },
			{ keys: ["G", "P"], description: "Go to Pull Requests" },
			{ keys: ["G", "I"], description: "Go to Issues" },
			{ keys: ["G", "R"], description: "Go to Reviews" },
			{ keys: ["G", "S"], description: "Go to Settings" },
		],
	},
	{
		title: "Tabs",
		shortcuts: [
			{ keys: ["Shift", "1\u20139"], description: "Switch to tab by position" },
			{ keys: ["Shift", "W"], description: "Close current tab" },
			{ keys: ["Shift", "\u2190"], description: "Previous tab" },
			{ keys: ["Shift", "\u2192"], description: "Next tab" },
		],
	},
	{
		title: "General",
		shortcuts: [{ keys: [mod, "K"], description: "Open command palette" }],
	},
	{
		title: "Markdown editor",
		shortcuts: [
			{ keys: [mod, "B"], description: "Bold" },
			{ keys: [mod, "I"], description: "Italic" },
			{ keys: [mod, "E"], description: "Inline code" },
			{ keys: [mod, "K"], description: "Insert link" },
			{ keys: [mod, "H"], description: "Heading" },
			{ keys: [mod, "Shift", "."], description: "Blockquote" },
			{ keys: [mod, "Shift", "8"], description: "Bulleted list" },
			{ keys: [mod, "Shift", "7"], description: "Numbered list" },
		],
	},
];

// ---------------------------------------------------------------------------
// Route & component
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_protected/settings/shortcuts")({
	component: ShortcutsPage,
});

function ShortcutsPage() {
	return (
		<>
			<div className="flex flex-col gap-1">
				<h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
				<p className="text-sm text-muted-foreground">
					Quick actions to navigate and interact with DiffKit.
				</p>
			</div>

			<div className="flex flex-col gap-6">
				{shortcutGroups.map((group) => (
					<section key={group.title} className="flex flex-col gap-2">
						<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							{group.title}
						</h3>
						<div className="overflow-hidden rounded-xl border border-border/70">
							{group.shortcuts.map((shortcut, i) => (
								<div
									key={shortcut.description}
									className={cn(
										"flex items-center justify-between px-4 py-2.5",
										i > 0 && "border-t border-border/70",
									)}
								>
									<span className="text-sm">{shortcut.description}</span>
									<kbd className="flex items-center gap-1">
										{shortcut.keys.map((key) => {
											const token = resolveKey(key);
											const isSpecial = typeof token !== "string";
											return (
												<span
													key={key}
													className="inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md border border-border bg-surface-1 px-1.5 text-xs font-medium text-muted-foreground"
												>
													{isSpecial ? token.icon : token}
												</span>
											);
										})}
									</kbd>
								</div>
							))}
						</div>
					</section>
				))}
			</div>
		</>
	);
}

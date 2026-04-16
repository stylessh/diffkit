import {
	CheckIcon,
	DownloadIcon,
	MoonIcon,
	SunIcon,
	SystemIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Logo } from "@diffkit/ui/components/logo";
import { cn } from "@diffkit/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { signOutToLogin } from "#/lib/auth-actions";
import { isDiffKitExtensionPresent } from "#/lib/diffkit-extension-detect";
import { getExtensionStoreInstallUrl } from "#/lib/extension-store-url";
import { useHasMounted } from "#/lib/use-has-mounted";

const themeOptions = [
	{
		value: "light",
		label: "Light",
		icon: SunIcon,
	},
	{
		value: "dark",
		label: "Dark",
		icon: MoonIcon,
	},
	{
		value: "system",
		label: "System",
		icon: SystemIcon,
	},
] as const;

export const Route = createFileRoute("/_protected/settings/")({
	component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
	const { user } = Route.useRouteContext();

	return (
		<>
			<SettingsSection
				title="Appearance"
				description="Choose how DiffKit looks to you."
			>
				<ThemePicker />
			</SettingsSection>

			<SettingsSection
				title="Browser extension"
				description="Automatically redirect GitHub pages to DiffKit."
			>
				<ExtensionCard />
			</SettingsSection>

			<SettingsSection
				title="Repository access"
				description="Manage which GitHub organizations and repositories DiffKit can access."
			>
				<div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3.5">
					<div className="min-w-0">
						<p className="text-sm font-medium">GitHub App permissions</p>
						<p className="text-sm text-muted-foreground">
							Configure installations, add new organizations, or revoke access.
						</p>
					</div>
					<Button asChild variant="outline" size="sm" className="shrink-0">
						<Link to="/setup">Configure</Link>
					</Button>
				</div>
			</SettingsSection>

			<SettingsSection
				title="Account"
				description="Manage your account and session."
			>
				<div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3.5">
					<div className="min-w-0">
						<p className="text-sm font-medium">{user.name ?? "Account"}</p>
						<p className="text-sm text-muted-foreground">{user.email}</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="shrink-0 text-muted-foreground hover:text-foreground"
						onClick={() => void signOutToLogin()}
					>
						Sign out
					</Button>
				</div>
			</SettingsSection>
		</>
	);
}

function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h2 className="text-sm font-semibold">{title}</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			{children}
		</section>
	);
}

function ThemePicker() {
	const { theme, setTheme } = useTheme();
	const hasMounted = useHasMounted();

	return (
		<div className="flex gap-3">
			{themeOptions.map((opt) => {
				const isActive = hasMounted && theme === opt.value;
				return (
					<button
						key={opt.value}
						type="button"
						onClick={() => setTheme(opt.value)}
						className={cn(
							"group flex flex-col items-center gap-2.5 rounded-xl border-2 p-3 transition-colors",
							isActive
								? "border-primary bg-surface-1"
								: "border-transparent bg-surface-1 hover:border-border",
						)}
					>
						{opt.value === "system" ? (
							<SystemThemePreview />
						) : (
							<LayoutPreview mode={opt.value} />
						)}
						<div className="flex items-center gap-1.5">
							<opt.icon
								size={14}
								strokeWidth={2}
								className={cn(
									isActive ? "text-foreground" : "text-muted-foreground",
								)}
							/>
							<span
								className={cn(
									"text-sm",
									isActive
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
							>
								{opt.label}
							</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}

/**
 * Miniature replica of the dashboard layout:
 * bg-muted shell → topbar (avatar dot + nav pills) → rounded card content area with rows.
 */
function LayoutPreview({ mode }: { mode: "light" | "dark" }) {
	const light = mode === "light";
	// Shell (bg-muted equivalent)
	const shell = light ? "bg-zinc-100" : "bg-zinc-900";
	// Topbar elements
	const avatarDot = light ? "bg-zinc-400" : "bg-zinc-500";
	const navPill = light ? "bg-zinc-300" : "bg-zinc-700";
	const navPillActive = light ? "bg-zinc-200/80" : "bg-zinc-600";
	// Content card
	const card = light ? "bg-white" : "bg-zinc-800";
	const cardBorder = light ? "border-zinc-200" : "border-zinc-700";
	// Rows inside card
	const row = light ? "bg-zinc-100" : "bg-zinc-700";
	const rowMuted = light ? "bg-zinc-200" : "bg-zinc-600";

	return (
		<div
			className={cn(
				"flex h-[4.5rem] w-28 flex-col overflow-hidden rounded-lg",
				shell,
			)}
		>
			{/* Topbar */}
			<div className="flex items-center gap-1 px-1.5 py-1">
				<div className={cn("size-2 shrink-0 rounded-full", avatarDot)} />
				<div className={cn("h-1.5 w-5 rounded-sm", navPillActive)} />
				<div className={cn("h-1.5 w-4 rounded-sm", navPill)} />
				<div className={cn("h-1.5 w-4 rounded-sm", navPill)} />
			</div>
			{/* Content card */}
			<div
				className={cn(
					"mx-1 mb-1 flex flex-1 flex-col gap-[3px] rounded-md border p-1.5",
					card,
					cardBorder,
				)}
			>
				{/* Header row */}
				<div className="flex items-center gap-1">
					<div className={cn("h-1 w-6 rounded-sm", rowMuted)} />
				</div>
				{/* List rows */}
				<div className={cn("h-1.5 w-full rounded-sm", row)} />
				<div className={cn("h-1.5 w-full rounded-sm", row)} />
				<div className={cn("h-1.5 w-3/4 rounded-sm", row)} />
			</div>
		</div>
	);
}

/**
 * System theme: renders both light and dark previews stacked,
 * using a diagonal clip-path mask to show left-half light / right-half dark.
 */
function SystemThemePreview() {
	return (
		<div className="relative h-[4.5rem] w-28 overflow-hidden rounded-lg">
			{/* Light – full, clipped to left half */}
			<div
				className="absolute inset-0"
				style={{ clipPath: "polygon(0 0, 55% 0, 45% 100%, 0 100%)" }}
			>
				<LayoutPreview mode="light" />
			</div>
			{/* Dark – full, clipped to right half */}
			<div
				className="absolute inset-0"
				style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }}
			>
				<LayoutPreview mode="dark" />
			</div>
		</div>
	);
}

function ExtensionCard() {
	const hasMounted = useHasMounted();
	const [installed, setInstalled] = useState(false);

	useEffect(() => {
		if (!hasMounted) return;

		setInstalled(isDiffKitExtensionPresent());

		if (isDiffKitExtensionPresent()) return;

		const el = document.documentElement;
		const observer = new MutationObserver(() => {
			if (isDiffKitExtensionPresent()) {
				setInstalled(true);
				observer.disconnect();
			}
		});
		observer.observe(el, {
			attributes: true,
			attributeFilter: ["data-diffkit-extension"],
		});
		return () => observer.disconnect();
	}, [hasMounted]);

	const installHref = getExtensionStoreInstallUrl();

	return (
		<div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-3.5">
			<div className="flex min-w-0 items-center gap-3">
				<Logo className="size-5 shrink-0" aria-hidden />
				<div className="min-w-0">
					<p className="text-sm font-medium">DiffKit Extension</p>
					<p className="text-sm text-muted-foreground">
						{installed
							? "The extension is installed and active."
							: "Redirect GitHub PRs, issues, and matching pages to DiffKit."}
					</p>
				</div>
			</div>
			{installed ? (
				<span className="flex shrink-0 items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
					<CheckIcon size={14} strokeWidth={2} />
					Installed
				</span>
			) : (
				<Button asChild variant="outline" size="sm" className="shrink-0">
					<a href={installHref} target="_blank" rel="noopener noreferrer">
						<DownloadIcon size={14} strokeWidth={2} />
						Install
					</a>
				</Button>
			)}
		</div>
	);
}

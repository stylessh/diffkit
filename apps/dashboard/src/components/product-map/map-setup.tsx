import {
	AlertCircleIcon,
	AntigravityLogo,
	ChatGPTLogo,
	CheckIcon,
	ClaudeLogo,
	CopyIcon,
	CursorLogo,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { ScrollFade } from "@diffkit/ui/components/scroll-fade";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { RepoHeader } from "#/components/repo/repo-header";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { areaIcon } from "./map-icons";
import { mapFixPrompt, mapSetupPrompt } from "./map-prompt";
import type { MapWriteAccess } from "./product-map-data";

/** Each agent's own mark in its own colours, light and dark. */
const AGENTS: {
	name: string;
	logo: ComponentType<{ className?: string }>;
	className: string;
}[] = [
	{ name: "Claude Code", logo: ClaudeLogo, className: "" },
	{ name: "Codex", logo: ChatGPTLogo, className: "text-black dark:text-white" },
	{
		name: "Cursor",
		logo: CursorLogo,
		className: "text-[#26251e] dark:text-[#edecec]",
	},
	{ name: "Antigravity", logo: AntigravityLogo, className: "" },
];

type CopyState = "idle" | "copied";

function CopyPromptButton({ prompt }: { prompt: string }) {
	const [state, setState] = useState<CopyState>("idle");
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(prompt);
		} catch {
			return;
		}
		setState("copied");
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setState("idle"), 1800);
	};

	const label = state === "copied" ? "Copied" : "Copy prompt";
	return (
		<Tooltip open={state === "copied" ? true : undefined}>
			<TooltipTrigger asChild>
				<Button
					variant="accent"
					size="icon"
					aria-label={label}
					onClick={copy}
					className="size-7 rounded-md"
				>
					{state === "copied" ? (
						<CheckIcon className="size-3.5" />
					) : (
						<CopyIcon className="size-3.5" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function PromptCard({
	prompt,
	className,
}: {
	prompt: string;
	className?: string;
}) {
	return (
		<section
			aria-label="Prompt for a coding agent"
			className={cn(
				"overflow-hidden rounded-xl bg-card shadow-card",
				className,
			)}
		>
			<div className="flex items-center gap-3 border-rule border-b-[0.5px] bg-group/60 py-2.5 pr-2.5 pl-4">
				<span className="font-[450] text-muted-foreground text-xs max-sm:hidden">
					Paste into
				</span>
				<ul className="flex items-center gap-1">
					{AGENTS.map(({ name, logo: Logo, className }) => (
						<li key={name}>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex size-7 items-center justify-center rounded-md bg-button shadow-button">
										<Logo className={cn("size-4", className)} />
										<span className="sr-only">{name}</span>
									</span>
								</TooltipTrigger>
								<TooltipContent>{name}</TooltipContent>
							</Tooltip>
						</li>
					))}
				</ul>
				<span className="font-[450] text-muted-foreground text-xs max-sm:hidden">
					or any coding agent
				</span>
				<span className="ml-auto">
					<CopyPromptButton prompt={prompt} />
				</span>
			</div>
			<pre className="whitespace-pre-wrap px-4 py-3.5 font-mono text-[12px] text-text-header leading-[1.6]">
				{prompt.trimEnd()}
			</pre>
		</section>
	);
}

const headingClassName =
	"text-pretty font-semibold text-[23px] text-foreground leading-8 tracking-[-0.01em]";

const EXAMPLE: { group: string; areas: [icon: string, name: string][] }[] = [
	{
		group: "Getting in",
		areas: [
			["lock", "Sign-in"],
			["home", "Onboarding"],
		],
	},
	{
		group: "What people use",
		areas: [
			["inbox", "Inbox"],
			["command", "Search"],
			["comment", "Comments"],
			["settings", "Settings"],
		],
	},
	{
		group: "Working together",
		areas: [
			["pull", "Reviews"],
			["issues", "Tasks"],
			["tag", "Releases"],
		],
	},
	{
		group: "Behind the screens",
		areas: [
			["layers", "Storage"],
			["refresh", "Sync"],
			["globe", "Public API"],
			["cache", "Cache"],
		],
	},
	{
		group: "Around the product",
		areas: [
			["actions", "CI"],
			["package", "Packaging"],
		],
	},
];

/** A still of the page a map produces: what the overlay's prompt leads to. */
function ExampleMap() {
	return (
		<div
			aria-hidden
			className="flex select-none flex-col opacity-70 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
		>
			<div className="flex flex-col gap-2 pb-7">
				<span className={headingClassName}>
					A shared inbox for everything your team ships.
				</span>
				<span className="font-[450] text-[13px] text-muted-foreground">
					Click an area to see how it works.
				</span>
			</div>
			{EXAMPLE.map(({ group, areas }) => (
				<div
					key={group}
					className="grid gap-x-6 gap-y-2 border-header-rule border-t-[0.5px] py-6 sm:grid-cols-[9rem_minmax(0,1fr)]"
				>
					<span className="font-[450] text-[13px] text-muted-foreground sm:leading-8">
						{group}
					</span>
					<div className="flex flex-wrap gap-2">
						{areas.map(([icon, name]) => {
							const Icon = areaIcon(icon);
							return (
								<span
									key={name}
									className="inline-flex h-8 items-center gap-2 rounded-lg bg-button px-2.5 font-medium text-[13px] text-text-header shadow-button"
								>
									<Icon
										size={14}
										strokeWidth={2}
										className="shrink-0 text-muted-foreground"
									/>
									{name}
								</span>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * The repository's own header and tabs around the states that have no map to
 * draw: the reading column, without the map's side panel.
 */
function MapFrame({
	owner,
	repo,
	children,
}: {
	owner: string;
	repo: string;
	children: ReactNode;
}) {
	const scope = useGitHubQueryScope();
	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader owner={owner} repo={repo} scope={scope} active="map" />
			<ScrollFade
				orientation="vertical"
				fade={32}
				className="min-h-0 flex-1 bg-main"
			>
				<div className="mx-auto flex w-full min-w-0 max-w-[780px] flex-col gap-8 px-4 pt-14 pb-24 sm:px-[46px] md:px-8 md:pb-16 lg:px-[46px]">
					{children}
				</div>
			</ScrollFade>
		</div>
	);
}

/**
 * No map yet. Over a still of what the page becomes, someone who can push
 * gets the prompt that gets there; anyone else is only told there is none.
 * Until GitHub says which, the still stands alone: the prompt is fixed text,
 * so there is nothing of it to draw a skeleton for.
 */
export function MapMissing({
	owner,
	repo,
	access,
}: {
	owner: string;
	repo: string;
	access: MapWriteAccess;
}) {
	return (
		<MapFrame owner={owner} repo={repo}>
			<div className="relative">
				<ExampleMap />
				{access === "loading" ? null : (
					<div className="absolute inset-0 flex items-center justify-center">
						{access === "can-push" ? (
							<div className="relative flex w-full max-w-[31rem] flex-col gap-2.5">
								<div
									aria-hidden
									className="-inset-x-24 -top-20 -bottom-14 pointer-events-none absolute rounded-[4rem] bg-main blur-2xl max-sm:-inset-x-6"
								/>
								<h1 className="relative text-pretty px-4 font-medium text-[14px] text-foreground leading-5">
									Give {repo} a product map
								</h1>
								<PromptCard
									prompt={mapSetupPrompt(owner, repo)}
									className="relative w-full"
								/>
							</div>
						) : (
							<div className="relative flex flex-col items-center gap-1 text-center">
								<div
									aria-hidden
									className="-inset-x-24 -inset-y-14 pointer-events-none absolute rounded-[4rem] bg-main blur-2xl max-sm:-inset-x-6"
								/>
								<h1 className="relative text-pretty font-medium text-[14px] text-foreground leading-5">
									{repo} has no product map yet
								</h1>
								<p className="relative text-pretty font-[450] text-[13px] text-muted-foreground leading-5">
									Someone who can push to it can add one.
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</MapFrame>
	);
}

/**
 * A map that was rejected: what is wrong and, for someone who can push the
 * fix, a prompt that makes it.
 */
export function MapInvalid({
	owner,
	repo,
	problems,
	canFix,
}: {
	owner: string;
	repo: string;
	problems: string[];
	canFix: boolean;
}) {
	return (
		<MapFrame owner={owner} repo={repo}>
			<header className="flex flex-col gap-2">
				<h1 className={headingClassName}>The map needs fixing</h1>
				<p className="text-pretty font-[450] text-[13px] text-muted-foreground leading-5">
					DiffKit could not read the{" "}
					<code className="rounded-[5px] bg-inline-code px-1 py-0.5 font-mono text-[12px] text-text-header">
						.diffkit
					</code>{" "}
					folder.{canFix ? " Fix these and the map appears here." : null}
				</p>
			</header>
			<ul className="flex flex-col gap-3">
				{problems.map((problem) => (
					<li key={problem} className="flex gap-3">
						<AlertCircleIcon
							size={15}
							strokeWidth={2}
							className="mt-[3px] shrink-0 text-warning"
						/>
						<span className="text-pretty text-[13px] text-foreground leading-5">
							{problem}
						</span>
					</li>
				))}
			</ul>
			{canFix ? <PromptCard prompt={mapFixPrompt(problems)} /> : null}
		</MapFrame>
	);
}

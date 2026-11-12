import {
	AlertCircleIcon,
	AntigravityLogo,
	ChatGPTLogo,
	CheckIcon,
	ClaudeLogo,
	CopyIcon,
	CursorLogo,
	LayersIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { ScrollFade } from "@diffkit/ui/components/scroll-fade";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { ViewTab, ViewTabs } from "@diffkit/ui/components/view-tabs";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { areaIcon } from "./map-icons";
import { mapFixPrompt, mapSetupPrompt } from "./map-prompt";

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
					Hover an area to see what it builds on. Click to open it.
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

const LENS_LABELS = ["Structure", "Activity", "Size", "Open work"];

/**
 * The map page's own frame, for the states that have no map to draw in it:
 * the same header, toolbar and reading column, without the side panel.
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
	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader>
				<PageHeaderCrumb asChild className="max-sm:hidden">
					<Link to="/$owner/$repo" params={{ owner, repo }}>
						{owner}/{repo}
					</Link>
				</PageHeaderCrumb>
				<PageHeaderTitle asChild>
					<span>
						<LayersIcon size={14} />
						Product map
					</span>
				</PageHeaderTitle>
			</PageHeader>
			<div className="flex min-h-0 flex-1 flex-col bg-main">
				<div className="z-10 shrink-0 bg-main">
					<ViewTabs label="Map views">
						{LENS_LABELS.map((label) => (
							<ViewTab
								key={label}
								disabled
								className="disabled:pointer-events-none disabled:opacity-50"
							>
								{label}
							</ViewTab>
						))}
					</ViewTabs>
				</div>
				<ScrollFade orientation="vertical" fade={32} className="min-h-0 flex-1">
					<div className="mx-auto flex w-full min-w-0 max-w-[780px] flex-col gap-8 px-4 pt-14 pb-24 sm:px-[46px] md:px-8 md:pb-16 lg:px-[46px]">
						{children}
					</div>
				</ScrollFade>
			</div>
		</div>
	);
}

export function MapLoading({ owner, repo }: { owner: string; repo: string }) {
	return (
		<MapFrame owner={owner} repo={repo}>
			<div className="flex h-40 items-center justify-center">
				<Spinner className="size-4 text-muted-foreground" />
			</div>
		</MapFrame>
	);
}

/**
 * No map yet: a still of what the page becomes, with the prompt that gets
 * there laid over it.
 */
export function MapSetup({ owner, repo }: { owner: string; repo: string }) {
	return (
		<MapFrame owner={owner} repo={repo}>
			<div className="relative">
				<ExampleMap />
				<div className="absolute inset-0 flex items-center justify-center">
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
				</div>
			</div>
		</MapFrame>
	);
}

/** A map that was rejected: what is wrong, and a prompt that fixes it. */
export function MapInvalid({
	owner,
	repo,
	problems,
}: {
	owner: string;
	repo: string;
	problems: string[];
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
					folder. Fix these and the map appears here.
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
			<PromptCard prompt={mapFixPrompt(problems)} />
		</MapFrame>
	);
}

import {
	AlertCircleIcon,
	AntigravityLogo,
	ChatGPTLogo,
	CheckIcon,
	ClaudeLogo,
	CodeIcon,
	CopyIcon,
	CursorLogo,
	GitMergeIcon,
	GitPullRequestIcon,
	LayersIcon,
	RefreshCwIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	DetailLayout,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
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

	return (
		<Button
			size="sm"
			onClick={copy}
			iconLeft={
				state === "copied" ? (
					<CheckIcon className="size-3.5" />
				) : (
					<CopyIcon className="size-3.5" />
				)
			}
		>
			<span aria-live="polite">
				{state === "copied" ? "Copied" : "Copy prompt"}
			</span>
		</Button>
	);
}

function PromptCard({ prompt }: { prompt: string }) {
	return (
		<section
			aria-label="Prompt for a coding agent"
			className="overflow-hidden rounded-xl bg-card shadow-card"
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
		group: "Behind the screens",
		areas: [
			["layers", "Storage"],
			["refresh", "Sync"],
			["globe", "Public API"],
		],
	},
];

/** A still of the page a map file produces, so the empty page shows where this leads. */
function ExampleMap() {
	return (
		<figure className="flex flex-col gap-4">
			<figcaption className="font-[450] text-muted-foreground text-xs">
				What appears here once it is merged
			</figcaption>
			<div
				aria-hidden
				className="flex select-none flex-col opacity-70 [mask-image:linear-gradient(to_bottom,black_35%,transparent)]"
			>
				{EXAMPLE.map(({ group, areas }) => (
					<div
						key={group}
						className="grid gap-x-6 gap-y-2 border-header-rule border-t-[0.5px] py-5 sm:grid-cols-[9rem_minmax(0,1fr)]"
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
		</figure>
	);
}

function SetupPanel() {
	return (
		<>
			<p className="mb-7 text-pretty text-[13px] text-foreground leading-5">
				A product map shows a repository as its areas, in plain language,
				instead of a file tree.
			</p>
			<PanelSection label="Three steps">
				<PanelRow icon={<CopyIcon size={14} strokeWidth={2} />}>
					Copy the prompt
				</PanelRow>
				<PanelRow icon={<CodeIcon size={14} strokeWidth={2} />}>
					Run it in your checkout
				</PanelRow>
				<PanelRow icon={<GitMergeIcon size={14} strokeWidth={2} />}>
					Merge its pull request
				</PanelRow>
			</PanelSection>
			<PanelSection label="After that">
				<PanelRow muted icon={<RefreshCwIcon size={14} strokeWidth={2} />}>
					Agents update it with each change
				</PanelRow>
				<PanelRow muted icon={<GitPullRequestIcon size={14} strokeWidth={2} />}>
					DiffKit counts pull requests per area
				</PanelRow>
				<PanelRow muted icon={<UserMultiple02Icon size={14} strokeWidth={2} />}>
					And who works where
				</PanelRow>
			</PanelSection>
		</>
	);
}

const LENS_LABELS = ["Structure", "Activity", "Size", "Open work"];

/** The map page's own frame, for the states that have no map to draw in it. */
function MapFrame({
	owner,
	repo,
	panel,
	children,
}: {
	owner: string;
	repo: string;
	panel?: ReactNode;
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
			<div className="relative min-h-0 flex-1 overflow-hidden">
				<div className="absolute inset-0 flex flex-col bg-main">
					<DetailLayout
						panelLabel="About product maps"
						panel={panel ?? <SetupPanel />}
						toolbar={
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
						}
					>
						{children}
					</DetailLayout>
				</div>
			</div>
		</div>
	);
}

function FrameHeading({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<header className="flex flex-col gap-2">
			<h1 className="text-pretty font-semibold text-[23px] text-foreground leading-8 tracking-[-0.01em]">
				{title}
			</h1>
			<p className="text-pretty font-[450] text-[13px] text-muted-foreground leading-5">
				{children}
			</p>
		</header>
	);
}

export function MapLoading({ owner, repo }: { owner: string; repo: string }) {
	return (
		<MapFrame owner={owner} repo={repo} panel={<span />}>
			<div className="flex h-40 items-center justify-center">
				<Spinner className="size-4 text-muted-foreground" />
			</div>
		</MapFrame>
	);
}

/** No map file yet: the prompt that produces one, and what it leads to. */
export function MapSetup({ owner, repo }: { owner: string; repo: string }) {
	const prompt = mapSetupPrompt(owner, repo);
	return (
		<MapFrame owner={owner} repo={repo}>
			<FrameHeading title={`Give ${repo} a product map`}>
				Paste this into a coding agent in your checkout. It installs a skill,
				reads the code, writes the{" "}
				<code className="rounded-[5px] bg-inline-code px-1 py-0.5 font-mono text-[12px] text-text-header">
					.diffkit
				</code>{" "}
				folder and opens a pull request. Merge it and the map appears here.
			</FrameHeading>
			<PromptCard prompt={prompt} />
			<ExampleMap />
		</MapFrame>
	);
}

/** A map file that was rejected: what is wrong, and a prompt that fixes it. */
export function MapInvalid({
	owner,
	repo,
	problems,
}: {
	owner: string;
	repo: string;
	problems: string[];
}) {
	const prompt = mapFixPrompt(problems);
	return (
		<MapFrame owner={owner} repo={repo}>
			<FrameHeading title="The map file needs fixing">
				DiffKit could not read the{" "}
				<code className="rounded-[5px] bg-inline-code px-1 py-0.5 font-mono text-[12px] text-text-header">
					.diffkit
				</code>{" "}
				folder. Fix these and the map appears here.
			</FrameHeading>
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
			<PromptCard prompt={prompt} />
		</MapFrame>
	);
}

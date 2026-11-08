import { ChevronRightIcon } from "@diffkit/icons";
import {
	PageHeader,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { cn } from "@diffkit/ui/lib/utils";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
} from "@tanstack/react-router";
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const settingsNav = [
	{ to: "/settings", label: "General" },
	{ to: "/settings/shortcuts", label: "Shortcuts" },
] as const;

export const Route = createFileRoute("/_protected/settings")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Settings"),
			description: "Configure your DiffKit preferences.",
			robots: "noindex",
		}),
	component: SettingsLayout,
});

function SettingsLayout() {
	const matches = useMatches();
	const currentPath = matches[matches.length - 1]?.pathname ?? "/settings";

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader>
				<PageHeaderTitle>Settings</PageHeaderTitle>
			</PageHeader>
			<div className="min-h-0 flex-1 overflow-auto py-8">
				<div className="mx-auto grid max-w-3xl gap-10 px-4 md:px-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
					<aside className="flex h-fit flex-col gap-5 lg:sticky lg:top-0">
						<nav className="-mx-2.5 flex flex-col gap-px" aria-label="Settings">
							{settingsNav.map((item) => {
								const normalizedPath =
									currentPath.replace(/\/+$/, "") || "/settings";
								const isActive =
									normalizedPath === item.to ||
									(item.to !== "/settings" &&
										normalizedPath.startsWith(item.to));
								return (
									<Link
										key={item.to}
										to={item.to}
										activeOptions={{ exact: item.to === "/settings" }}
										className={cn(
											"flex h-7 items-center justify-between rounded-lg px-2.5 text-[13px] font-medium transition-colors",
											isActive
												? "bg-nav-selected text-foreground"
												: "text-text-nav hover:bg-nav-hover hover:text-foreground",
										)}
									>
										{item.label}
										<ChevronRightIcon
											size={14}
											strokeWidth={2}
											className={cn(
												"transition-opacity",
												isActive ? "opacity-100" : "opacity-0",
											)}
										/>
									</Link>
								);
							})}
						</nav>
					</aside>

					<div className="flex flex-col gap-8">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}

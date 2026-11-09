import { Toaster } from "@diffkit/ui/components/sonner";
import { TooltipProvider } from "@diffkit/ui/components/tooltip";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { lazy, Suspense } from "react";
import { ErrorScreen } from "#/components/layouts/error-screen";
import { buildSeo, buildWebSiteSchema } from "#/lib/seo";
import { siteConfig } from "#/lib/site-config";

import appCss from "../styles.css?url";

const DevAgentation = import.meta.env.DEV
	? lazy(() =>
			import("agentation").then((mod) => ({ default: mod.Agentation })),
		)
	: null;

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	head: ({ match }) => {
		const defaultSeo = buildSeo({
			path: match.pathname,
			title: siteConfig.defaultTitle,
			description: siteConfig.defaultDescription,
			includeCanonical: false,
		});

		return {
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "application-name", content: siteConfig.name },
				{ name: "apple-mobile-web-app-title", content: siteConfig.name },
				{ name: "theme-color", content: siteConfig.themeColor },
				{ name: "format-detection", content: "telephone=no" },
				...defaultSeo.meta,
			],
			links: [
				{
					rel: "icon",
					type: "image/svg+xml",
					href: import.meta.env.DEV ? "/favicon-dev.svg" : "/favicon.svg",
				},
				{ rel: "manifest", href: "/manifest.json" },
				{ rel: "stylesheet", href: appCss },
			],
			scripts: [
				{
					type: "application/ld+json",
					children: JSON.stringify(
						buildWebSiteSchema({ path: match.pathname }),
					),
				},
				...(import.meta.env.DEV
					? [
							{
								src: "https://unpkg.com/react-scan/dist/auto.global.js",
								async: true,
							},
						]
					: []),
			],
		};
	},
	component: RootComponent,
	errorComponent: ErrorScreen,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans antialiased">
				{children}
				{DevAgentation ? (
					<Suspense>
						<DevAgentation />
					</Suspense>
				) : null}
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<NuqsAdapter>
				<TooltipProvider>
					<Outlet />
				</TooltipProvider>
				<Toaster />
			</NuqsAdapter>
		</ThemeProvider>
	);
}

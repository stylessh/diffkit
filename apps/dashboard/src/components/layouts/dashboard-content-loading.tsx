import {
	type RegisteredRouter,
	useMatch,
	useRouter,
} from "@tanstack/react-router";
import {
	type CSSProperties,
	type ReactNode,
	Suspense,
	use,
	useState,
} from "react";
import { SkeletonBox } from "skullet/react";

const PENDING_REVEAL_DELAY_MS = 300;
const COLD_ROUTE_ATTRIBUTE = "data-cold-route";

/**
 * The pending component of every `ssr: false` route.
 *
 * Such a route's page is never rendered on the server, so a hard load used to
 * ship a placeholder that had nothing to do with the page. Instead the server
 * renders the route's own component here. With no data and no effects that is
 * exactly the page's cold state: its real chrome around its own skeleton.
 *
 * The browser adopts that markup as it stands rather than hydrating it. The
 * pending slot only lives until the route's chunk has loaded, and a hydrated
 * copy would fetch, animate and then be thrown away for the real page.
 *
 * It is `inert` because nothing in it is wired up: text typed into a form here
 * would be erased when the real page replaces it.
 *
 * A page that cannot run in the worker (it or one of its imports reads
 * `window`, `document` or `HTMLElement` while loading or rendering) must opt
 * out with `pendingComponent: GenericRoutePending`, or every hard load logs a
 * failed server render before falling back to the generic skeleton.
 */
export function RoutePending() {
	const clientOnlyRouteId = useMatch({
		strict: false,
		select: (match) => (match.ssr === false ? match.routeId : null),
	});
	if (!clientOnlyRouteId) return <GenericRoutePending />;
	return typeof window === "undefined" ? (
		<ServerColdRoute routeId={clientOnlyRouteId} />
	) : (
		<AdoptedColdRoute routeId={clientOnlyRouteId} />
	);
}

export function GenericRoutePending() {
	return (
		<PendingReveal>
			<DashboardContentLoading />
		</PendingReveal>
	);
}

type RouteId = keyof RegisteredRouter["routesById"];

function ServerColdRoute({ routeId }: { routeId: RouteId }) {
	return (
		<div
			{...{ [COLD_ROUTE_ATTRIBUTE]: routeId }}
			className="pending-reveal h-full"
			inert
		>
			<Suspense fallback={<DashboardContentLoading />}>
				<ColdRoutePage routeId={routeId} />
			</Suspense>
		</div>
	);
}

function ColdRoutePage({ routeId }: { routeId: RouteId }) {
	const router = useRouter();
	const Page = router.routesById[routeId].options.component;
	const outcome = use(coldPageLoad(router, routeId, Page));
	return outcome === "loaded" && Page ? <Page /> : <DashboardContentLoading />;
}

type ColdPageLoad = "loaded" | "unavailable";

const PAGE_MODULE_BUDGET_MS = 1000;
const coldPageLoads = new WeakMap<object, Map<string, Promise<ColdPageLoad>>>();

/**
 * A page module that never settles must not hold the document open, so the
 * wait is bounded and ends in the generic skeleton. Kept per router, which on
 * the server is per request, so React sees one promise however often it
 * retries the render.
 */
function coldPageLoad(
	router: object,
	routeId: string,
	Page: { preload?: () => Promise<unknown> | undefined } | undefined,
) {
	const loads = coldPageLoads.get(router) ?? new Map();
	coldPageLoads.set(router, loads);
	const existing = loads.get(routeId);
	if (existing) return existing;
	const load = Promise.race<ColdPageLoad>([
		Promise.resolve(Page?.preload?.()).then(() => "loaded"),
		new Promise((resolve) => {
			setTimeout(() => resolve("unavailable"), PAGE_MODULE_BUDGET_MS);
		}),
	]);
	loads.set(routeId, load);
	return load;
}

type ServerMarkup =
	| { phase: "hydrating"; byRouteId: Map<string, string> }
	| { phase: "settled" };

let serverMarkup: ServerMarkup = { phase: "hydrating", byRouteId: new Map() };

/**
 * Server markup describes the URL the document was loaded with. Once the
 * first navigation resolves it is stale for every later visit to its route.
 */
export function discardServerRenderedPending() {
	serverMarkup = { phase: "settled" };
}

/**
 * Remembered on first read: the pending element can be created again before
 * the page takes over, after React has already removed the server's copy.
 */
function readServerColdRoute(routeId: string) {
	if (serverMarkup.phase === "settled") return null;
	const remembered = serverMarkup.byRouteId.get(routeId);
	if (remembered !== undefined) return remembered;
	const markup = document.querySelector(
		`[${COLD_ROUTE_ATTRIBUTE}="${CSS.escape(routeId)}"]`,
	)?.innerHTML;
	if (markup === undefined) return null;
	serverMarkup.byRouteId.set(routeId, markup);
	return markup;
}

function AdoptedColdRoute({ routeId }: { routeId: RouteId }) {
	const [markup] = useState(() => readServerColdRoute(routeId));
	const [reveal] = useState(revealOnDocumentClock);
	if (markup === null) return <GenericRoutePending />;
	return (
		<div
			{...{ [COLD_ROUTE_ATTRIBUTE]: routeId }}
			className="pending-reveal h-full"
			inert
			style={reveal}
			suppressHydrationWarning
			// biome-ignore lint/security/noDangerouslySetInnerHtml: our own server render of this route, read back from the document
			dangerouslySetInnerHTML={{ __html: markup }}
		/>
	);
}

function PendingReveal({
	className = "h-full",
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	const [reveal] = useState(revealOnDocumentClock);
	return (
		<div
			className={`pending-reveal ${className}`}
			style={reveal}
			suppressHydrationWarning
		>
			{children}
		</div>
	);
}

/**
 * `.pending-reveal` hides pending UI for its first 300 ms, counted from when
 * its element is created. Server markup starts that clock at first paint. An
 * element created later joins the same clock through a negative delay, so a
 * skeleton that is already on screen does not blink out and fade in again.
 * On a client navigation the router has waited `defaultPendingMs` before
 * showing anything, and the delay is far enough in the past to skip the fade.
 */
function revealOnDocumentClock(): CSSProperties | undefined {
	if (typeof window === "undefined") return undefined;
	return {
		animationDelay: `${PENDING_REVEAL_DELAY_MS - performance.now()}ms`,
	};
}

const CONTENT_SKELETON_ROW_WIDTHS = [72, 54, 63, 48, 68, 57, 44, 61];

/** A page whose shape is not known: a title, then rows. */
export function DashboardContentLoading() {
	return (
		<div aria-hidden className="flex h-full flex-col overflow-hidden">
			<div className="flex h-12 shrink-0 items-center px-4">
				<SkeletonBox width={140} height={16} radius={6} />
			</div>
			<div className="flex flex-col px-2 pt-2">
				{CONTENT_SKELETON_ROW_WIDTHS.map((width) => (
					<div key={width} className="flex h-11 items-center gap-3 px-3">
						<SkeletonBox width={16} height={16} radius={5} />
						<SkeletonBox width={`${width}%`} height={12} radius={4} />
					</div>
				))}
			</div>
		</div>
	);
}

/** The signed-in shell before the session is known: top bar, then the page. */
export function DashboardViewportLoading() {
	return (
		<PendingReveal className="flex h-dvh flex-col bg-shell">
			<div className="h-11 shrink-0" />
			<div className="flex flex-1 overflow-hidden pt-px md:px-2 md:pt-0.5 md:pb-2">
				<div className="min-w-0 flex-1 overflow-hidden rounded-t-xl bg-main shadow-main md:rounded-xl">
					<DashboardContentLoading />
				</div>
			</div>
		</PendingReveal>
	);
}

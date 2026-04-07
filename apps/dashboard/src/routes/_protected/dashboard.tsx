import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@quickhub/ui/components/avatar";
import { Badge } from "@quickhub/ui/components/badge";
import { Button } from "@quickhub/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@quickhub/ui/components/card";
import { Logo } from "@quickhub/ui/components/logo";
import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "#/lib/auth.client";

export const Route = createFileRoute("/_protected/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const displayName = user.name ?? user.email ?? "QuickHub user";
	const initials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<main className="min-h-dvh bg-[linear-gradient(180deg,_color-mix(in_oklch,_var(--color-secondary)_55%,_transparent)_0%,_transparent_38%)] p-4 sm:p-8">
			<div className="mx-auto grid max-w-5xl gap-6">
				<div className="flex items-center gap-3 px-1">
					<Logo className="size-8" />
					<div>
						<p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
							QuickHub
						</p>
						<p className="text-sm text-muted-foreground">Workspace</p>
					</div>
				</div>

				<Card className="border-border/70 bg-background/95 shadow-sm">
					<CardHeader className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-4">
							<Avatar className="size-14 border border-border/70">
								<AvatarImage src={user.image ?? undefined} alt={displayName} />
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<CardTitle className="text-xl tracking-tight sm:text-2xl">
										Welcome, {displayName}
									</CardTitle>
									<Badge variant="secondary">Connected</Badge>
								</div>
								<CardDescription className="text-sm">
									The dashboard now pulls from the shared Circle-derived
									component library in <code>@quickhub/ui</code>.
								</CardDescription>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								signOut().then(() => {
									window.location.href = "/";
								})
							}
						>
							Sign out
						</Button>
					</CardHeader>
				</Card>

				<section className="grid gap-4 md:grid-cols-3">
					<Card className="border-border/70 bg-background/90">
						<CardHeader>
							<CardTitle className="text-base">Theme</CardTitle>
							<CardDescription>
								Circle tokens now define the workspace palette and surface
								language.
							</CardDescription>
						</CardHeader>
					</Card>
					<Card className="border-border/70 bg-background/90">
						<CardHeader>
							<CardTitle className="text-base">Primitives</CardTitle>
							<CardDescription>
								Shared buttons, cards, badges, dialogs, forms, and more now live
								in the UI package.
							</CardDescription>
						</CardHeader>
					</Card>
					<Card className="border-border/70 bg-background/90">
						<CardHeader>
							<CardTitle className="text-base">Next step</CardTitle>
							<CardDescription>
								Build QuickHub-specific layouts on top of these imported
								foundation pieces.
							</CardDescription>
						</CardHeader>
					</Card>
				</section>
			</div>
		</main>
	);
}

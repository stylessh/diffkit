import { Button } from "@quickhub/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@quickhub/ui/components/card";
import { Logo } from "@quickhub/ui/components/logo";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { signIn } from "#/lib/auth.client";
import { getSession } from "#/lib/auth.functions";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) throw redirect({ to: "/dashboard" });
	},
	component: LoginPage,
});

function LoginPage() {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,_var(--color-primary)_6%,_transparent),_transparent_48%),linear-gradient(180deg,_color-mix(in_oklch,_var(--color-secondary)_65%,_white)_0%,_transparent_45%)] px-4">
			<Card className="w-full max-w-md border-border/70 bg-background/95 shadow-sm backdrop-blur">
				<CardHeader className="gap-5 text-center">
					<div className="mx-auto flex items-center gap-3">
						<Logo />
						<div className="text-left">
							<p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
								QuickHub
							</p>
							<p className="text-sm text-muted-foreground">Placeholder logo</p>
						</div>
					</div>
					<CardTitle className="text-2xl tracking-tight sm:text-3xl">
						Sign in to QuickHub
					</CardTitle>
					<CardDescription className="text-base">
						Connect GitHub to start from the imported Circle base theme and grow
						your own workflow from there.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						type="button"
						size="lg"
						className="w-full"
						onClick={() => signIn.social({ provider: "github" })}
					>
						Continue with GitHub
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}

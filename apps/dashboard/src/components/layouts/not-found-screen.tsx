import { Button } from "@diffkit/ui/components/button";
import { Logo } from "@diffkit/ui/components/logo";
import { Link } from "@tanstack/react-router";

export function NotFoundScreen() {
	return (
		<main className="isolate flex min-h-dvh items-center justify-center bg-background p-6">
			<div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
				<Logo
					className="size-12 text-foreground"
					variant={import.meta.env.DEV ? "dev" : "default"}
				/>

				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium tabular-nums text-muted-foreground">
						404
					</p>
					<h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
						Page not found
					</h1>
					<p className="text-base text-pretty text-muted-foreground sm:text-sm">
						Check the URL or head back to your dashboard.
					</p>
				</div>

				<div className="flex flex-col items-center gap-2 sm:flex-row">
					<Button asChild>
						<Link to="/">Go to dashboard</Link>
					</Button>
					<Button variant="ghost" asChild>
						<Link to="/login" search={{ redirect: "/" }}>
							Sign in
						</Link>
					</Button>
				</div>
			</div>
		</main>
	);
}

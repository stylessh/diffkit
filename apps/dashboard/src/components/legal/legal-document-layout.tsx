import { Logo } from "@diffkit/ui/components/logo";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { siteConfig } from "#/lib/site-config";

type LegalDocumentLayoutProps = {
	title: string;
	children: React.ReactNode;
};

export function LegalDocumentLayout({
	title,
	children,
}: LegalDocumentLayoutProps) {
	return (
		<main className="isolate min-h-dvh bg-background">
			<div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-20">
				<header className="mb-12 sm:mb-16">
					<Link
						to="/"
						className="inline-flex items-center gap-3 rounded-lg text-foreground outline-none transition-opacity hover:opacity-80 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
					>
						<Logo
							className="size-9"
							variant={import.meta.env.DEV ? "dev" : "default"}
						/>
						<span className="text-[15px] font-semibold tracking-tight">
							{siteConfig.name}
						</span>
					</Link>
					<h1 className="mt-10 text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
						{title}
					</h1>
					<p className="mt-4 text-[15px] text-muted-foreground">
						<Link
							to="/"
							className="font-medium text-primary underline-offset-4 hover:underline"
						>
							← Back to home
						</Link>
					</p>
				</header>

				<article
					className={cn(
						"prose prose-lg prose-neutral mx-auto w-full max-w-[65ch] dark:prose-invert",
						"prose-p:leading-[1.75] prose-p:text-[15px] prose-p:text-muted-foreground",
						"[&>p:first-of-type]:text-[15px] [&>p:first-of-type]:leading-[1.75] [&>p:first-of-type]:text-foreground/90",
						"prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
						"prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border/60 prose-h2:pb-3 prose-h2:text-xl prose-h2:leading-snug",
						"prose-ul:my-6 prose-ul:space-y-3 prose-li:my-0 prose-li:text-[15px] prose-li:leading-[1.75] prose-li:text-muted-foreground",
						"prose-a:font-medium prose-a:text-primary prose-a:no-underline prose-a:underline-offset-4 hover:prose-a:underline",
					)}
				>
					{children}
				</article>
			</div>
		</main>
	);
}

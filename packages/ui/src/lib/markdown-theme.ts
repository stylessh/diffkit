/**
 * Markdown typography + surfaces.
 *
 * Every class string the `Markdown` renderer uses lives here so a consumer (or a
 * later design pass) can retheme markdown in one place. Values use the Linear-derived
 * tokens from globals.css; keep the export names stable so overrides stay mechanical.
 */
import { cn } from "./utils";

export const markdownRootClassName = "not-prose break-words text-foreground";

export const markdownLinkClassName =
	"text-sm font-medium underline underline-offset-2 decoration-border hover:decoration-foreground transition-colors";

export const markdownHeadingClassNames = {
	h1: "text-2xl font-semibold tracking-tight mb-3 mt-5 first:mt-0",
	h2: "text-xl font-semibold tracking-tight mb-2 mt-4 first:mt-0",
	h3: "text-lg font-semibold tracking-tight mb-2 mt-3 first:mt-0",
	h4: "text-base font-semibold mb-1.5 mt-3 first:mt-0",
} as const;

export const markdownParagraphClassName =
	"text-sm leading-relaxed mb-2 last:mb-0";

export const markdownListClassNames = {
	ul: "text-sm list-disc pl-5 mb-2 flex flex-col gap-1.5",
	ol: "text-sm list-decimal pl-5 mb-2 flex flex-col gap-1.5",
	li: "text-sm leading-relaxed",
} as const;

export const markdownBlockquoteClassName =
	"border-l-2 border-chip-border pl-3 text-sm text-muted-foreground italic mb-2";

/**
 * GitHub alerts (`> [!NOTE]`) are styled by the `.markdown-alert*` rules in
 * globals.css; the renderer adds nothing on top of the generated classes.
 */
export const markdownAlertBlockquoteClassName = "";

/** Alert titles keep only the generated `markdown-alert-title` class (see globals.css). */
export const markdownAlertTitleClassName = "";

export const markdownInlineCodeClassName =
	"rounded-[4px] bg-inline-code px-1.5 py-0.5 text-xs font-mono shadow-chip";

export const markdownCodeBlockShellClassName =
	"group/code relative mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:shadow-chip";

export const markdownCodeBlockFallbackClassName =
	"overflow-x-auto rounded-lg bg-inline-code p-3 text-xs text-foreground shadow-chip";

export const markdownPreClassName = cn(
	markdownCodeBlockFallbackClassName,
	"mb-2",
);

export const markdownCopyButtonClassName =
	"absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-button text-muted-foreground opacity-0 shadow-button transition-all hover:bg-button-hover hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100";

export const markdownHrClassName = "my-4 border-rule";

export const markdownMediaClassName = "my-2 max-w-full rounded-lg";

export const markdownImageClassName = cn(
	"inline-block max-w-full rounded-lg my-2",
);

export const markdownTableShellClassName =
	"flex flex-col overflow-hidden mb-2 rounded-lg bg-card shadow-card";

export const markdownTableClassName = "w-full text-sm border-collapse";

export const markdownTheadClassName = "bg-surface-1";

export const markdownThClassName =
	"border-b-[0.5px] border-r-[0.5px] border-rule px-3 py-1.5 text-left text-xs font-medium text-muted-foreground last:border-r-0";

export const markdownTdClassName =
	"border-b-[0.5px] border-r-[0.5px] border-rule px-3 py-1.5 text-xs last:border-r-0 [tr:last-child_&]:border-b-0";

export const markdownTaskCheckboxClassName = "mr-1.5 rounded border-border";

export const markdownDetailsClassName =
	"group/details mb-2 text-sm [&>:not(summary)]:mt-2";

export const markdownSummaryClassName =
	"flex w-fit cursor-pointer select-none list-none items-center gap-1.5 rounded-full bg-button px-3 py-1 text-[13px] font-medium shadow-button hover:bg-button-hover [&::-webkit-details-marker]:hidden";

export const markdownSummaryChevronClassName =
	"size-3.5 shrink-0 text-muted-foreground transition-transform group-open/details:rotate-90";

export const markdownStrongClassName = "font-semibold";

export const markdownEmClassName = "italic";

export const markdownDelClassName = "text-muted-foreground line-through";

/**
 * Markdown typography + surfaces.
 *
 * Every class string the `Markdown` renderer uses lives here so a consumer (or a
 * later design pass) can retheme markdown in one place. Values use the Linear-derived
 * tokens from globals.css; keep the export names stable so overrides stay mechanical.
 */
import { cn } from "./utils";

// Sizes are relative (em) so the container sets the scale: 13px by default,
// 15px/24px on detail pages (Linear's document text).
export const markdownRootClassName =
	"not-prose break-words text-[13px] leading-[1.6] text-foreground";

export const markdownLinkClassName =
	"font-medium underline underline-offset-2 decoration-chip-border hover:decoration-foreground transition-[text-decoration-color]";

export const markdownHeadingClassNames = {
	h1: "text-[1.6em] leading-[1.33] font-semibold tracking-tight text-foreground mt-[1.1em] mb-[0.4em] first:mt-0",
	h2: "text-[1.133em] leading-[1.41] font-semibold text-foreground mt-[1.2em] mb-[0.35em] first:mt-0",
	h3: "text-[1em] font-semibold text-foreground mt-[1.1em] mb-[0.3em] first:mt-0",
	h4: "text-[1em] font-semibold text-foreground mt-[1em] mb-[0.25em] first:mt-0",
} as const;

export const markdownParagraphClassName = "mb-[0.6em] last:mb-0";

export const markdownListClassNames = {
	ul: "list-disc pl-[1.4em] mb-[0.6em] flex flex-col gap-[0.2em] marker:text-icon-faint",
	ol: "list-decimal pl-[1.4em] mb-[0.6em] flex flex-col gap-[0.2em] marker:text-muted-foreground",
	li: "",
} as const;

export const markdownBlockquoteClassName =
	"border-l-2 border-chip-border pl-[0.8em] text-muted-foreground mb-[0.6em]";

/**
 * GitHub alerts (`> [!NOTE]`) are styled by the `.markdown-alert*` rules in
 * globals.css; the renderer adds nothing on top of the generated classes.
 */
export const markdownAlertBlockquoteClassName = "";

/** Alert titles keep only the generated `markdown-alert-title` class (see globals.css). */
export const markdownAlertTitleClassName = "";

export const markdownInlineCodeClassName =
	"rounded-[4px] bg-inline-code px-[0.3em] py-[0.1em] text-[0.875em] font-mono shadow-chip";

export const markdownCodeBlockShellClassName =
	"group/code relative mb-[0.75em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:shadow-chip";

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

export const markdownTableClassName = "w-full text-[13px] border-collapse";

export const markdownTheadClassName = "bg-group";

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

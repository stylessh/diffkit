import { cn } from "@diffkit/ui/lib/utils";

export const MATRIX_SUFFIX_RE = /^(.*?)\s*\(([^)]+)\)\s*$/;

export const NODE_WIDTH = 300;
export const COLUMN_GAP = 90;
export const ROW_GAP = 20;
export const VARIANT_POPUP_GAP = 40;
export const STEP_LOG_WIDTH = 560;
export const STEP_LOG_HEIGHT = 400;
export const STEP_LOG_GAP = 60;

export const H_JOB_HEADER = 36;
export const H_STEP_ROW = 28;
export const H_STEP_FIRST_LAST_EXTRA = 4;
export const H_NO_STEPS = 32;
export const H_BORDER = 1;
export const H_MATRIX_STATS = 28;
export const H_MATRIX_OUTER_PAD = 12;
export const H_MATRIX_CARD_GAP = 6;
export const H_MATRIX_PILL = 34;

export const NODE_CARD_CLASS = cn(
	"flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm",
	"transition-colors hover:border-foreground/20",
);

export const NODE_HEADER_CLASS =
	"flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent";

export const NODE_HANDLE_CLASS = "!size-1 !border-0 !bg-transparent !opacity-0";

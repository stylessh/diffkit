import { highlightCode } from "@diffkit/ui/components/markdown";
import {
	type MouseEvent,
	memo,
	type ReactNode,
	Suspense,
	use,
	useCallback,
} from "react";
import type { LineRange } from "#/lib/code-browsing/line-range";

export const CODE_LINE_HEIGHT_PX = 20;
export const CODE_PADDING_Y_PX = 8;

/** Shiki on the main thread stalls the page past these sizes. */
const HIGHLIGHT_MAX_BYTES = 200_000;
const HIGHLIGHT_MAX_LINES = 5_000;

export function countLines(code: string) {
	let count = 1;
	for (let index = 0; index < code.length; index++) {
		if (code.charCodeAt(index) === 10) count++;
	}
	return count;
}

export function shouldHighlight(code: string, lineCount: number) {
	return code.length <= HIGHLIGHT_MAX_BYTES && lineCount <= HIGHLIGHT_MAX_LINES;
}

type CodeLinesProps = {
	code: string;
	lang: string;
	lineCount: number;
	selection: LineRange | null;
	onSelectLine: (line: number, extend: boolean) => void;
	gutter?: ReactNode;
};

export function CodeLines({
	code,
	lang,
	lineCount,
	selection,
	onSelectLine,
	gutter,
}: CodeLinesProps) {
	const highlight = shouldHighlight(code, lineCount);
	return (
		<div className="overflow-x-auto font-mono text-xs">
			<div className="relative flex min-w-fit">
				{gutter}
				<LineNumbers count={lineCount} onSelectLine={onSelectLine} />
				<div className="flex-1">
					{highlight ? (
						<Suspense fallback={<PlainCode code={code} />}>
							<HighlightedCode code={code} lang={lang} />
						</Suspense>
					) : (
						<PlainCode code={code} />
					)}
				</div>
				{selection ? <SelectionOverlay range={selection} /> : null}
			</div>
		</div>
	);
}

function SelectionOverlay({ range }: { range: LineRange }) {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 z-20 bg-row-selected shadow-[inset_2px_0_0_var(--color-indigo)]"
			style={{
				top: CODE_PADDING_Y_PX + (range.start - 1) * CODE_LINE_HEIGHT_PX,
				height: (range.end - range.start + 1) * CODE_LINE_HEIGHT_PX,
			}}
		/>
	);
}

const LineNumbers = memo(function LineNumbers({
	count,
	onSelectLine,
}: {
	count: number;
	onSelectLine: (line: number, extend: boolean) => void;
}) {
	const handleClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			const target = (event.target as HTMLElement).closest<HTMLElement>(
				"[data-line]",
			);
			if (!target) return;
			event.preventDefault();
			onSelectLine(Number(target.dataset.line), event.shiftKey);
		},
		[onSelectLine],
	);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: each line number is a focusable link; this delegates their clicks
		// biome-ignore lint/a11y/noStaticElementInteractions: delegated handler for the line links below
		<div
			onClick={handleClick}
			className="sticky left-0 z-10 flex shrink-0 flex-col items-end bg-surface-0 py-2 pr-3 pl-4 text-line-number tabular-nums select-none"
		>
			{Array.from({ length: count }, (_, index) => {
				const line = index + 1;
				return (
					<a
						key={line}
						id={`L${line}`}
						href={`#L${line}`}
						data-line={line}
						className="h-5 min-w-6 scroll-mt-24 text-right leading-5 hover:text-foreground"
					>
						{line}
					</a>
				);
			})}
		</div>
	);
});

const codeClassName =
	"[&_pre]:!bg-transparent [&_pre]:py-2 [&_pre]:pr-4 [&_pre]:pl-3 [&_pre]:leading-5 [&_code]:text-xs";

function PlainCode({ code }: { code: string }) {
	return (
		<pre className="py-2 pr-4 pl-3 leading-5 text-foreground">
			<code>{code}</code>
		</pre>
	);
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
	const html = use(highlightCode(code, lang));
	return (
		<div
			className={codeClassName}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes the source it highlights
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

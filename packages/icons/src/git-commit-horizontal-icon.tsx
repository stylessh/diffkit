import type { SVGProps } from "react";

/** Hugeicons' GitCommitHorizontal: a commit dot on a horizontal line. */
export function GitCommitHorizontalIcon(
  props: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
) {
  const { size = 24, width, height, strokeWidth = 1.5, ...rest } = props;
  return (
    <svg
      aria-hidden="true"
      color="currentColor"
      fill="none"
      height={height ?? size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M9 12H3M15 12H21" />
    </svg>
  );
}

import type { SVGProps } from "react";

/** A branch leaving its trunk: two commits on one line, the third joined by a curve. */
export function GitBranchIcon({
  size = 24,
  width,
  height,
  strokeWidth = 1.5,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
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
      <path d="M6 3.5v11" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M18 8.5c0 4.5-3 6.5-9.5 8" />
    </svg>
  );
}

import type { SVGProps } from "react";

/** Hugeicons' CodeSimple: two bare angle brackets. */
export function CodeSimpleIcon(
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
      <path d="M8 6L4.32038 9.17157C2.77346 10.5049 2 11.1716 2 12C2 12.8284 2.77346 13.4951 4.32038 14.8284L8 18" />
      <path d="M16 6L19.6796 9.17157C21.2265 10.5049 22 11.1716 22 12C22 12.8284 21.2265 13.4951 19.6796 14.8284L16 18" />
    </svg>
  );
}

import type { SVGProps } from "react";

/** Hugeicons' Search01, tagged so a lone search icon in a box can be centred on its lens (see globals.css). */
export function SearchIcon(
  props: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
) {
  const { size = 24, width, height, strokeWidth = 1.5, ...rest } = props;
  return (
    <svg
      aria-hidden="true"
      color="currentColor"
      data-icon="search"
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
      <path d="M17.5 17.5L22 22" />
      <path d="M20 11C20 6.029 15.971 2 11 2C6.029 2 2 6.029 2 11C2 15.971 6.029 20 11 20C15.971 20 20 15.971 20 11Z" />
    </svg>
  );
}

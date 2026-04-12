import type { SVGProps } from "react";

export function SeparatorHorizontalIcon(
  props: SVGProps<SVGSVGElement> & { size?: number }
) {
  const { size = 24, width, height, ...rest } = props;
  return (
    <svg
      aria-label="Separator horizontal"
      color="currentColor"
      fill="none"
      height={height ?? size}
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <line x1="3" x2="21" y1="12" y2="12" />
      <polyline points="8 8 12 4 16 8" />
      <polyline points="16 16 12 20 8 16" />
    </svg>
  );
}

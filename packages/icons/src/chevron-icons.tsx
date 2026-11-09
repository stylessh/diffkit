import type { SVGProps } from "react";

type ChevronProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/**
 * Chevrons with a sharp point (mitred join) instead of Hugeicons' rounded
 * tip, which reads soft at 12–16px. One shape, turned for each direction.
 */
function Chevron({
  turn,
  size = 24,
  width,
  height,
  strokeWidth = 1.5,
  ...rest
}: ChevronProps & { turn: 0 | 90 | 180 | 270 }) {
  return (
    <svg
      aria-hidden="true"
      color="currentColor"
      fill="none"
      height={height ?? size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="miter"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M9 6l6 6-6 6"
        transform={turn ? `rotate(${turn} 12 12)` : undefined}
      />
    </svg>
  );
}

export function ChevronRightIcon(props: ChevronProps) {
  return <Chevron turn={0} {...props} />;
}

export function ChevronDownIcon(props: ChevronProps) {
  return <Chevron turn={90} {...props} />;
}

export function ChevronLeftIcon(props: ChevronProps) {
  return <Chevron turn={180} {...props} />;
}

export function ChevronUpIcon(props: ChevronProps) {
  return <Chevron turn={270} {...props} />;
}

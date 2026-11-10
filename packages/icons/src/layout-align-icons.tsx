import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

const FRAME =
  "M11 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H11C7.22876 21 5.34315 21 4.17157 19.8284C3 18.6569 3 16.7712 3 13V11C3 7.22876 3 5.34315 4.17157 4.17157C5.34315 3 7.22876 3 11 3Z";

function LayoutAlignIcon({ bar, ...props }: IconProps & { bar: string }) {
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
      <path d={FRAME} />
      <path d={bar} />
    </svg>
  );
}

/** Hugeicons' LayoutAlignLeft: a panel docked at the left. */
export function LayoutAlignLeftIcon(props: IconProps) {
  return <LayoutAlignIcon bar="M8.00488 16.0049L8.00488 8.00488" {...props} />;
}

/** Hugeicons' LayoutAlignRight: a panel docked at the right. */
export function LayoutAlignRightIcon(props: IconProps) {
  return <LayoutAlignIcon bar="M16 8L16 16" {...props} />;
}

/** Hugeicons' LayoutAlignBottom: a panel rising from the bottom, i.e. a drawer. */
export function LayoutAlignBottomIcon(props: IconProps) {
  return <LayoutAlignIcon bar="M16 16H8" {...props} />;
}

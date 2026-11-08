import type { SVGProps } from "react";

export function CircleXIcon(
  props: SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
  }
) {
  const {
    size = 24,
    width,
    height,
    strokeWidth: _strokeWidth,
    className,
    ...rest
  } = props;
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={height ?? size}
      viewBox="0 0 16 16"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.03 4.97a.875.875 0 0 1 1.24 0L8 6.7l1.73-1.73a.875.875 0 1 1 1.24 1.24L9.24 8l1.73 1.73a.875.875 0 0 1-1.24 1.24L8 9.24l-1.73 1.73a.875.875 0 0 1-1.24-1.24L6.76 8 5.03 6.27a.875.875 0 0 1 0-1.3Z" />
    </svg>
  );
}

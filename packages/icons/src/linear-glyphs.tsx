import type { SVGProps } from "react";

type LinearGlyphProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number | string;
};

export function FilterLinesIcon({
  size = 16,
  strokeWidth: _strokeWidth,
  ...props
}: LinearGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 16 16"
      width={size}
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M14.25 3a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5h12.5ZM4 8a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 8Zm2.75 3.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function DisplayOptionsIcon({
  size = 16,
  strokeWidth: _strokeWidth,
  ...props
}: LinearGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 16 16"
      width={size}
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M7 2.5c1.12 0 2.066.736 2.385 1.75h5.365a.75.75 0 0 1 0 1.5H9.385A2.501 2.501 0 0 1 4.615 5.75H2.25a.75.75 0 0 1 0-1.5h2.365A2.501 2.501 0 0 1 7 2.5ZM7 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M10 13.5a2.501 2.501 0 0 1-2.385-1.75H2.25a.75.75 0 0 1 0-1.5h5.365a2.501 2.501 0 0 1 4.77 0h2.365a.75.75 0 0 1 0 1.5h-2.365A2.501 2.501 0 0 1 10 13.5Zm0-1.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

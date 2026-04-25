import type { SVGProps } from "react";

export function ActionsIcon(
  props: SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
  }
) {
  const { size = 24, width, height, strokeWidth = 1.5, ...rest } = props;
  const isDecorative =
    rest["aria-label"] == null && rest["aria-labelledby"] == null;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: consumer provides aria-label/aria-labelledby; otherwise marked aria-hidden (decorative)
    <svg
      aria-hidden={isDecorative || undefined}
      color="currentColor"
      fill="none"
      focusable="false"
      height={height ?? size}
      role={isDecorative ? undefined : "img"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M9.5 11.1998V12.8002C9.5 14.3195 9.5 15.0791 9.95576 15.3862C10.4115 15.6932 11.0348 15.3535 12.2815 14.6741L13.7497 13.8738C15.2499 13.0562 16 12.6474 16 12C16 11.3526 15.2499 10.9438 13.7497 10.1262L12.2815 9.32594C11.0348 8.6465 10.4115 8.30678 9.95576 8.61382C9.5 8.92086 9.5 9.6805 9.5 11.1998Z"
        fill="currentColor"
      />
    </svg>
  );
}

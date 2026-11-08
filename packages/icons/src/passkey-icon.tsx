import type { SVGProps } from "react";

export function PasskeyIcon(
  props: SVGProps<SVGSVGElement> & { size?: number }
) {
  const { size = 24, width, height, ...rest } = props;
  return (
    <svg
      aria-label="Passkey"
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
      <path d="M3 15L3.5 10C3.65302 8.46979 4.08703 7.1269 4.74469 6M20.5 18C21 14.5 21 12.5 21 11C21 6.02944 16.9706 2 12 2C10.5383 2 9.18213 2.31652 8 2.9153" />
      <path d="M6 20C6.30557 19.2361 6.56446 18.6122 6.77665 18M7.40695 15C7.46898 14.3064 7.5 13.4963 7.5 12.5C7.5 9 9.2386 7 12 7C14.7614 7 16.5 9 16.5 12C16.5 12.3276 16.494 12.6611 16.4815 13M14.5 22C15.2223 20.3147 15.7127 18.6295 16.0271 17" />
      <path d="M10 22C11 19.5 12 15 12 11" />
    </svg>
  );
}

import type { SVGProps } from "react";

/** Hugeicons' Tag01 outline, without its punched hole. */
export function TagIcon(
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
      <path d="M8 2H9.01472C10.241 2 10.8541 2 11.4054 2.22836C11.9567 2.45672 12.3903 2.89027 13.2574 3.75736L21.1262 11.6263C21.6841 12.1867 21.9982 12.9449 22 13.7357L22 13.75L22 13.7643C21.9982 14.5551 21.6841 15.3133 21.1262 15.8737L15.8737 21.1262C15.3133 21.6841 14.5551 21.9982 13.7643 22L13.75 22L13.7357 22C12.9449 21.9982 12.1867 21.6841 11.6263 21.1262L3.75736 13.2574C2.89027 12.3903 2.45672 11.9567 2.22836 11.4054C2 10.8541 2 10.241 2 9.01472V8C2 5.17157 2 3.75736 2.87868 2.87868C3.75736 2 5.17157 2 8 2Z" />
    </svg>
  );
}

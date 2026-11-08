import type { SVGProps } from "react";

export function WorkflowQueueIcon(
  props: SVGProps<SVGSVGElement> & {
    size?: number | string;
  }
) {
  const { size = 24, width, height, className, ...rest } = props;
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={height ?? size}
      viewBox="0 0 24 24"
      width={width ?? size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        clipRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm3 10.5a.75.75 0 0 0 0-1.5H9a.75.75 0 0 0 0 1.5h6Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

import { forwardRef, type SVGProps } from "react";

type Edit03IconProps = SVGProps<SVGSVGElement> & {
  size?: string | number;
};

export const Edit03Icon = forwardRef<SVGSVGElement, Edit03IconProps>(
  function Edit03IconComponent(
    { color = "currentColor", size = 24, strokeWidth = 1.5, ...props },
    ref
  ) {
    return (
      <svg
        aria-hidden="true"
        color={color}
        fill="none"
        height={size}
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M3.78181 16.3092L3 21L7.69086 20.2182C8.50544 20.0825 9.25725 19.6956 9.84119 19.1116L20.4198 8.53288C21.1934 7.75922 21.1934 6.5049 20.4197 5.73126L18.2687 3.58024C17.495 2.80658 16.2406 2.80659 15.4669 3.58027L4.88841 14.159C4.30447 14.7429 3.91757 15.4947 3.78181 16.3092Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M14 6L18 10"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }
);

import { CircleArrowDataTransferHorizontalIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type ChangesRequestIconProps = ComponentProps<
  typeof CircleArrowDataTransferHorizontalIcon
> & {
  strokeWidth?: number | string;
};

export function ChangesRequestIcon({
  strokeWidth: _strokeWidth,
  ...props
}: ChangesRequestIconProps) {
  return <CircleArrowDataTransferHorizontalIcon {...props} />;
}

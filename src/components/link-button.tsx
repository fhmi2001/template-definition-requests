import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClass, cx, type ButtonSize, type ButtonVariant } from "./button-styles";

/** رابط بشكل زر. */
export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

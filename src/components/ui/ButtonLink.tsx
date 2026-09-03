import type { AnchorHTMLAttributes } from "react";
import {
  buttonBaseClasses,
  buttonVariantClasses,
  type ButtonVariant,
} from "./Button";

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
}

// A plain anchor styled exactly like Button — for external hrefs such as
// signed storage URLs, where next/link buys nothing.
export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={`${buttonBaseClasses} ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    />
  );
}

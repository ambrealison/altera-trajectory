import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "next" | "ghost";

export function PillButton({ variant = "primary", small, children, className = "", ...rest }: { variant?: Variant; small?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`pill pill-${variant} ${small ? "pill-sm" : ""} ${className}`} {...rest}>
      {children}
    </button>
  );
}

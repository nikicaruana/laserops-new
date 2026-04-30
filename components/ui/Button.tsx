import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = BaseProps &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
    type?: never;
  };

type ButtonAsButton = BaseProps &
  Omit<ComponentProps<"button">, "className" | "children"> & {
    href?: never;
  };

type ButtonProps = ButtonAsLink | ButtonAsButton;

const baseStyles = cn(
  "inline-flex items-center justify-center gap-2",
  "font-semibold uppercase tracking-[0.12em]",
  "transition-all duration-200 ease-[var(--ease-out-tactical)]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "disabled:pointer-events-none disabled:opacity-50",
  // Sharp corners + slight skew on press for tactile feel
  "rounded-none active:scale-[0.98]",
);

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-sm",
};

const variantStyles: Record<Variant, string> = {
  // PRIMARY — solid yellow, the "book now" CTA. Hover shifts to dimmed yellow.
  primary: cn(
    "bg-accent text-bg",
    "hover:bg-accent-soft",
    "shadow-[0_0_0_1px_var(--color-accent)]",
  ),
  // SECONDARY — outlined, used alongside primary CTAs without competing
  secondary: cn(
    "border border-border-strong bg-transparent text-text",
    "hover:border-accent hover:text-accent",
  ),
  // GHOST — minimal, for tertiary actions and inline links
  ghost: cn("bg-transparent text-text-muted", "hover:text-accent"),
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(baseStyles, sizeStyles[size], variantStyles[variant], className);

  if ("href" in props && props.href) {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}

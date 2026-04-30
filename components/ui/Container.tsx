import { cn } from "@/lib/cn";
import type { ElementType, HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** "default" = max 1280px, "narrow" = max 960px (for prose), "wide" = max 1440px */
  size?: "default" | "narrow" | "wide";
};

const sizeMap = {
  narrow: "max-w-[60rem]",
  default: "max-w-[80rem]",
  wide: "max-w-[90rem]",
};

export function Container({
  as: Component = "div",
  size = "default",
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Component
      className={cn("mx-auto w-full px-5 sm:px-8 lg:px-12", sizeMap[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
}

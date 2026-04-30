import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <div className="flex items-center gap-3">
          <span className="hud-rule w-8 sm:w-12" aria-hidden />
          <span className="eyebrow">{eyebrow}</span>
        </div>
      )}
      <h2 className="text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">{title}</h2>
      {description && (
        <p className="max-w-2xl text-base text-text-muted sm:text-lg">{description}</p>
      )}
    </header>
  );
}

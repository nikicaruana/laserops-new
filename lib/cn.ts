import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with clsx, then resolves Tailwind conflicts with twMerge.
 * Use this everywhere instead of template literals for class composition.
 *
 * @example
 * cn("text-text", isActive && "text-accent", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

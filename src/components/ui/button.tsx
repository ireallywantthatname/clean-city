import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none",
          variant === "default" && "bg-foreground text-background px-4 py-2",
          variant === "outline" && "border border-border bg-transparent px-4 py-2 hover:bg-secondary",
          variant === "ghost" && "bg-transparent px-4 py-2 hover:bg-secondary",
          size === "sm" && "px-3 py-1 text-xs",
          size === "lg" && "px-6 py-3 text-base",
          size === "icon" && "p-2",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };

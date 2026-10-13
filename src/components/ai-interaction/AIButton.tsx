import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons/ThemaIcon";
import { ClipperOrb } from "./ClipperOrb";
import "./aiButton.css";
import type { AIButtonProps } from "./aiInteractionTypes";

export function AIButton({
  label,
  children,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  helperText,
  onClick,
  type = "button",
  className,
}: AIButtonProps) {
  // Mapping AI variants to base Button variants
  const variantMap: Record<string, "default" | "secondary" | "ghost" | "outline"> = {
    primary: "default",
    secondary: "outline",
    subtle: "ghost",
    outline: "outline",
  };

  // Mapping AI sizes to base Button sizes
  const sizeMap: Record<string, "default" | "sm" | "lg"> = {
    xs: "sm",
    sm: "sm",
    md: "default",
    lg: "lg",
  };

  const isPrimary = variant === "primary";
  const isOutline = variant === "secondary" || variant === "outline";
  // En los de contorno, el icono también lleva el gradiente de IA: un SVG no toma `background-clip: text`,
  // así que su trazo apunta a un degradado definido aquí.
  const gradientId = `ai-btn-${React.useId().replace(/:/g, "")}`;
  // Solo a los iconos (hijos directos): el orbe tiene su propio dibujo y con ese trazo encima se veía roto.
  const iconGradient = isOutline && !disabled ? "[&>svg_*]:[stroke:var(--ai-icon-gradient)]" : undefined;

  const orbSize = size === "xs" ? 14 : size === "lg" ? 24 : 20;

  return (
    <div className={cn("inline-flex flex-col gap-1.5", className)}>
      <Button
        type={type}
        variant={variantMap[variant]}
        size={sizeMap[size]}
        disabled={disabled || loading}
        onClick={onClick}
        aria-busy={loading}
        className={cn(
          "relative overflow-hidden transition-all duration-300 font-bold rounded-full",
          // El principal es el poste de Clipper: el gradiente de IA con franjas que suben, como su orbe.
          isPrimary && !disabled && "ai-pole-button border-transparent shadow-ai-premium hover:brightness-105 active:scale-95",
          // El filo con el gradiente de IA dando la vuelta despacio (quieto con «reducir movimiento»).
          isOutline && !disabled && "ai-border-flow hover:opacity-80 active:scale-95",
          size === "xs" && "h-7 px-3 text-[10px] gap-1",
          size === "sm" && "h-8 px-4 text-xs gap-1.5",
          size === "md" && "h-10 px-6 text-sm gap-2",
          size === "lg" && "h-12 px-8 text-base gap-2.5"
        )}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{label || children || "Generando..."}</span>
          </div>
        ) : (
          <div className={cn("flex items-center gap-2", iconGradient)} style={isOutline ? ({ "--ai-icon-gradient": `url(#${gradientId})` } as React.CSSProperties) : undefined}>
            {isOutline && (
              <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" style={{ stopColor: "var(--color-ai-stop-1)" }} />
                    <stop offset="38%" style={{ stopColor: "var(--color-ai-stop-2)" }} />
                    <stop offset="72%" style={{ stopColor: "var(--color-ai-stop-3)" }} />
                    <stop offset="100%" style={{ stopColor: "var(--color-ai-stop-5)" }} />
                  </linearGradient>
                </defs>
              </svg>
            )}
            {leftIcon && (
              <ThemaIcon 
                name={leftIcon} 
                size={size === "xs" ? "xs" : "sm"} 
                tone="default"
                className={cn(isPrimary ? "text-current" : "text-ai-gradient")} 
              />
            )}
            {/* El principal ya es el poste de Clipper: no lleva orbe. */}
            {!leftIcon && !isPrimary && <ClipperOrb bare size={orbSize} className="shrink-0" />}
            <span className={cn(isPrimary && "relative font-extrabold", isOutline && !disabled && "text-ai-gradient")}>{label || children}</span>
            {rightIcon && (
              <ThemaIcon 
                name={rightIcon} 
                size={size === "xs" ? "xs" : "sm"} 
                tone="default"
                className={cn(isPrimary ? "text-current" : "text-ai-gradient")} 
              />
            )}
          </div>
        )}
      </Button>
      {helperText && (
        <p className="px-1 text-[11px] text-muted-foreground opacity-80 italic">
          {helperText}
        </p>
      )}
    </div>
  );
}

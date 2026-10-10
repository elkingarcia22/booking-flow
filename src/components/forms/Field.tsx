import * as React from "react"
import { cn } from "@/lib/utils"

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  description?: string
  error?: string
  required?: boolean
  disabled?: boolean
  children: React.ReactNode
}

export function Field({
  label,
  description,
  error,
  required,
  disabled,
  className,
  children,
  ...props
}: FieldProps) {
  const id = React.useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <div className={cn("space-y-1.5 w-full", className)} {...props}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-bold text-text-primary leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              disabled && "opacity-70 cursor-not-allowed"
            )}
          >
            {label}
            {required && (
              <span className="text-status-negative ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        </div>
      )}
      
      <div className="relative">
        {/* We inject the id into the child if it's a valid element and doesn't have one */}
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              id: (child.props as any).id || id,
              disabled: (child.props as any).disabled || disabled,
              // Con error, el control se pinta en su estado de error (borde y anillo destructivos).
              "aria-invalid": error ? true : (child.props as any)["aria-invalid"],
              "aria-describedby": cn(
                (child.props as any)["aria-describedby"],
                description && descriptionId,
                error && errorId
              ) || undefined,
            })
          }
          return child
        })}
      </div>

      {description && !error && (
        <p
          id={descriptionId}
          className="text-[13px] text-text-secondary leading-relaxed"
        >
          {description}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-[13px] font-medium text-status-negative animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export function FieldLabel({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-bold text-text-primary", className)} {...props}>
      {children}
    </label>
  )
}

export function FieldDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[13px] text-text-secondary", className)} {...props}>
      {children}
    </p>
  )
}

export function FieldError({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[13px] font-medium text-status-negative", className)} {...props}>
      {children}
    </p>
  )
}

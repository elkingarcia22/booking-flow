import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[120px] w-full rounded-md border border-input bg-surface dark:bg-muted px-3.5 py-3 text-[13px] text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20 aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

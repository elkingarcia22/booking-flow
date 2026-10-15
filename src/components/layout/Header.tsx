import * as React from "react"
import { Bell, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Breadcrumbs } from "@/components/navigation"

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  description?: string
  breadcrumbs?: string[]
}

const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ className, title, description, breadcrumbs = [], ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "flex h-20 w-full items-center justify-between border-b border-border/60 bg-surface px-8 shrink-0",
          className
        )}
        {...props}
      >
        <div className="flex flex-col">
          {/* Breadcrumb Area */}
          {breadcrumbs.length > 0 && (
            <Breadcrumbs items={breadcrumbs} className="mb-1" />
          )}
          
          {/* Title Area */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold text-foreground leading-tight tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-text-muted">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right Actions Slot Mockup */}
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary" />
            <div className="h-10 w-64 rounded-xl border border-input bg-surface-muted pl-10 pr-4 text-sm text-text-muted flex items-center transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
              Buscar en Thema...
            </div>
          </div>
          <button className="relative h-10 w-10 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-all duration-200">
            <Bell size={20} className="text-text-secondary" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-status-negative border-2 border-card" />
          </button>
        </div>
      </header>
    )
  }
)
Header.displayName = "Header"

export { Header }

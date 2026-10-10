import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { SelectionOption } from './selectionTypes'

export interface OptionTileProps {
  /** The option data to display */
  option: SelectionOption
  /** Whether the tile is currently selected */
  selected?: boolean
  /** Whether the tile is disabled */
  disabled?: boolean
  /** Callback when the tile is clicked */
  onSelect?: (value: string) => void
  /** Whether to use a more compact layout */
  compact?: boolean
  /**
   * `row` (default): icono, texto y radio en una fila. `stacked`: icono arriba, el nombre
   * debajo (hasta dos líneas) y el radio en la esquina, para poner pocas opciones lado a lado.
   */
  layout?: 'row' | 'stacked'
  /** Additional CSS classes */
  className?: string
}

/**
 * OptionTile - A compact selectable tile for dense lists of options.
 */
export function OptionTile({
  option,
  selected = false,
  disabled = false,
  onSelect,
  compact = false,
  layout = 'row',
  className,
}: OptionTileProps) {
  const Icon = option.icon
  const isDisabled = disabled || option.disabled
  const isStacked = layout === 'stacked'

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onSelect?.(option.value)}
      className={cn(
        'group flex items-center gap-3 w-full p-3 rounded-xl border text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        selected 
          ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/25' 
          : 'border-border/60 bg-surface hover:border-primary/30',
        isDisabled && 'opacity-50 grayscale-[0.5] cursor-not-allowed hover:border-border/60',
        compact && 'p-2 gap-2',
        isStacked && 'relative h-full flex-col items-start gap-2.5 p-3',
        className
      )}
      aria-checked={selected}
    >
      {Icon && (
        <div className={cn(
          'shrink-0 p-2 rounded-lg border transition-colors',
          selected 
            ? 'bg-primary text-primary-foreground border-primary' 
            : 'bg-muted/40 text-muted-foreground border-border/60 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20',
          compact && 'p-1.5'
        )}>
          <Icon className={cn('h-4 w-4', compact && 'h-3.5 w-3.5')} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-bold transition-colors',
            isStacked ? 'line-clamp-2 leading-snug' : 'truncate',
            selected ? 'text-primary' : 'text-foreground'
          )}>
            {option.label}
          </span>
          {option.badge && (
            <Badge variant={selected ? "default" : "outline"} className="text-[10px] h-3.5 px-1 font-bold  tracking-tighter">
              {option.badge}
            </Badge>
          )}
        </div>
        {!compact && option.description && (
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
            {option.description}
          </p>
        )}
      </div>

      <div className={cn(
        'shrink-0 flex items-center justify-center h-4 w-4 rounded-full border-2 transition-all',
        isStacked && 'absolute right-3 top-3',
        selected 
          ? 'bg-primary border-primary' 
          : 'bg-transparent border-muted-foreground/30 group-hover:border-primary/50'
      )}>
        {selected && (
          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
      </div>
    </button>
  )
}

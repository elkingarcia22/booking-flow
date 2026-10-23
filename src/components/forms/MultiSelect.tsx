import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { matchesSearchText } from "@/lib/search/personSearch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type MultiSelectOption = {
  value: string
  label: string
  description?: string
  /** Avatar o miniatura a la izquierda de la opción. */
  leading?: React.ReactNode
  /** Un dato corto a la derecha (cuántas hay, por ejemplo). */
  meta?: React.ReactNode
  disabled?: boolean
}

export type MultiSelectProps = {
  options: MultiSelectOption[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** El nombre del control cuando no va dentro de un `Field` con etiqueta. */
  ariaLabel?: string
  /** Para pruebas y para enlazarlo con su etiqueta. */
  id?: string
  "data-testid"?: string
}

export function MultiSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Seleccionar opciones",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
  className,
  ariaLabel,
  id,
  "data-testid": testId,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const handleUnselect = (optionValue: string) => {
    onValueChange?.(value.filter((val) => val !== optionValue))
  }

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      handleUnselect(optionValue)
    } else {
      onValueChange?.([...value, optionValue])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid={testId}
          disabled={disabled}
          className={cn(
            "flex h-auto min-h-10 w-full items-center justify-between rounded-md border border-border/70 bg-muted px-5 py-3 text-sm text-foreground font-medium transition-all hover:bg-muted/60 focus:ring-2 focus:ring-primary/20",
            className
          )}
        >
          <div className="flex flex-wrap gap-1.5">
            {value.length > 0 ? (
              value.map((val) => {
                const option = options.find((o) => o.value === val)
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="flex items-center gap-1.5 pr-1 pl-2.5 h-7 border-none bg-surface text-primary text-[11px] font-bold rounded-lg shadow-card"
                  >
                    {option?.label}
                    <div
                      role="button"
                      tabIndex={0}
                      className="ml-0.5 rounded-full outline-none hover:bg-primary/10 p-0.5 transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleUnselect(val)
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnselect(val)
                      }}
                    >
                      <X className="h-3 w-3 text-primary" />
                    </div>
                  </Badge>
                )
              })
            ) : (
              <span className="text-foreground/60 font-medium">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 text-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border border-border/60 shadow-drawer bg-surface mt-1 overflow-hidden">
        {/* El buscador filtra con la regla de todos (antes la caja no estaba conectada y no filtraba). */}
        <Command className="bg-transparent" shouldFilter={false}>
          <div className="px-2 py-2 border-b border-border/60">
            <Input 
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder} 
              className="h-9 rounded-lg bg-surface-muted px-3 text-sm border-0 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <CommandList className="max-h-[280px] overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.filter((option) => matchesSearchText(`${option.label} ${option.description ?? ""}`, search)).map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  onSelect={() => handleSelect(option.value)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer [&>svg:last-child]:hidden data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary transition-all mb-0.5 hover:bg-surface-subtle"
                >
                  {/* El check propio de CommandItem se oculta (último svg): aquí la marca va en su círculo. */}
                  {option.leading}
                  {/* El nombre y, debajo, su descripción: en columna para que la fila no se parta. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-bold tracking-tight leading-tight">{option.label}</span>
                    {option.description && <span className="text-[11px] text-muted-foreground leading-tight font-medium">{option.description}</span>}
                  </span>
                  {option.meta !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{option.meta}</span>}
                  {/* El hueco de la marca está siempre: así todas las filas miden lo mismo. */}
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", value.includes(option.value) && "bg-primary/10")}>
                    {value.includes(option.value) && <Check className="h-3 w-3 text-primary" />}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}


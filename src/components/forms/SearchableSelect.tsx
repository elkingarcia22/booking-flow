import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { matchesSearchText } from "@/lib/search/personSearch"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
  /** Avatar o miniatura a la izquierda (también en el botón, con la opción elegida). */
  leading?: React.ReactNode
  /** Más texto por el que se encuentra la opción sin mostrarlo (el correo o el celular de una persona). */
  keywords?: string
  disabled?: boolean
}

export type SearchableSelectProps = {
  options: SearchableSelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  /** Abre la lista al aparecer (cuando se pide sumar algo y lo siguiente es elegirlo). */
  defaultOpen?: boolean
  /** Avisa al abrirse y al cerrarse (también al elegir). */
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
  defaultOpen = false,
  onOpenChange,
  className,
}: SearchableSelectProps) {
  const [open, setOpenState] = React.useState(defaultOpen)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const selected = value ? options.find((option) => option.value === value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal rounded-md border-input bg-surface dark:bg-muted px-4 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.leading}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border shadow-drawer">
        {/* La regla de todos los buscadores: todas las palabras, sin tildes, y un celular escrito como sea. */}
        <Command filter={(_value, search, keywords) => (matchesSearchText((keywords ?? []).join(" "), search) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? "", option.keywords ?? ""]}
                  disabled={option.disabled}
                  onSelect={() => {
                    onValueChange?.(option.value)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2.5"
                >
                  {option.leading}
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <div className="flex items-center w-full">
                      <span className="flex-1 text-sm">{option.label}</span>
                      {value === option.value && (
                        <Check className={cn("ml-2 h-4 w-4")} />
                      )}
                    </div>
                    {option.description && (
                      <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

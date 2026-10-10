import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  findCountry,
  formatNational,
  parseE164,
  type Country,
  type CountryCode,
} from "./phoneCountries"

/**
 * Teléfono con prefijo de país.
 *
 * Hacia dentro se escribe en grupos («300 123 4567»); hacia fuera siempre sale
 * E.164 («+573001234567»), que es lo que guarda el backend. El selector de país
 * es el `Select` del sistema y no el `SearchableSelect`: son veinte países, el
 * buscador de cmdk filtra por `value` (el ISO, no el nombre) y el trigger de
 * `SearchableSelect` ocupa el ancho completo. El Select ya trae typeahead.
 */

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "prefix"> {
  /** Valor controlado en E.164, p. ej. «+573001234567». */
  value?: string
  /** Se llama con el número en E.164; cadena vacía si no hay dígitos. */
  onValueChange?: (value: string) => void
  /** País preseleccionado cuando no hay valor. */
  defaultCountry?: CountryCode
  /** Lista de países a ofrecer; por defecto LATAM + ES + US. */
  countries?: readonly Country[]
  placeholder?: string
}

export function PhoneInput({
  value,
  onValueChange,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  countries = PHONE_COUNTRIES,
  disabled,
  placeholder,
  className,
  id,
  ...props
}: PhoneInputProps) {
  const isControlled = value !== undefined
  const [countryCode, setCountryCode] = React.useState<CountryCode>(defaultCountry)
  const [uncontrolledDigits, setUncontrolledDigits] = React.useState("")

  const parsed = isControlled ? parseE164(value, countries, countryCode) : undefined
  const country = findCountry(parsed?.country?.code ?? countryCode, countries)
  const digits = (isControlled ? (parsed?.national ?? "") : uncontrolledDigits).slice(0, country.length)

  const emit = (nextCountry: Country, nextDigits: string) => {
    setCountryCode(nextCountry.code)
    if (!isControlled) setUncontrolledDigits(nextDigits)
    onValueChange?.(nextDigits ? `${nextCountry.dialCode}${nextDigits}` : "")
  }

  const handleCountryChange = (code: string) => {
    const next = findCountry(code as CountryCode, countries)
    emit(next, digits.slice(0, next.length))
  }

  const handleDigitsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    emit(country, event.target.value.replace(/\D/g, "").slice(0, country.length))
  }

  return (
    <div data-slot="phone-input" className={cn("flex w-full items-center gap-2", className)}>
      <Select value={country.code} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger aria-label="Prefijo de país" className="w-[112px] shrink-0">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">{country.flag}</span>
            <span className="tabular-nums">{country.dialCode}</span>
          </span>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {countries.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{option.flag}</span>
                <span>{option.name}</span>
                <span className="text-text-muted tabular-nums">{option.dialCode}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        {...props}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={formatNational(digits, country.groups)}
        onChange={handleDigitsChange}
        placeholder={placeholder ?? formatNational("0".repeat(country.length), country.groups)}
        className={cn(
          "h-10 w-full min-w-0 flex-1 rounded-md border border-input bg-surface px-3.5 text-sm text-text-primary tabular-nums transition-all dark:bg-muted",
          "placeholder:text-text-muted",
          "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20 aria-[invalid=true]:focus-visible:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30"
        )}
      />
    </div>
  )
}

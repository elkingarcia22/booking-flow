import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Código de un solo uso, una celda por dígito.
 *
 * Se eligió un input real por celda en lugar de un input oculto con celdas
 * pintadas: el autorrelleno del sistema encuentra el campo, cada celda tiene su
 * propio foco visible y no hay que simular cursores. El valor es siempre una
 * cadena compacta (sin huecos), así que borrar en medio desplaza el resto.
 */

export type InputOtpType = "numeric" | "alphanumeric"

export interface InputOtpProps {
  /** Número de celdas. */
  length?: number
  /** Valor controlado. */
  value?: string
  onChange?: (value: string) => void
  /** Se dispara cuando se completan todas las celdas. */
  onComplete?: (value: string) => void
  /** Oculta los caracteres, como una contraseña. */
  mask?: boolean
  /** Separadores visuales, p. ej. `[3, 3]` para «123 — 456». */
  groups?: number[]
  disabled?: boolean
  autoFocus?: boolean
  type?: InputOtpType
  id?: string
  className?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

const INVALID_CHARS: Record<InputOtpType, RegExp> = {
  numeric: /[^0-9]/g,
  alphanumeric: /[^a-zA-Z0-9]/g,
}

/** Deja solo los caracteres válidos para el tipo; el alfanumérico va en mayúsculas. */
function sanitize(raw: string, type: InputOtpType): string {
  const cleaned = raw.replace(INVALID_CHARS[type], "")
  return type === "alphanumeric" ? cleaned.toUpperCase() : cleaned
}

/** Índices tras los que va un separador, según `groups`. */
function separatorsAfter(groups: number[] | undefined, length: number): ReadonlySet<number> {
  const result = new Set<number>()
  if (!groups?.length) return result
  let cursor = 0
  for (const group of groups.slice(0, -1)) {
    cursor += group
    if (cursor > 0 && cursor < length) result.add(cursor - 1)
  }
  return result
}

export function InputOtp({
  length = 6,
  value,
  onChange,
  onComplete,
  mask = false,
  groups,
  disabled,
  autoFocus,
  type = "numeric",
  id,
  className,
  "aria-label": ariaLabel = "Código de verificación",
  "aria-describedby": ariaDescribedBy,
}: InputOtpProps) {
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = React.useState("")
  const current = sanitize(isControlled ? value : uncontrolled, type).slice(0, length)

  const cellRefs = React.useRef<(HTMLInputElement | null)[]>([])
  const separators = separatorsAfter(groups, length)

  // El foco inicial, sin desplazar: dentro de una hoja que aún sube desde abajo, `autoFocus` hacía que
  // el navegador moviera la pantalla de atrás para «mostrar» la casilla.
  React.useEffect(() => {
    if (autoFocus) cellRefs.current[0]?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

  const focusCell = (index: number) => {
    const target = cellRefs.current[Math.min(Math.max(index, 0), length - 1)]
    target?.focus()
    target?.select()
  }

  const update = (next: string) => {
    const sanitized = sanitize(next, type).slice(0, length)
    if (!isControlled) setUncontrolled(sanitized)
    onChange?.(sanitized)
    if (sanitized.length === length) onComplete?.(sanitized)
  }

  /** Escribe `chars` desde `index` (sin dejar huecos) y devuelve el nuevo código. */
  const writeAt = (index: number, chars: string): string => {
    const cells = current.split("")
    const start = Math.min(index, cells.length)
    for (let offset = 0; offset < chars.length && start + offset < length; offset += 1) {
      cells[start + offset] = chars[offset]
    }
    return cells.join("").slice(0, length)
  }

  const removeAt = (index: number): string => current.slice(0, index) + current.slice(index + 1)

  const handleChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = sanitize(event.target.value, type)
    if (!typed) return
    update(writeAt(index, typed))
    focusCell(Math.min(index, current.length) + typed.length)
  }

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      update(current[index] ? removeAt(index) : removeAt(index - 1))
      focusCell(index - 1)
      return
    }
    if (event.key === "Delete") {
      event.preventDefault()
      update(removeAt(index))
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusCell(index - 1)
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      focusCell(index + 1)
    }
  }

  const handlePaste = (index: number) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = sanitize(event.clipboardData.getData("text"), type)
    if (!pasted) return
    // Pegar el código completo lo reparte desde la primera celda aunque el foco
    // esté en otra: es lo que espera quien copia el SMS entero.
    const start = pasted.length >= length ? 0 : index
    update(writeAt(start, pasted))
    focusCell(start + pasted.length)
  }

  return (
    <div
      data-slot="input-otp"
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn("flex items-center gap-2", disabled && "opacity-50", className)}
    >
      {Array.from({ length }, (_, index) => (
        <React.Fragment key={index}>
          <input
            ref={(node) => {
              cellRefs.current[index] = node
            }}
            id={index === 0 ? id : undefined}
            type={mask ? "password" : "text"}
            inputMode={type === "numeric" ? "numeric" : "text"}
            autoComplete="one-time-code"
            disabled={disabled}
            maxLength={1}
            value={current[index] ?? ""}
            aria-label={`Carácter ${index + 1} de ${length}`}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(
              "h-11 w-10 rounded-md border border-input bg-surface text-center text-base font-medium text-text-primary transition-all dark:bg-muted",
              "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed"
            )}
          />
          {separators.has(index) ? <span aria-hidden="true" className="h-px w-2 shrink-0 bg-border" /> : null}
        </React.Fragment>
      ))}
    </div>
  )
}

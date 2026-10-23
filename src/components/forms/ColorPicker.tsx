import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/**
 * Elegir un color dentro del espectro: un área de saturación y brillo, una barra de
 * matiz y el HEX escrito, más una fila opcional de muestras sugeridas (p. ej. los
 * colores de un logo). Se maneja con ratón, dedo o teclado (flechas; con Mayús, de 10
 * en 10). Trabaja en HSV por dentro, porque es como se mueve el puntero: a lo ancho
 * la saturación, a lo alto el brillo; afuera solo entra y sale HEX `#RRGGBB`.
 */

export interface ColorPickerSwatch {
  /** HEX `#RRGGBB`. */
  color: string
  /** Nombre accesible; por defecto, el HEX. */
  label?: string
}

export interface ColorPickerProps {
  /** Color actual en HEX `#RRGGBB`. */
  value: string
  /** Se llama con el HEX en mayúsculas mientras se arrastra, se teclea o se elige una muestra. */
  onChange: (color: string) => void
  /** Nombre accesible del selector, p. ej. «Color primario». */
  label?: string
  /** Muestras sugeridas encima del espectro. */
  swatches?: readonly ColorPickerSwatch[]
  /** Título de la fila de muestras. */
  swatchesLabel?: string
  className?: string
}

interface Hsv {
  /** 0–360 */
  h: number
  /** 0–100 */
  s: number
  /** 0–100 */
  v: number
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function normalizeHex(input: string): string | null {
  const match = input.trim().match(HEX)
  if (!match) return null
  const body = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1]
  return `#${body.toUpperCase()}`
}

function hexToHsv(hex: string): Hsv {
  const value = normalizeHex(hex) ?? "#000000"
  const int = Number.parseInt(value.slice(1), 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

function hsvToHex({ h, s, v }: Hsv): string {
  const sat = s / 100
  const val = v / 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))
  }
  const part = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, "0")
  return `#${part(5)}${part(3)}${part(1)}`.toUpperCase()
}

/** Arrastre con puntero: devuelve la posición relativa (0–1) dentro del elemento en cada movimiento. */
function usePointerDrag(onMove: (x: number, y: number) => void) {
  const ref = React.useRef<HTMLDivElement>(null)
  const move = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      onMove(clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp((event.clientY - rect.top) / rect.height, 0, 1))
    },
    [onMove]
  )
  return {
    ref,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.focus()
      move(event)
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event)
    },
  }
}

const THUMB =
  "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.4)]"
const FOCUSABLE = "outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

export function ColorPicker({ value, onChange, label = "Color", swatches, swatchesLabel = "Sugeridos", className }: ColorPickerProps) {
  // El matiz se guarda aparte: en un gris o en el negro el HEX no lo conserva, y la
  // barra saltaría al rojo en cuanto la saturación o el brillo tocaran cero.
  const [hsv, setHsv] = React.useState<Hsv>(() => hexToHsv(value))
  const [draft, setDraft] = React.useState(value.toUpperCase())
  const lastEmitted = React.useRef(value.toUpperCase())

  // Un `value` nuevo que no salió de aquí (otra muestra, otro campo) manda.
  React.useEffect(() => {
    const incoming = normalizeHex(value)
    if (!incoming || incoming === lastEmitted.current) return
    lastEmitted.current = incoming
    setHsv(hexToHsv(incoming))
    setDraft(incoming)
  }, [value])

  const commit = React.useCallback(
    (next: Hsv) => {
      setHsv(next)
      const hex = hsvToHex(next)
      setDraft(hex)
      if (hex !== lastEmitted.current) {
        lastEmitted.current = hex
        onChange(hex)
      }
    },
    [onChange]
  )

  const area = usePointerDrag(React.useCallback((x, y) => commit({ h: hsv.h, s: x * 100, v: (1 - y) * 100 }), [commit, hsv.h]))
  const hueBar = usePointerDrag(React.useCallback((x) => commit({ ...hsv, h: Math.min(x * 360, 359.9) }), [commit, hsv]))

  const onAreaKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key]
    if (!delta) return
    event.preventDefault()
    commit({ h: hsv.h, s: clamp(hsv.s + delta[0], 0, 100), v: clamp(hsv.v + delta[1], 0, 100) })
  }

  const onHueKey = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1
    const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    commit({ ...hsv, h: (hsv.h + delta + 360) % 360 })
  }

  const applyDraft = () => {
    const hex = normalizeHex(draft)
    if (!hex) {
      setDraft(hsvToHex(hsv))
      return
    }
    lastEmitted.current = hex
    setHsv(hexToHsv(hex))
    setDraft(hex)
    if (hex !== value.toUpperCase()) onChange(hex)
  }

  const current = hsvToHex(hsv)
  const draftInvalid = normalizeHex(draft) === null

  return (
    <div className={cn("space-y-3", className)}>
      {swatches && swatches.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">{swatchesLabel}</p>
          <div role="group" aria-label={swatchesLabel} className="flex flex-wrap gap-1.5">
            {swatches.map((swatch) => {
              const active = normalizeHex(swatch.color) === current
              return (
                <button
                  key={swatch.color}
                  type="button"
                  aria-label={swatch.label ?? swatch.color}
                  aria-pressed={active}
                  onClick={() => {
                    const hex = normalizeHex(swatch.color)
                    if (hex) commit(hexToHsv(hex))
                  }}
                  className={cn(
                    "size-7 rounded-md ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 dark:ring-white/15",
                    FOCUSABLE,
                    active && "ring-2 ring-primary ring-offset-2 ring-offset-surface"
                  )}
                  style={{ backgroundColor: swatch.color }}
                />
              )
            })}
          </div>
        </div>
      )}

      <div
        {...area}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturación y brillo`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={`Saturación ${Math.round(hsv.s)} %, brillo ${Math.round(hsv.v)} %`}
        onKeyDown={onAreaKey}
        className={cn("relative h-32 w-full cursor-crosshair touch-none rounded-lg", FOCUSABLE)}
        style={{
          backgroundColor: `hsl(${hsv.h} 100% 50%)`,
          backgroundImage: "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
        }}
      >
        <span className={THUMB} style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: current }} />
      </div>

      <div
        {...hueBar}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: matiz`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${Math.round(hsv.h)}°`}
        onKeyDown={onHueKey}
        className={cn("relative h-3 w-full cursor-pointer touch-none rounded-full", FOCUSABLE)}
        style={{ backgroundImage: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" }}
      >
        <span className={cn(THUMB, "top-1/2")} style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }} />
      </div>

      <div className="flex items-center gap-2">
        <span aria-hidden className="size-9 shrink-0 rounded-md ring-1 ring-inset ring-black/10 dark:ring-white/15" style={{ backgroundColor: current }} />
        <Input
          aria-label={`${label}: código HEX`}
          aria-invalid={draftInvalid || undefined}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              applyDraft()
            }
          }}
        />
      </div>
    </div>
  )
}

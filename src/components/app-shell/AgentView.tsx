import * as React from "react";
import { ArrowUp, Plus } from "lucide-react";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { AI_GRADIENT } from "./appShellData";
import { useShellConfig } from "./shellConfig";

/**
 * Visual-only representation of the Agente IA surface. It mirrors the
 * reference layout (greeting, input card, suggestions) without any chat
 * behavior — the suggestions simply fill the input.
 */
export const AgentView: React.FC = () => {
  const [prompt, setPrompt] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { user, agentSuggestions, onAgentPrompt } = useShellConfig();
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6">
      <div className="mx-auto flex w-full max-w-[820px] flex-col py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight text-text-primary lg:text-[40px] lg:leading-tight">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: AI_GRADIENT }}
          >
            ¡Buenos días,
          </span>{" "}
          {firstName}!
        </h1>

        <div className="group relative rounded-[22px] bg-surface p-4 z-0 shadow-card transition-shadow focus-within:shadow-[0_0_20px_rgba(45,92,247,0.1)]">
          {/* AI Light Border */}
          <MovingBorderBeam 
            duration={6000} 
            borderWidth={1.5}
            rx={22}
            ry={22} 
            colorFrom="hsl(var(--ai-gradient-start))" 
            colorTo="hsl(var(--ai-gradient-end))" 
          />

          <textarea
            ref={inputRef}
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="¿Cuéntame como te puedo ayudar?"
            className="relative z-10 min-h-12 w-full resize-none bg-transparent text-base leading-normal text-text-primary outline-none placeholder:text-text-muted"
          />
          <div className="relative z-10 mt-2 flex items-center justify-between">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-surface text-text-secondary transition-colors hover:bg-background"
                title="Agregar"
                aria-label="Agregar"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                onClick={() => {
                  if (!prompt.trim()) return;
                  onAgentPrompt?.(prompt.trim());
                  setPrompt("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:brightness-110"
                style={{ background: AI_GRADIENT }}
                title="Enviar"
                aria-label="Enviar"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
        </div>

        <p className="mt-3 text-center text-xs text-text-muted">
          Clipper puede cometer errores, verifica las respuestas.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agentSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setPrompt(suggestion);
                inputRef.current?.focus();
              }}
              className="rounded-2xl border border-border/70 bg-surface p-4 text-left text-[13px] font-medium leading-snug text-text-secondary transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-text-primary hover:shadow-card"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

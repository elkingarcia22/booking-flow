import path from "path"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { readTtsConfig, synthesize } from "./server/tts/tts"

/**
 * La voz de Clipper también en local: con `npm run dev` las funciones de `api/` no corren, así que el
 * servidor de desarrollo atiende `POST /api/tts` con el mismo código que la función de Vercel. La
 * clave se lee de `.env.local` (no se sube a git) y nunca llega al navegador.
 */
function clipperVoiceInDev(): Plugin {
  return {
    name: "clipper-voice-dev",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "")
      server.middlewares.use("/api/tts", async (req, res, next) => {
        if (req.method !== "POST") return next()
        let body = ""
        for await (const chunk of req) body += chunk
        let payload: unknown
        try {
          payload = JSON.parse(body)
        } catch {
          payload = undefined
        }
        const response = await synthesize(payload, readTtsConfig({ ...process.env, ...env }))
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), clipperVoiceInDev()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

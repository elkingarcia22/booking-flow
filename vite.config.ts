import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { POST as tts } from "./api/tts/index"
import { POST as guestSession } from "./api/session/guest"
import { serverFunctionsInDev } from "./server/http/devServer"

// La voz de Clipper en local (con la sesión de invitado que pide): el mismo código que en Vercel.
export default defineConfig({
  plugins: [react(), serverFunctionsInDev({ "/api/tts": { POST: tts }, "/api/session/guest": { POST: guestSession } })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

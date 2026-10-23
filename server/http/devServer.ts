import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { enableDevSessionSecret } from "../auth/session.js";

/**
 * Las funciones de `api/` también en `npm run dev`: allí no corren las de Vercel, así que el servidor
 * de desarrollo las atiende con el mismo código. Las claves se leen de `.env.local` (no se sube a git)
 * y nunca llegan al navegador; sin `SESSION_SECRET` se firma con uno al azar de este proceso.
 */

export type Handler = (request: Request) => Promise<Response> | Response;
/** Ruta → método → función (el `POST`, `GET`… que exporta cada archivo de `api/`). */
export type Routes = Record<string, Partial<Record<string, Handler>>>;

export interface DevServerOptions {
  /** Lo que en Vercel hace un cron (p. ej. enviar la cola de WhatsApp), cada `tickMs`. */
  tick?: () => Promise<unknown>;
  tickMs?: number;
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
  let body = "";
  if (req.method !== "GET" && req.method !== "HEAD") for await (const chunk of req) body += chunk;
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, { method: req.method, headers, body: body || undefined });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function serverFunctionsInDev(routes: Routes, options: DevServerOptions = {}): Plugin {
  return {
    name: "server-functions-dev",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
      enableDevSessionSecret();
      // Solo con servidor HTTP (no cuando un script usa Vite en modo middleware, como el catálogo), y
      // sin retener el proceso: `unref` deja que termine aunque el temporizador siga.
      if (options.tick && server.httpServer) {
        const tick = options.tick;
        const timer = setInterval(() => void tick().catch(() => undefined), options.tickMs ?? 30_000);
        timer.unref();
        server.httpServer.once("close", () => clearInterval(timer));
      }
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        const handler = routes[pathname]?.[req.method ?? "GET"];
        if (!handler) return next();
        try {
          await send(res, await handler(await toRequest(req)));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

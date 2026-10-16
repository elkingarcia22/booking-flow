# booking-flow

La reserva en línea de Barberlytics, sola: la experiencia de agendamiento (Paso a paso, Agenda con
selector y Clipper) con su vista previa en celular, tablet, monitor y widget. Se exporta desde el
sistema de diseño Thema con `npm run export:booking`; no se edita aquí a mano.

## Correr en local

```bash
npm ci
npm run dev
```

- `/`: la vista previa con los cuatro marcos y las tres experiencias.
- `/reservar?embed=1`: la página pública, a pantalla completa (`&version=agenda-list` o `chat`).

Es una demo sin servidor: los datos salen de un backend simulado (Mock Service Worker) que arranca
siempre. Para probar: celular `320 217 2738` (cliente que vuelve) y código `246810`; el botón
«Para probar» lista el resto.

## Desplegar en Vercel

1. Importa el repo en Vercel (detecta Vite; `vercel.json` ya fija instalación, build y rutas).
2. Opcional, la voz natural de Clipper: en *Settings → Environment Variables* agrega
   `GEMINI_API_KEY` (gratis en aistudio.google.com; o `ELEVENLABS_API_KEY`, `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, u `OPENAI_API_KEY`).
   Sin ninguna, Clipper usa la voz del navegador. Detalle en `.env.example`.
3. Opcional, los comentarios de revisión compartidos: `GOOGLE_SERVICE_ACCOUNT_JSON` y `FEEDBACK_SHARE_WITH` (ver `.env.example`). Sin ellos los comentarios solo viven en el navegador.
4. Despliega. Las rutas del cliente caen en `index.html`; `/api/tts` es la función de la voz y `/api/comments`, la de los comentarios.

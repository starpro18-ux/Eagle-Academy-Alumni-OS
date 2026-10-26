import { createFileRoute } from "@tanstack/react-router";

// Serves the browser runtime config the existing web/ pages load before their modules.
// Only the publishable key is ever exposed here — never a service-role or secret key.
export const Route = createFileRoute("/config.js")({
  server: {
    handlers: {
      GET: () => {
        const url = import.meta.env.VITE_SUPABASE_URL ?? "";
        const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
        const body = `globalThis.EAGLE_SUPABASE_CONFIG = ${JSON.stringify({ url, publishableKey })};\n`;
        return new Response(body, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});

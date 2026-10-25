import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "")
  const apiPort = Number(env.AUTHWORKS_PORT ?? env.PORT ?? 3000)
  const uiPort = Number(env.UI_PORT ?? 5173)
  // Vite forwards browser console output to the terminal automatically when it detects an AI agent,
  // which floods E2E logs with expected diagnostics. Keep it opt-in.
  const forwardConsole = env.AUTHWORKS_UI_FORWARD_CONSOLE === "1"

  return {
    plugins: [solid(), tailwindcss()],
    server: {
      forwardConsole,
      port: uiPort,
      strictPort: true,
      proxy: {
        "/.well-known": `http://127.0.0.1:${apiPort}`,
        "/api": `http://127.0.0.1:${apiPort}`,
        "/organization-discovery": `http://127.0.0.1:${apiPort}`,
        "/realms": `http://127.0.0.1:${apiPort}`,
      },
    },
    build: {
      outDir: "dist/ui",
      emptyOutDir: false,
    },
  }
})

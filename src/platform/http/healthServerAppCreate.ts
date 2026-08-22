import { Hono } from "hono"

export function healthServerAppCreate() {
  const app = new Hono()

  app.get("/health", (context) =>
    context.json({ status: "ok" }, 200, {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    }),
  )

  return app
}

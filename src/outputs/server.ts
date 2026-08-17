import { Hono } from "hono"

export const serverApp = new Hono()

if (import.meta.main) {
  Bun.serve({ fetch: serverApp.fetch })
}

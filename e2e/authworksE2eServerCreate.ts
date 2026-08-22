import type { Hono } from "hono"

/** Creates the local HTTP bridge shared by the standard and advanced E2E fixtures. */
export function authworksE2eServerCreate(options: { readonly app: Hono; readonly origin: string }) {
  const originHost = new URL(options.origin).host
  return Bun.serve({
    fetch: async (request) => {
      const requestUrl = new URL(request.url)
      const target = new URL(`${options.origin}${requestUrl.pathname}${requestUrl.search}`)
      const headers = new Headers(request.headers)
      const requestedOrigin = headers.get("x-e2e-origin") ?? headers.get("origin")
      headers.delete("x-e2e-origin")
      headers.set("origin", requestedOrigin ?? options.origin)
      headers.set("host", originHost)
      const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer()
      return options.app.fetch(new Request(target, { body, headers, method: request.method }))
    },
    hostname: "127.0.0.1",
    port: 0,
  })
}

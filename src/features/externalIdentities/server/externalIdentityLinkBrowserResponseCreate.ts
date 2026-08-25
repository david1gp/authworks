import type { ExternalIdentityCallbackResponse } from "../public/externalIdentityCallbackResponseSchema.js"

type ExternalIdentityLinkBrowserResponseCreateOptions = {
  readonly callback: Extract<ExternalIdentityCallbackResponse, { readonly kind: "link_confirmation" }>
  readonly targetOrigin: string
}

export function externalIdentityLinkBrowserResponseCreate(
  options: ExternalIdentityLinkBrowserResponseCreateOptions,
): Response {
  let targetOrigin: string
  try {
    const parsedOrigin = new URL(options.targetOrigin)
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.username !== "" ||
      parsedOrigin.password !== "" ||
      parsedOrigin.search !== "" ||
      parsedOrigin.hash !== ""
    )
      return new Response("The callback origin is invalid.", { status: 400 })
    targetOrigin = parsedOrigin.origin
  } catch (_error) {
    return new Response("The callback origin is invalid.", { status: 400 })
  }
  const message = JSON.stringify(options.callback).replaceAll("<", "\\u003c")
  const script = `window.opener?.postMessage(${message},${JSON.stringify(targetOrigin)});window.close()`
  return new Response(`<!doctype html><title>External identity link</title><script>${script}</script>`, {
    headers: {
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
    },
    status: 200,
  })
}

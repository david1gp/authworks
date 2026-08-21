import { existsSync } from "node:fs"
import { extname, isAbsolute, join, relative, resolve } from "node:path"
import { Hono } from "hono"

type UiStaticServerAppCreateOptions = {
  readonly production?: boolean
  readonly uiDirectory?: string
}

const uiAssetCacheControl = "public, max-age=31536000, immutable"
const uiStaticCacheControl = "public, max-age=3600"
const uiIndexCacheControl = "no-cache"
const uiRoutePrefixes = ["/login", "/consent", "/account", "/invitations", "/admin"] as const
const uiContentTypes: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=UTF-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=UTF-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=UTF-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

export function uiStaticServerAppCreate(options: UiStaticServerAppCreateOptions = {}) {
  const app = new Hono()
  const uiDirectory = options.uiDirectory ?? uiDirectoryResolve()

  app.get("*", async (context) => {
    const pathname = new URL(context.req.url).pathname
    const staticFile = await uiStaticFileResponseCreate(uiDirectory, pathname, uiStaticCacheControlResolve(pathname))
    if (staticFile !== null) return staticFile
    if (!uiBrowserPathIsKnown(pathname, options.production === true)) return context.notFound()
    return (await uiStaticFileResponseCreate(uiDirectory, "/index.html", uiIndexCacheControl)) ?? context.notFound()
  })

  return app
}

async function uiStaticFileResponseCreate(
  uiDirectory: string,
  pathname: string,
  cacheControl = uiAssetCacheControl,
): Promise<Response | null> {
  const filePath = uiStaticFilePathResolve(uiDirectory, pathname)
  if (filePath === null) return null
  try {
    const file = Bun.file(filePath)
    if (!(await file.exists())) return null
    const headers = new Headers({
      "cache-control": cacheControl,
      "content-type": uiContentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    })
    return new Response(file, { headers })
  } catch (_error) {
    return null
  }
}

function uiStaticFilePathResolve(uiDirectory: string, pathname: string): string | null {
  let decodedPathname: string
  try {
    decodedPathname = decodeURIComponent(pathname)
  } catch (_error) {
    return null
  }
  const filePath = resolve(uiDirectory, `.${decodedPathname === "/" ? "/index.html" : decodedPathname}`)
  const relativePath = relative(resolve(uiDirectory), filePath)
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  )
    return null
  if (isAbsolute(relativePath)) return null
  return filePath
}

function uiBrowserPathIsKnown(pathname: string, production: boolean): boolean {
  if (pathname === "/") return true
  if (!production && (pathname === "/demo" || pathname.startsWith("/demo/"))) return true
  return uiRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function uiStaticCacheControlResolve(pathname: string): string {
  if (pathname.startsWith("/assets/")) return uiAssetCacheControl
  if (pathname === "/" || pathname === "/index.html") return uiIndexCacheControl
  return uiStaticCacheControl
}

function uiDirectoryResolve(): string {
  const candidates = [
    join(import.meta.dir, "../ui"),
    join(import.meta.dir, "../../../dist/ui"),
    join(process.cwd(), "dist/ui"),
  ]
  return candidates.find((candidate) => existsSync(join(candidate, "index.html"))) ?? candidates[0] ?? "dist/ui"
}

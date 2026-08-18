export function httpUrlResolve(baseUrl: string, path: string): URL {
  const base = new URL(baseUrl)
  if (!base.pathname.endsWith("/")) base.pathname = `${base.pathname}/`
  return new URL(path.replace(/^\/+/, ""), base)
}

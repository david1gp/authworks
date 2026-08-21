import { sessionBrowserCookieExtract } from "./sessionBrowserCookieExtract.js"

export function sessionBrowserCookieTokenGet(cookieHeader: string | undefined): string {
  const extracted = sessionBrowserCookieExtract(cookieHeader, "session")
  return extracted.success ? (extracted.data ?? "") : ""
}

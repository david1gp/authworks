/** Parses a User-Agent header into browser and operating system names without dependencies. */
export function sessionUserAgentParse(userAgent: string): {
  readonly browser: string | null
  readonly os: string | null
} {
  return { browser: sessionUserAgentBrowserParse(userAgent), os: sessionUserAgentOsParse(userAgent) }
}

function sessionUserAgentBrowserParse(userAgent: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(userAgent)) return "Edge"
  if (/OPR\//.test(userAgent)) return "Opera"
  if (/SamsungBrowser\//.test(userAgent)) return "Samsung Internet"
  if (/FxiOS\//.test(userAgent)) return "Firefox"
  if (/CriOS\//.test(userAgent)) return "Chrome"
  if (/Chrome\//.test(userAgent)) return "Chrome"
  if (/Firefox\//.test(userAgent)) return "Firefox"
  if (/MSIE |Trident\//.test(userAgent)) return "Internet Explorer"
  if (/Version\//.test(userAgent) && /Safari\//.test(userAgent)) return "Safari"
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari"
  return null
}

function sessionUserAgentOsParse(userAgent: string): string | null {
  if (/iPhone|iPod/.test(userAgent)) return "iPhone"
  if (/iPad/.test(userAgent)) return "iPad"
  if (/Android/.test(userAgent)) return "Android"
  if (/Windows NT/.test(userAgent)) return "Windows"
  if (/Mac OS X|Macintosh/.test(userAgent)) return "macOS"
  if (/CrOS/.test(userAgent)) return "ChromeOS"
  if (/Linux/.test(userAgent)) return "Linux"
  return null
}

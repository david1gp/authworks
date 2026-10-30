import * as v from "valibot"
import type { SessionGeoLocation, SessionGeoLookupPort } from "./sessionGeoLookupPort.js"

const sessionIpApiResponseSchema = v.object({
  countryCode: v.nullish(v.string()),
  message: v.nullish(v.string()),
  region: v.nullish(v.string()),
  regionName: v.nullish(v.string()),
  status: v.nullish(v.string()),
})

type SessionIpApiLookupCreateOptions = {
  readonly baseUrl?: string
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

/** Looks up IP geolocation through an ip-api.com-compatible JSON endpoint. */
export function sessionIpApiLookupCreate(options: SessionIpApiLookupCreateOptions = {}): SessionGeoLookupPort {
  const baseUrl = options.baseUrl ?? "http://ip-api.com/json/"
  const fetchFn = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 5_000
  return {
    lookup: async (ip: string): Promise<SessionGeoLocation | null> => {
      try {
        const response = await fetchFn(`${baseUrl}${encodeURIComponent(ip)}`, {
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) return null
        const parsed = v.safeParse(sessionIpApiResponseSchema, await response.json().catch(() => undefined))
        if (!parsed.success || parsed.output.status !== "success") return null
        // An empty location (unknown response) is a lookup failure, not a
        // location: caching it would pin the session to "unknown" and hide
        // the real location once the endpoint resolves it.
        const location = {
          countryCode: sessionIpApiTextGet(parsed.output.countryCode),
          region: sessionIpApiTextGet(parsed.output.regionName ?? parsed.output.region),
        }
        if (location.countryCode === null && location.region === null) return null
        return location
      } catch (_error) {
        return null
      }
    },
  }
}

function sessionIpApiTextGet(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (normalized === undefined || normalized.length === 0) return null
  return normalized
}

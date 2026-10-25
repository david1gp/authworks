import * as v from "valibot"
import type { SessionGeoLocation, SessionGeoLookupPort } from "./sessionGeoLookupPort.js"

const sessionGeoIpApiResponseSchema = v.object({
  country_code: v.nullish(v.string()),
  region: v.nullish(v.string()),
})

type SessionGeoIpApiLookupCreateOptions = {
  readonly baseUrl?: string
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

/** Looks up IP geolocation through an ipapi-compatible JSON endpoint. */
export function sessionGeoIpApiLookupCreate(options: SessionGeoIpApiLookupCreateOptions = {}): SessionGeoLookupPort {
  const baseUrl = options.baseUrl ?? "https://ipapi.co/"
  const fetchFn = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 5_000
  return {
    lookup: async (ip: string): Promise<SessionGeoLocation | null> => {
      try {
        const response = await fetchFn(`${baseUrl}${encodeURIComponent(ip)}/json/`, {
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) return null
        const parsed = v.safeParse(sessionGeoIpApiResponseSchema, await response.json().catch(() => undefined))
        if (!parsed.success) return null
        return {
          countryCode: sessionGeoIpApiTextGet(parsed.output.country_code),
          region: sessionGeoIpApiTextGet(parsed.output.region),
        }
      } catch (_error) {
        return null
      }
    },
  }
}

function sessionGeoIpApiTextGet(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (normalized === undefined || normalized.length === 0) return null
  return normalized
}

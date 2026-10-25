export type SessionGeoLocation = {
  readonly countryCode: string | null
  readonly region: string | null
}

export type SessionGeoLookupPort = {
  readonly lookup: (ip: string) => Promise<SessionGeoLocation | null>
}

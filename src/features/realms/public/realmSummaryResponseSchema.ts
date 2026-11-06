import * as v from "valibot"

export const realmSummaryResponseSchema = v.object({
  organizations: v.pipe(v.number(), v.integer(), v.minValue(0)),
  users: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmAdministrators: v.pipe(v.number(), v.integer(), v.minValue(0)),
  oidcClients: v.pipe(v.number(), v.integer(), v.minValue(0)),
  activeSessions: v.pipe(v.number(), v.integer(), v.minValue(0)),
  auditEvents24h: v.pipe(v.number(), v.integer(), v.minValue(0)),
})
export type RealmSummaryResponse = v.InferOutput<typeof realmSummaryResponseSchema>

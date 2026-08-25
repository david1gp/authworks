import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import type { Realm } from "../../realms/public/realmSchema.js"

const productionRealmDomain = "authworks.contentoren.de"

export async function oidcCodelineProductionRealmResolve(
  api: {
    readonly realmList: (query?: ListQuery) => ReturnType<ReturnType<typeof realmApiClientCreate>["realmList"]>
  },
  failureCodes?: {
    readonly ambiguous: string
    readonly inactive: string
    readonly missing: string
  },
): Promise<Result<Realm>> {
  const op = "oidcCodelineProductionRealmResolve"
  const matches: Realm[] = []
  let pageToken: string | undefined
  do {
    const listed = await api.realmList({ pageSize: 100, ...(pageToken === undefined ? {} : { pageToken }) })
    if (!listed.success) return listed
    matches.push(...listed.data.items.filter((realm) => realm.domains.includes(productionRealmDomain)))
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  if (matches.length !== 1)
    return resultErrorCodedCreate(
      op,
      matches.length === 0
        ? "No realm owns the production Authworks domain; no changes were made."
        : "More than one realm owns the production Authworks domain; no changes were made.",
      matches.length === 0
        ? (failureCodes?.missing ?? "realms.conflict")
        : (failureCodes?.ambiguous ?? "realms.conflict"),
    )
  const realm = matches[0]
  if (realm === undefined || realm.domain !== productionRealmDomain)
    return resultErrorCodedCreate(
      op,
      "The production Authworks domain is not the realm's primary domain; no changes were made.",
      failureCodes?.missing ?? "realms.conflict",
    )
  if (realm.status !== "active")
    return resultErrorCodedCreate(
      op,
      "The production Authworks realm is not active; no changes were made.",
      failureCodes?.inactive ?? "realms.conflict",
    )
  return resultCreate(realm)
}

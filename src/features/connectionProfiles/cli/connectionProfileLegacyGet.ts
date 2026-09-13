import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { connectionProfilesStoreCreate } from "../persistence/connectionProfilesStoreCreate.js"

export async function connectionProfileLegacyGet(
  name: string,
  options: {
    readonly path: string
  },
): Promise<
  Result<
    | {
        readonly organizationId?: string
        readonly realmId?: string
        readonly server?: string
        readonly token?: string
      }
    | undefined
  >
> {
  const profile = await connectionProfilesStoreCreate(options).connectionProfileGet(name)
  if (!profile.success) return profile
  if (profile.data === undefined) return resultCreate(undefined)
  return resultCreate({
    ...(profile.data.organizationId === undefined ? {} : { organizationId: profile.data.organizationId }),
    ...(profile.data.realmId === undefined ? {} : { realmId: profile.data.realmId }),
    ...(profile.data.server === undefined ? {} : { server: profile.data.server }),
    ...(profile.data.token === undefined ? {} : { token: profile.data.token }),
  })
}

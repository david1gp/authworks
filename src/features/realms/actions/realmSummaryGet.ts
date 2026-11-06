import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { eventRecentRealmCount } from "../../events/server/eventRecentRealmCount.js"
import { oidcClientRealmCount } from "../../oidc/server/oidcClientRealmCount.js"
import { organizationRealmCount } from "../../organizations/server/organizationRealmCount.js"
import { sessionActiveRealmCount } from "../../sessions/server/sessionActiveRealmCount.js"
import { userRealmCount } from "../../users/server/userRealmCount.js"
import { realmAdministratorRealmCount } from "../server/realmAdministratorRealmCount.js"

export function realmSummaryGet(database: StorageDatabase, realmId: string) {
  const organizations = organizationRealmCount(database, realmId)
  if (!organizations.success) return organizations
  const users = userRealmCount(database, realmId)
  if (!users.success) return users
  const realmAdministrators = realmAdministratorRealmCount(database, realmId)
  if (!realmAdministrators.success) return realmAdministrators
  const oidcClients = oidcClientRealmCount(database, realmId)
  if (!oidcClients.success) return oidcClients
  const activeSessions = sessionActiveRealmCount(database, realmId)
  if (!activeSessions.success) return activeSessions
  const auditEvents24h = eventRecentRealmCount(database, realmId)
  if (!auditEvents24h.success) return auditEvents24h
  return resultCreate({
    organizations: organizations.data,
    users: users.data,
    realmAdministrators: realmAdministrators.data,
    oidcClients: oidcClients.data,
    activeSessions: activeSessions.data,
    auditEvents24h: auditEvents24h.data,
  })
}

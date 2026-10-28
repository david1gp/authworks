import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { storageDatabaseOpen } from "../../../platform/storage/storageDatabaseOpen.js"
import { platformTestkitCreate } from "../../../platform/testkit/platformTestkitCreate.js"
import { realmCreate } from "../../realms/actions/realmCreate.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { realmTenantContextCreate } from "../../realms/domain/realmTenantContextCreate.js"
import { userCreate } from "../../users/actions/userCreate.js"
import { userDisplayNameList } from "../../users/server/userDisplayNameList.js"
import { organizationCreate } from "./organizationCreate.js"
import { organizationMembershipList } from "./organizationMembershipList.js"

test("member list exposes only authorized realm display names and preserves missing-name fallback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authworks-member-names-"))
  const opened = storageDatabaseOpen(join(directory, "test.sqlite"), platformTestkitCreate().runtime)
  if (!opened.success) throw new Error(opened.errorMessage)
  const database = opened.data
  try {
    const context = realmSystemContextCreate()
    const realm = realmCreate({ context, database, input: { domain: "names.example.com", name: "Names" } })
    const other = realmCreate({ context, database, input: { domain: "other-names.example.com", name: "Other" } })
    if (!realm.success || !other.success) throw new Error("Realm creation failed")
    const realmId = realm.data.realm.id
    const user = userCreate({
      context,
      database,
      realmId,
      input: { email: "owner@example.com", userName: "owner", profile: { displayName: "Recognizable Owner" } },
    })
    if (!user.success) throw new Error(user.errorMessage)
    const userId = user.data.user.id
    const organization = organizationCreate({
      context,
      database,
      realmId,
      input: { name: "Names", ownerUserId: userId },
    })
    if (!organization.success) throw new Error(organization.errorMessage)
    const list = (actorId: string) =>
      organizationMembershipList({
        context: realmTenantContextCreate(realmId, actorId),
        database,
        realmId,
        organizationId: organization.data.organization.id,
      })
    const result = list(userId)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.errorMessage)
    expect(result.data.items[0]?.displayName).toBe("Recognizable Owner")
    expect(list("outsider").success).toBe(false)
    const foreign = userDisplayNameList({ database, realmId: other.data.realm.id, userIds: [userId] })
    expect(foreign.success && foreign.data).toEqual([])
    database.sqlite.run("UPDATE user_profiles SET display_name = NULL WHERE user_id = ?", [userId])
    const missing = list(userId)
    expect(missing.success && missing.data.items[0]?.displayName).toBe("owner")
  } finally {
    database.close()
    await rm(directory, { recursive: true, force: true })
  }
})

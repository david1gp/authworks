import type { Page } from "@playwright/test"
import * as v from "valibot"
import { organizationMembershipResponseSchema } from "../../../src/features/organizations/public/organizationMembershipResponseSchema.js"
import { userResponseSchema } from "../../../src/features/users/public/userResponseSchema.js"
import { e2eTestEmailCreate } from "../../harness/e2eTestEmailCreate.js"
import { e2eTestNameCreate } from "../../harness/e2eTestNameCreate.js"
import type { E2eWorkflowSession } from "../shared/e2eWorkflowApiClientCreate.js"
import {
  type E2eWorkflowContext,
  e2eWorkflowContextCreate,
  e2eWorkflowEntityRecord,
  e2eWorkflowValueGet,
  e2eWorkflowValueSet,
} from "../shared/e2eWorkflowContextCreate.js"
import { type E2eWorkflowSetup, e2eWorkflowSetupCreate } from "../shared/e2eWorkflowSetupCreate.js"

export type AdminOrgAdminLimitsSetup = E2eWorkflowSetup & {
  readonly adminPassword: string
  readonly adminUserId: string
  readonly adminUserName: string
  readonly context: E2eWorkflowContext
  readonly memberPassword: string
  readonly ownerPassword: string
}

const passwordSchema = v.looseObject({ changed: v.optional(v.boolean()) })

const passwordSet = async (
  context: E2eWorkflowContext,
  realmId: string,
  session: E2eWorkflowSession,
  userId: string,
  password: string,
): Promise<void> => {
  await context.api.authenticatedJson(
    session,
    "PUT",
    `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/password`,
    { password },
    passwordSchema,
    "adminOrgAdminLimitsSetup.passwordSet",
  )
}

/**
 * Creates the admin-limits fixtures via the tenant API as the service user: the shared
 * organization with owner + member + project, plus an additional admin user with a password
 * and an admin membership. All creates are idempotent across resume: ids stored in checkpoint
 * values are reused, and user lookup falls back to a name search when a value is missing.
 */
export async function adminOrgAdminLimitsSetupCreate(page: Page): Promise<AdminOrgAdminLimitsSetup> {
  const context = e2eWorkflowContextCreate(page)
  const ownerPassword = `Owner-${context.runId}-E2E-password-1!`
  const memberPassword = `Member-${context.runId}-E2E-password-1!`
  const adminPassword = `Admin-${context.runId}-E2E-password-1!`
  const setup = await e2eWorkflowSetupCreate(context, {
    keys: { project: "org-admin-limits" },
    memberPassword,
    ownerPassword,
  })
  const prefix = "org-admin-limits"
  const now = new Date().toISOString()
  const valueGet = (key: string): string | undefined => e2eWorkflowValueGet(context.checkpointPath, key)
  const valueSet = (key: string, value: string): void => {
    e2eWorkflowValueSet(context.checkpointPath, key, value)
  }

  const service = await context.api.login(setup.realmId, context.serviceUsername, context.servicePassword)
  const authed = (
    method: "GET" | "PATCH" | "POST" | "PUT",
    path: string,
    input: unknown,
    schema: v.GenericSchema<unknown>,
    name: string,
  ) => context.api.authenticatedJson(service, method, path, input, schema, `adminOrgAdminLimitsSetup.${name}`)

  const adminName = e2eTestNameCreate(context.runId, `${prefix}-admin`)
  let adminUserId = valueGet(`${prefix}.adminUserId`)
  const storedAdminName = valueGet(`${prefix}.adminUserName`)
  if (adminUserId === undefined || storedAdminName === undefined) {
    const searched = (await authed(
      "GET",
      `/realms/${encodeURIComponent(setup.realmId)}/directory/users?search=${encodeURIComponent(adminName)}&pageSize=100`,
      undefined,
      v.looseObject({
        items: v.array(v.looseObject({ user: v.looseObject({ id: v.string(), userName: v.string() }) })),
      }),
      "adminSearch",
    )) as { items: { user: { id: string; userName: string } }[] }
    const match = searched.items.map((item) => item.user).find((user) => user.userName === adminName)
    if (match !== undefined) {
      adminUserId = match.id
    } else {
      const created = (await authed(
        "POST",
        `/realms/${encodeURIComponent(setup.realmId)}/users`,
        { email: e2eTestEmailCreate(adminName), profile: { displayName: adminName }, userName: adminName },
        userResponseSchema,
        "adminCreate",
      )) as { user: { id: string } }
      adminUserId = created.user.id
      e2eWorkflowEntityRecord(context.checkpointPath, {
        createdAt: now,
        id: adminUserId,
        kind: "user",
        name: adminName,
      })
      await authed(
        "POST",
        `/realms/${encodeURIComponent(setup.realmId)}/users/${encodeURIComponent(adminUserId)}/lifecycle`,
        { state: "active" },
        userResponseSchema,
        "adminActivate",
      )
      await authed(
        "POST",
        `/realms/${encodeURIComponent(setup.realmId)}/users/${encodeURIComponent(adminUserId)}/verification`,
        { state: "verified" },
        userResponseSchema,
        "adminVerify",
      )
      await passwordSet(context, setup.realmId, service, adminUserId, adminPassword)
    }
    valueSet(`${prefix}.adminUserId`, adminUserId)
    valueSet(`${prefix}.adminUserName`, adminName)
  }
  const adminUserName = storedAdminName ?? adminName
  const adminUserIdResolved: string = adminUserId

  const membershipEnsureIn = async (targetOrganizationId: string, role: "admin" | "member"): Promise<void> => {
    if (valueGet(`${prefix}.membership.${targetOrganizationId}.${adminUserIdResolved}`) !== undefined) return
    const listed = (await authed(
      "GET",
      `/realms/${encodeURIComponent(setup.realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships?pageSize=100`,
      undefined,
      v.looseObject({ items: v.array(v.looseObject({ id: v.string(), userId: v.string() })) }),
      "adminMembershipList",
    )) as { items: { id: string; userId: string }[] }
    const match = listed.items.find((item) => item.userId === adminUserIdResolved)
    if (match === undefined) {
      const created = (await authed(
        "POST",
        `/realms/${encodeURIComponent(setup.realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships`,
        { roles: [role], userId: adminUserIdResolved },
        organizationMembershipResponseSchema,
        "adminMembershipCreate",
      )) as { membership: { id: string } }
      e2eWorkflowEntityRecord(context.checkpointPath, {
        createdAt: now,
        id: created.membership.id,
        kind: "membership",
        name: `${setup.organizationName}/${adminUserIdResolved}`,
      })
    } else {
      await authed(
        "PATCH",
        `/realms/${encodeURIComponent(setup.realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships/${encodeURIComponent(match.id)}`,
        { roles: [role] },
        organizationMembershipResponseSchema,
        "adminMembershipUpdate",
      )
      e2eWorkflowEntityRecord(context.checkpointPath, {
        createdAt: now,
        id: match.id,
        kind: "membership",
        name: `${setup.organizationName}/${adminUserIdResolved}`,
      })
    }
    valueSet(`${prefix}.membership.${targetOrganizationId}.${adminUserIdResolved}`, "done")
  }

  await membershipEnsureIn(setup.organizationId, "admin")
  const discovered = await context.api.discovery(context.organizationDomain)
  if (discovered.organizationId !== setup.organizationId) await membershipEnsureIn(discovered.organizationId, "member")

  return {
    ...setup,
    adminPassword,
    adminUserId: adminUserIdResolved,
    adminUserName,
    context,
    memberPassword,
    ownerPassword,
  }
}

/** Reloads setup values from the checkpoint so resumed steps work after a crash. */
export function adminOrgAdminLimitsSetupLoad(page: Page): AdminOrgAdminLimitsSetup | undefined {
  const context = e2eWorkflowContextCreate(page)
  const prefix = "org-admin-limits"
  const organizationId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.organizationId`)
  const organizationName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.organizationName`)
  const ownerUserId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.ownerUserId`)
  const ownerUserName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.ownerUserName`)
  const adminUserId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.adminUserId`)
  const adminUserName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.adminUserName`)
  const memberUserId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.memberUserId`)
  const memberUserName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.memberUserName`)
  const projectId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.projectId`)
  const projectName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.projectName`)
  const roleKeyA = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.roleKey.a`)
  const roleKeyB = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.roleKey.b`)
  const realmId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.realmId`)
  if (
    organizationId === undefined ||
    ownerUserId === undefined ||
    ownerUserName === undefined ||
    adminUserId === undefined ||
    adminUserName === undefined ||
    memberUserId === undefined ||
    memberUserName === undefined ||
    projectId === undefined ||
    realmId === undefined ||
    roleKeyA === undefined ||
    roleKeyB === undefined
  )
    return undefined
  const runId = context.runId
  return {
    adminPassword: `Admin-${runId}-E2E-password-1!`,
    adminUserId,
    adminUserName,
    context,
    memberPassword: `Member-${runId}-E2E-password-1!`,
    memberUserId,
    memberUserName,
    organizationId,
    organizationName: organizationName ?? memberUserName,
    ownerPassword: `Owner-${runId}-E2E-password-1!`,
    ownerUserId,
    ownerUserName,
    projectId,
    projectName: projectName ?? memberUserName,
    realmId,
    roleKeyA,
    roleKeyB,
  }
}

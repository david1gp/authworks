import * as v from "valibot"
import { organizationMembershipResponseSchema } from "../../../src/features/organizations/public/organizationMembershipResponseSchema.js"
import { organizationResponseSchema } from "../../../src/features/organizations/public/organizationResponseSchema.js"
import { projectResponseSchema } from "../../../src/features/projects/public/projectResponseSchema.js"
import { projectRoleResponseSchema } from "../../../src/features/projects/public/projectRoleResponseSchema.js"
import { userResponseSchema } from "../../../src/features/users/public/userResponseSchema.js"
import { e2eTestEmailCreate } from "../../harness/e2eTestEmailCreate.js"
import { e2eTestNameCreate } from "../../harness/e2eTestNameCreate.js"
import type { E2eWorkflowSession } from "./e2eWorkflowApiClientCreate.js"
import {
  type E2eWorkflowContext,
  e2eWorkflowEntityRecord,
  e2eWorkflowValueGet,
  e2eWorkflowValueSet,
} from "./e2eWorkflowContextCreate.js"

export type E2eWorkflowSetup = {
  readonly memberUserId: string
  readonly memberUserName: string
  readonly organizationId: string
  readonly organizationName: string
  readonly ownerUserId: string
  readonly ownerUserName: string
  readonly projectId: string
  readonly projectName: string
  readonly realmId: string
  readonly roleKeyA: string
  readonly roleKeyB: string
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
    "e2eWorkflowSetup.passwordSet",
  )
}

/**
 * Creates the workflow organization, owner/member users with passwords, their memberships, and
 * a project with two roles. All creates are idempotent across resume: ids stored in checkpoint
 * values are reused, and user lookup falls back to a name search when a value is missing.
 */
export async function e2eWorkflowSetupCreate(
  context: E2eWorkflowContext,
  options: {
    readonly keys: { readonly project: string }
    readonly memberPassword: string
    readonly ownerPassword: string
  },
): Promise<E2eWorkflowSetup> {
  const op = "e2eWorkflowSetupCreate"
  const discovered = await context.api.discovery(context.organizationDomain)
  const realmId = discovered.realmId
  const service = await context.api.login(realmId, context.serviceUsername, context.servicePassword)
  e2eWorkflowValueSet(context.checkpointPath, `${options.keys.project}.realmId`, realmId)

  const api = context.api
  const serviceSession = service
  const authed = (
    method: "GET" | "PATCH" | "POST" | "PUT",
    path: string,
    input: unknown,
    schema: v.GenericSchema<unknown>,
    name: string,
  ) => api.authenticatedJson(serviceSession, method, path, input, schema, `${op}.${name}`)

  const valueGet = (key: string): string | undefined => e2eWorkflowValueGet(context.checkpointPath, key)
  const valueSet = (key: string, value: string): void => {
    e2eWorkflowValueSet(context.checkpointPath, key, value)
  }
  const prefix = `${options.keys.project}`
  const now = new Date().toISOString()

  const orgName = e2eTestNameCreate(context.runId, `${prefix}-org`)
  valueSet(`${prefix}.organizationName`, orgName)
  let organizationId = valueGet(`${prefix}.organizationId`)
  if (organizationId === undefined) {
    const created = (await authed(
      "POST",
      `/realms/${encodeURIComponent(realmId)}/organizations`,
      { name: orgName },
      organizationResponseSchema,
      "organizationCreate",
    )) as { organization: { id: string } }
    organizationId = created.organization.id
    valueSet(`${prefix}.organizationId`, organizationId)
    e2eWorkflowEntityRecord(context.checkpointPath, {
      createdAt: now,
      id: organizationId,
      kind: "organization",
      name: orgName,
    })
  }
  const organizationIdResolved: string = organizationId

  const userEnsure = async (role: "member" | "owner", password: string): Promise<{ id: string; userName: string }> => {
    const name = e2eTestNameCreate(context.runId, `${prefix}-${role}`)
    const existingId = valueGet(`${prefix}.${role}UserId`)
    const existingName = valueGet(`${prefix}.${role}UserName`)
    if (existingId !== undefined && existingName !== undefined) return { id: existingId, userName: existingName }
    if (existingId !== undefined) return { id: existingId, userName: name }
    const searched = (await authed(
      "GET",
      `/realms/${encodeURIComponent(realmId)}/directory/users?search=${encodeURIComponent(name)}&pageSize=100`,
      undefined,
      v.looseObject({
        items: v.array(v.looseObject({ user: v.looseObject({ id: v.string(), userName: v.string() }) })),
      }),
      "userSearch",
    )) as { items: { user: { id: string; userName: string } }[] }
    const matches = searched.items.map((item) => item.user).filter((user) => user.userName === name)
    const match = matches.find((user) => user.userName === name)
    if (match !== undefined) {
      valueSet(`${prefix}.${role}UserId`, match.id)
      valueSet(`${prefix}.${role}UserName`, name)
      return { id: match.id, userName: name }
    }
    const created = (await authed(
      "POST",
      `/realms/${encodeURIComponent(realmId)}/users`,
      { email: e2eTestEmailCreate(name), profile: { displayName: name }, userName: name },
      userResponseSchema,
      "userCreate",
    )) as { user: { id: string } }
    const userId = created.user.id
    valueSet(`${prefix}.${role}UserId`, userId)
    valueSet(`${prefix}.${role}UserName`, name)
    e2eWorkflowEntityRecord(context.checkpointPath, { createdAt: now, id: userId, kind: "user", name })
    await authed(
      "POST",
      `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/lifecycle`,
      { state: "active" },
      userResponseSchema,
      "userActivate",
    )
    await authed(
      "POST",
      `/realms/${encodeURIComponent(realmId)}/users/${encodeURIComponent(userId)}/verification`,
      { state: "verified" },
      userResponseSchema,
      "userVerify",
    )
    await passwordSet(context, realmId, serviceSession, userId, password)
    return { id: userId, userName: name }
  }

  const owner = await userEnsure("owner", options.ownerPassword)
  const member = await userEnsure("member", options.memberPassword)

  const membershipEnsureIn = async (
    targetOrganizationId: string,
    userId: string,
    role: "member" | "owner",
  ): Promise<void> => {
    if (valueGet(`${prefix}.membership.${targetOrganizationId}.${userId}`) !== undefined) return
    const listed = (await authed(
      "GET",
      `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships?pageSize=100`,
      undefined,
      v.looseObject({ items: v.array(v.looseObject({ id: v.string(), userId: v.string() })) }),
      "membershipList",
    )) as { items: { id: string; userId: string }[] }
    const match = listed.items.find((item) => item.userId === userId)
    if (match === undefined) {
      const created = (await authed(
        "POST",
        `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships`,
        { roles: [role], userId },
        organizationMembershipResponseSchema,
        "membershipCreate",
      )) as { membership: { id: string } }
      e2eWorkflowEntityRecord(context.checkpointPath, {
        createdAt: now,
        id: created.membership.id,
        kind: "membership",
        name: `${orgName}/${userId}`,
      })
    } else {
      await authed(
        "PATCH",
        `/realms/${encodeURIComponent(realmId)}/organizations/${encodeURIComponent(targetOrganizationId)}/memberships/${encodeURIComponent(match.id)}`,
        { roles: [role] },
        organizationMembershipResponseSchema,
        "membershipUpdate",
      )
      e2eWorkflowEntityRecord(context.checkpointPath, {
        createdAt: now,
        id: match.id,
        kind: "membership",
        name: `${orgName}/${userId}`,
      })
    }
    valueSet(`${prefix}.membership.${targetOrganizationId}.${userId}`, "done")
  }
  const membershipEnsure = async (userId: string, role: "member" | "owner"): Promise<void> =>
    membershipEnsureIn(organizationIdResolved, userId, role)

  await membershipEnsure(owner.id, "owner")
  await membershipEnsure(member.id, "member")

  // The hosted login signs in with the discovery organization (Authworks Dev on dev), so the
  // seeded `e2e-dev-member` fixture proves that org can carry extra members; adding the
  // workflow users there keeps their discovery-based UI sign-in working. Realm admins and
  // the test org's owner/admins can still manage them because user-scoped admin access only
  // requires a shared organization with the target (directoryUserAccess / users routes).
  const devOrganizationId = discovered.organizationId
  if (devOrganizationId !== organizationIdResolved) {
    await membershipEnsureIn(devOrganizationId, owner.id, "member")
    await membershipEnsureIn(devOrganizationId, member.id, "member")
  }

  const projectName = e2eTestNameCreate(context.runId, `${prefix}-project`)
  valueSet(`${prefix}.projectName`, projectName)
  let projectId = valueGet(`${prefix}.projectId`)
  if (projectId === undefined) {
    const created = (await authed(
      "POST",
      `/realms/${encodeURIComponent(realmId)}/projects`,
      { name: projectName, organizationId: organizationIdResolved },
      projectResponseSchema,
      "projectCreate",
    )) as { project: { id: string } }
    projectId = created.project.id
    valueSet(`${prefix}.projectId`, projectId)
    e2eWorkflowEntityRecord(context.checkpointPath, {
      createdAt: now,
      id: projectId,
      kind: "project",
      name: projectName,
    })
  }
  const projectIdResolved: string = projectId

  const roleEnsure = async (slot: "a" | "b"): Promise<string> => {
    const key = `${prefix}.roleKey.${slot}`
    const stored = valueGet(key)
    if (stored !== undefined) return stored
    const roleKey = `${prefix}-role-${slot}`
    const listed = (await authed(
      "GET",
      `/realms/${encodeURIComponent(realmId)}/projects/${encodeURIComponent(projectIdResolved)}/roles?pageSize=100`,
      undefined,
      v.looseObject({ items: v.array(v.looseObject({ id: v.string(), key: v.string() })) }),
      "roleList",
    )) as { items: { id: string; key: string }[] }
    const match = listed.items.find((item) => item.key === roleKey)
    if (match === undefined) {
      await authed(
        "POST",
        `/realms/${encodeURIComponent(realmId)}/projects/${encodeURIComponent(projectIdResolved)}/roles`,
        { displayName: `${prefix} role ${slot.toUpperCase()}`, key: roleKey },
        projectRoleResponseSchema,
        "roleCreate",
      )
    }
    valueSet(key, roleKey)
    return roleKey
  }

  const roleKeyA = await roleEnsure("a")
  const roleKeyB = await roleEnsure("b")

  return {
    memberUserId: member.id,
    memberUserName: member.userName,
    organizationId: organizationIdResolved,
    organizationName: orgName,
    ownerUserId: owner.id,
    ownerUserName: owner.userName,
    projectId: projectIdResolved,
    projectName,
    realmId,
    roleKeyA,
    roleKeyB,
  }
}

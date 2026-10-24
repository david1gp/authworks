import type { Page } from "@playwright/test"
import {
  type E2eWorkflowContext,
  e2eWorkflowContextCreate,
  e2eWorkflowValueGet,
} from "../shared/e2eWorkflowContextCreate.js"
import { type E2eWorkflowSetup, e2eWorkflowSetupCreate } from "../shared/e2eWorkflowSetupCreate.js"

export type AdminOrgOwnerSetup = E2eWorkflowSetup & {
  readonly context: E2eWorkflowContext
  readonly memberPassword: string
  readonly ownerPassword: string
}

/**
 * Creates the org-owner workflow fixtures via the tenant API as the service user: organization,
 * owner + member users with passwords, their memberships, and a project with two roles. The
 * member signs in once via the API so `lastSignInAt` is set for sort-order assertions.
 */
export async function adminOrgOwnerSetupCreate(page: Page): Promise<AdminOrgOwnerSetup> {
  const context = e2eWorkflowContextCreate(page)
  const ownerPassword = `Owner-${context.runId}-E2E-password-1!`
  const memberPassword = `Member-${context.runId}-E2E-password-1!`
  const setup = await e2eWorkflowSetupCreate(context, {
    keys: { project: "org-owner" },
    memberPassword,
    ownerPassword,
  })
  await context.api.login(setup.realmId, setup.memberUserName, memberPassword)
  return { ...setup, context, memberPassword, ownerPassword }
}

/** Reloads setup values from the checkpoint so resumed steps work after a crash. */
export function adminOrgOwnerSetupLoad(page: Page): AdminOrgOwnerSetup | undefined {
  const context = e2eWorkflowContextCreate(page)
  const prefix = "org-owner"
  const organizationId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.organizationId`)
  const organizationName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.organizationName`)
  const ownerUserId = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.ownerUserId`)
  const ownerUserName = e2eWorkflowValueGet(context.checkpointPath, `${prefix}.ownerUserName`)
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

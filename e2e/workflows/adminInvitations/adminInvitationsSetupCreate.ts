import type { Page } from "@playwright/test"
import {
  type E2eWorkflowContext,
  e2eWorkflowContextCreate,
  e2eWorkflowValueGet,
} from "../shared/e2eWorkflowContextCreate.js"
import { type E2eWorkflowSetup, e2eWorkflowSetupCreate } from "../shared/e2eWorkflowSetupCreate.js"

export type AdminInvitationsSetup = E2eWorkflowSetup & {
  readonly context: E2eWorkflowContext
  readonly inviteeEmail: string
  readonly memberPassword: string
  readonly ownerPassword: string
}

/**
 * Creates the invitations workflow fixtures via the tenant API as the service user:
 * organization with owner + member + project. The invitee address is derived from the run id;
 * dev has mail delivery disabled, so no mail is ever sent.
 */
export async function adminInvitationsSetupCreate(page: Page): Promise<AdminInvitationsSetup> {
  const context = e2eWorkflowContextCreate(page)
  const ownerPassword = `Owner-${context.runId}-E2E-password-1!`
  const memberPassword = `Member-${context.runId}-E2E-password-1!`
  const setup = await e2eWorkflowSetupCreate(context, {
    keys: { project: "invitations" },
    memberPassword,
    ownerPassword,
  })
  return {
    ...setup,
    context,
    inviteeEmail: `e2e-aw-${context.runId}-invitee@example.com`,
    memberPassword,
    ownerPassword,
  }
}

/** Reloads setup values from the checkpoint so resumed steps work after a crash. */
export function adminInvitationsSetupLoad(page: Page): AdminInvitationsSetup | undefined {
  const context = e2eWorkflowContextCreate(page)
  const prefix = "invitations"
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
    inviteeEmail: `e2e-aw-${runId}-invitee@example.com`,
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

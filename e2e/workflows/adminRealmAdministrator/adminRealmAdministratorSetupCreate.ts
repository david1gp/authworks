import type { Page } from "@playwright/test"
import {
  type E2eWorkflowContext,
  e2eWorkflowContextCreate,
  e2eWorkflowValueGet,
} from "../shared/e2eWorkflowContextCreate.js"
import { type E2eWorkflowSetup, e2eWorkflowSetupCreate } from "../shared/e2eWorkflowSetupCreate.js"

export type AdminRealmAdministratorSetup = E2eWorkflowSetup & {
  readonly candidatePassword: string
  readonly candidateUserId: string
  readonly candidateUserName: string
  readonly context: E2eWorkflowContext
  readonly memberPassword: string
  readonly ownerPassword: string
}

/**
 * Creates the realm-administrator workflow fixtures via the tenant API as the service user:
 * organization with owner + member + project, plus a candidate user (member of the test org)
 * who the service user later grants and revokes realm administration through the UI.
 */
export async function adminRealmAdministratorSetupCreate(page: Page): Promise<AdminRealmAdministratorSetup> {
  const context = e2eWorkflowContextCreate(page)
  const ownerPassword = `Owner-${context.runId}-E2E-password-1!`
  const memberPassword = `Member-${context.runId}-E2E-password-1!`
  const candidatePassword = `Candidate-${context.runId}-E2E-password-1!`
  const setup = await e2eWorkflowSetupCreate(context, {
    keys: { project: "realm-administrator" },
    memberPassword,
    ownerPassword,
  })
  return {
    ...setup,
    candidatePassword,
    candidateUserId: setup.memberUserId,
    candidateUserName: setup.memberUserName,
    context,
    memberPassword,
    ownerPassword,
  }
}

/** Reloads setup values from the checkpoint so resumed steps work after a crash. */
export function adminRealmAdministratorSetupLoad(page: Page): AdminRealmAdministratorSetup | undefined {
  const context = e2eWorkflowContextCreate(page)
  const prefix = "realm-administrator"
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
    candidatePassword: `Candidate-${runId}-E2E-password-1!`,
    candidateUserId: memberUserId,
    candidateUserName: memberUserName,
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

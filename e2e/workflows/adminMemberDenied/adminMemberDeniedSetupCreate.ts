import type { Page } from "@playwright/test"
import {
  type E2eWorkflowContext,
  e2eWorkflowContextCreate,
  e2eWorkflowValueGet,
} from "../shared/e2eWorkflowContextCreate.js"
import { e2eWorkflowSetupCreate } from "../shared/e2eWorkflowSetupCreate.js"

export type AdminMemberDeniedSetup = {
  readonly context: E2eWorkflowContext
  readonly memberPassword: string
  readonly memberUserName: string
  readonly organizationId: string
  readonly realmId: string
}

/** Creates the member-denied fixtures: organization with owner + member; member gets a password. */
export async function adminMemberDeniedSetupCreate(page: Page): Promise<AdminMemberDeniedSetup> {
  const context = e2eWorkflowContextCreate(page)
  const ownerPassword = `Owner-${context.runId}-E2E-password-1!`
  const memberPassword = `Member-${context.runId}-E2E-password-1!`
  const setup = await e2eWorkflowSetupCreate(context, {
    keys: { project: "member-denied" },
    memberPassword,
    ownerPassword,
  })
  return {
    context,
    memberPassword,
    memberUserName: setup.memberUserName,
    organizationId: setup.organizationId,
    realmId: setup.realmId,
  }
}

/** Reloads setup values from the checkpoint so resumed steps work after a crash. */
export function adminMemberDeniedSetupLoad(page: Page): AdminMemberDeniedSetup | undefined {
  const context = e2eWorkflowContextCreate(page)
  const runId = context.runId
  const memberUserName = e2eWorkflowValueGet(context.checkpointPath, "member-denied.memberUserName")
  const organizationId = e2eWorkflowValueGet(context.checkpointPath, "member-denied.organizationId")
  const realmId = e2eWorkflowValueGet(context.checkpointPath, "member-denied.realmId")
  if (memberUserName === undefined || organizationId === undefined || realmId === undefined) return undefined
  const memberPassword = `Member-${runId}-E2E-password-1!`
  return { context, memberPassword, memberUserName, organizationId, realmId }
}

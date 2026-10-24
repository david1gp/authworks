import { e2eStepRun } from "../../harness/e2eStepRun.js"
import { e2eTest } from "../../harness/e2eTest.js"
import { adminInvitationsInviteCreate } from "./adminInvitationsInviteCreate.js"
import { adminInvitationsInviteRevoke } from "./adminInvitationsInviteRevoke.js"
import {
  type AdminInvitationsSetup,
  adminInvitationsSetupCreate,
  adminInvitationsSetupLoad,
} from "./adminInvitationsSetupCreate.js"
import { adminInvitationsSignIn } from "./adminInvitationsSignIn.js"
import { adminInvitationsSignOut } from "./adminInvitationsSignOut.js"

const stepNames = ["setup", "sign-in", "invite-create", "invite-revoke", "sign-out"] as const

type AdminInvitationsStepName = (typeof stepNames)[number]

e2eTest("admin owner invites and revokes a pending organization invitation", async ({ page }) => {
  let setup: AdminInvitationsSetup | undefined
  const setupGet = (): AdminInvitationsSetup => {
    if (setup !== undefined) return setup
    const reloaded = adminInvitationsSetupLoad(page)
    if (reloaded === undefined) throw new Error("adminInvitations: the setup step did not complete.")
    setup = reloaded
    return setup
  }
  const run = (stepName: AdminInvitationsStepName, runStep: () => Promise<void>): Promise<void> =>
    e2eStepRun({
      step: async (_title, body) => {
        await body()
      },
      stepName,
      run: runStep,
    })

  await run("setup", async () => {
    setup = await adminInvitationsSetupCreate(page)
  })
  await run("sign-in", async () => adminInvitationsSignIn(page, setupGet()))
  await run("invite-create", async () => adminInvitationsInviteCreate(setupGet()))
  await run("invite-revoke", async () => adminInvitationsInviteRevoke(setupGet()))
  await run("sign-out", async () => adminInvitationsSignOut(setupGet()))
})

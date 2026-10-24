import { e2eStepRun } from "../../harness/e2eStepRun.js"
import { e2eTest } from "../../harness/e2eTest.js"
import { adminMemberDeniedAdminBlockedCheck } from "./adminMemberDeniedAdminBlockedCheck.js"
import {
  type AdminMemberDeniedSetup,
  adminMemberDeniedSetupCreate,
  adminMemberDeniedSetupLoad,
} from "./adminMemberDeniedSetupCreate.js"
import { adminMemberDeniedSignIn } from "./adminMemberDeniedSignIn.js"
import { adminMemberDeniedSignOut } from "./adminMemberDeniedSignOut.js"

const stepNames = ["setup", "sign-in", "admin-blocked", "sign-out"] as const

type AdminMemberDeniedStepName = (typeof stepNames)[number]

e2eTest("admin area denies plain organization members", async ({ page }) => {
  const run = (stepName: AdminMemberDeniedStepName, runStep: () => Promise<void>): Promise<void> =>
    e2eStepRun({
      step: async (_title, body) => {
        await body()
      },
      stepName,
      run: runStep,
    })

  await run("setup", async () => {
    await adminMemberDeniedSetupCreate(page)
  })
  const setupLoad = (): AdminMemberDeniedSetup => {
    const reloaded = adminMemberDeniedSetupLoad(page)
    if (reloaded === undefined) throw new Error("adminMemberDenied: the setup step did not complete.")
    return reloaded
  }
  await run("sign-in", async () => adminMemberDeniedSignIn(setupLoad()))
  await run("admin-blocked", async () => adminMemberDeniedAdminBlockedCheck(setupLoad()))
  await run("sign-out", async () => adminMemberDeniedSignOut(setupLoad()))
})

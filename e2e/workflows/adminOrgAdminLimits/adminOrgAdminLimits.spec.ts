import { e2eStepRun } from "../../harness/e2eStepRun.js"
import { e2eTest } from "../../harness/e2eTest.js"
import { adminOrgAdminLimitsBrandingReadOnlyCheck } from "./adminOrgAdminLimitsBrandingReadOnlyCheck.js"
import { adminOrgAdminLimitsRoleChange } from "./adminOrgAdminLimitsRoleChange.js"
import {
  type AdminOrgAdminLimitsSetup,
  adminOrgAdminLimitsSetupCreate,
  adminOrgAdminLimitsSetupLoad,
} from "./adminOrgAdminLimitsSetupCreate.js"
import { adminOrgAdminLimitsSignIn } from "./adminOrgAdminLimitsSignIn.js"
import { adminOrgAdminLimitsSignOut } from "./adminOrgAdminLimitsSignOut.js"
import { adminOrgAdminLimitsUsersListCheck } from "./adminOrgAdminLimitsUsersListCheck.js"

const stepNames = ["setup", "sign-in", "users-list", "branding-read-only", "role-change", "sign-out"] as const

type AdminOrgAdminLimitsStepName = (typeof stepNames)[number]

e2eTest("admin organization admin sees read-only owner settings and cannot grant ownership", async ({ page }) => {
  let setup: AdminOrgAdminLimitsSetup | undefined
  const setupGet = (): AdminOrgAdminLimitsSetup => {
    if (setup !== undefined) return setup
    const reloaded = adminOrgAdminLimitsSetupLoad(page)
    if (reloaded === undefined) throw new Error("adminOrgAdminLimits: the setup step did not complete.")
    setup = reloaded
    return setup
  }
  const run = (stepName: AdminOrgAdminLimitsStepName, runStep: () => Promise<void>): Promise<void> =>
    e2eStepRun({
      step: async (_title, body) => {
        await body()
      },
      stepName,
      run: runStep,
    })

  await run("setup", async () => {
    setup = await adminOrgAdminLimitsSetupCreate(page)
  })
  await run("sign-in", async () => adminOrgAdminLimitsSignIn(page, setupGet()))
  await run("users-list", async () => adminOrgAdminLimitsUsersListCheck(setupGet()))
  await run("branding-read-only", async () => adminOrgAdminLimitsBrandingReadOnlyCheck(setupGet()))
  await run("role-change", async () => adminOrgAdminLimitsRoleChange(setupGet()))
  await run("sign-out", async () => adminOrgAdminLimitsSignOut(setupGet()))
})

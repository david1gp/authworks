import { e2eStepRun } from "../../harness/e2eStepRun.js"
import { e2eTest } from "../../harness/e2eTest.js"
import { adminRealmAdministratorGrantRevoke } from "./adminRealmAdministratorGrantRevoke.js"
import { adminRealmAdministratorOrganizationDetailCheck } from "./adminRealmAdministratorOrganizationDetailCheck.js"
import { adminRealmAdministratorScopeCheck } from "./adminRealmAdministratorScopeCheck.js"
import {
  type AdminRealmAdministratorSetup,
  adminRealmAdministratorSetupCreate,
  adminRealmAdministratorSetupLoad,
} from "./adminRealmAdministratorSetupCreate.js"
import { adminRealmAdministratorSignIn } from "./adminRealmAdministratorSignIn.js"
import { adminRealmAdministratorSignOut } from "./adminRealmAdministratorSignOut.js"

const stepNames = ["setup", "sign-in", "organization-detail", "scope", "grant-revoke", "sign-out"] as const

type AdminRealmAdministratorStepName = (typeof stepNames)[number]

e2eTest("realm administrator switches scope and grants plus revokes realm access", async ({ page }) => {
  let setup: AdminRealmAdministratorSetup | undefined
  const setupGet = (): AdminRealmAdministratorSetup => {
    if (setup !== undefined) return setup
    const reloaded = adminRealmAdministratorSetupLoad(page)
    if (reloaded === undefined) throw new Error("adminRealmAdministrator: the setup step did not complete.")
    setup = reloaded
    return setup
  }
  const run = (stepName: AdminRealmAdministratorStepName, runStep: () => Promise<void>): Promise<void> =>
    e2eStepRun({
      namespace: "adminRealmAdministrator",
      step: async (_title, body) => {
        await body()
      },
      stepName,
      run: runStep,
    })

  await run("setup", async () => {
    setup = await adminRealmAdministratorSetupCreate(page)
  })
  await run("sign-in", async () => adminRealmAdministratorSignIn(page, setupGet()))
  await run("organization-detail", async () => adminRealmAdministratorOrganizationDetailCheck(setupGet()))
  await run("scope", async () => adminRealmAdministratorScopeCheck(setupGet()))
  await run("grant-revoke", async () => adminRealmAdministratorGrantRevoke(setupGet()))
  await run("sign-out", async () => adminRealmAdministratorSignOut(setupGet()))
})

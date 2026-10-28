import { e2eStepRun } from "../../harness/e2eStepRun.js"
import { e2eTest } from "../../harness/e2eTest.js"
import { adminOrgOwnerActivityCheck } from "./adminOrgOwnerActivityCheck.js"
import { adminOrgOwnerBrandingSave } from "./adminOrgOwnerBrandingSave.js"
import { adminOrgOwnerProfileOpen } from "./adminOrgOwnerProfileOpen.js"
import { adminOrgOwnerProjectDetailCheck } from "./adminOrgOwnerProjectDetailCheck.js"
import { adminOrgOwnerProjectRoleAssign } from "./adminOrgOwnerProjectRoleAssign.js"
import { adminOrgOwnerRoleChange } from "./adminOrgOwnerRoleChange.js"
import { adminOrgOwnerRolesPageCheck } from "./adminOrgOwnerRolesPageCheck.js"
import {
  type AdminOrgOwnerSetup,
  adminOrgOwnerSetupCreate,
  adminOrgOwnerSetupLoad,
} from "./adminOrgOwnerSetupCreate.js"
import { adminOrgOwnerSignIn } from "./adminOrgOwnerSignIn.js"
import { adminOrgOwnerSignOut } from "./adminOrgOwnerSignOut.js"
import { adminOrgOwnerUsersListCheck } from "./adminOrgOwnerUsersListCheck.js"

const stepNames = [
  "setup",
  "sign-in",
  "users-list",
  "profile-open",
  "role-change",
  "project-role-assign",
  "roles-page",
  "project-detail",
  "branding-save",
  "activity",
  "sign-out",
] as const

type AdminOrgOwnerStepName = (typeof stepNames)[number]

e2eTest("admin organization owner manages users, roles, projects, and branding", async ({ page }) => {
  let setup: AdminOrgOwnerSetup | undefined
  const setupGet = (): AdminOrgOwnerSetup => {
    if (setup !== undefined) return setup
    const reloaded = adminOrgOwnerSetupLoad(page)
    if (reloaded === undefined) throw new Error("adminOrgOwner: the setup step did not complete.")
    setup = reloaded
    return setup
  }
  const run = (stepName: AdminOrgOwnerStepName, runStep: () => Promise<void>): Promise<void> =>
    e2eStepRun({
      namespace: "adminOrgOwner",
      step: async (_title, body) => {
        await body()
      },
      stepName,
      run: runStep,
    })

  await run("setup", async () => {
    setup = await adminOrgOwnerSetupCreate(page)
  })
  await run("sign-in", async () => adminOrgOwnerSignIn(page, setupGet()))
  await run("users-list", async () => adminOrgOwnerUsersListCheck(setupGet()))
  await run("profile-open", async () => {
    await adminOrgOwnerProfileOpen(setupGet())
  })
  await run("role-change", async () => adminOrgOwnerRoleChange(setupGet()))
  await run("project-role-assign", async () => adminOrgOwnerProjectRoleAssign(setupGet()))
  await run("roles-page", async () => adminOrgOwnerRolesPageCheck(setupGet()))
  await run("project-detail", async () => adminOrgOwnerProjectDetailCheck(setupGet()))
  await run("branding-save", async () => adminOrgOwnerBrandingSave(setupGet()))
  await run("activity", async () => adminOrgOwnerActivityCheck(setupGet()))
  await run("sign-out", async () => adminOrgOwnerSignOut(setupGet()))
})

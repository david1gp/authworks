import type { Page } from "@playwright/test"
import { expect } from "../../harness/e2eExpect.js"
import type { AdminRealmAdministratorSetup } from "./adminRealmAdministratorSetupCreate.js"

/**
 * Signs the service user in through the hosted login. As a realm administrator whose session
 * organization is Authworks Dev (where the service user is owner) it lands on `/admin/users`.
 */
export async function adminRealmAdministratorSignIn(page: Page, setup: AdminRealmAdministratorSetup): Promise<void> {
  // The app may still be settling its own redirect to `/login?return_to=...` from the
  // previous navigation (e.g. session-ensure on orchestrator resume), which interrupts this
  // goto; either login URL ends on the password form, so wait for the field instead.
  await page.goto("/login/password").catch(() => undefined)
  await expect(page.getByLabel("Username or email")).toBeVisible({ timeout: 30_000 })
  await page.getByLabel("Username or email").fill(setup.context.serviceUsername)
  await page.getByLabel("Password", { exact: true }).fill(setup.context.servicePassword)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/admin\/users/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
}

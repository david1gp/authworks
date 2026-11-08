import type { Page } from "@playwright/test"
import { expect } from "../../harness/e2eExpect.js"
import { organizationSlugSuggest } from "../../../src/features/organizations/domain/organizationSlugSuggest.js"
import { adminInvitationsOrgSwitch } from "./adminInvitationsSessionEnsure.js"
import type { AdminInvitationsSetup } from "./adminInvitationsSetupCreate.js"

/**
 * Signs the owner in through the hosted login and lands on the test organization's users
 * page. The hosted login always issues the session in the discovery organization
 * (Authworks Dev on dev), where the owner is a plain member, so the role-aware landing goes
 * to `/account`; the step then switches the browser session to the test org, where the owner
 * is an organization owner. The header org switcher is disabled on `account` and absent on
 * the denied admin page, so the switch uses the shared page-fetch helper.
 */
export async function adminInvitationsSignIn(page: Page, setup: AdminInvitationsSetup): Promise<void> {
  // The app may still be settling its own redirect to `/login?return_to=...` from the
  // previous navigation (e.g. session-ensure on orchestrator resume), which interrupts this
  // goto; either login URL ends on the password form, so wait for the field instead.
  await page.goto("/login/password").catch(() => undefined)
  await expect(page.getByLabel("Username or email")).toBeVisible({ timeout: 30_000 })
  await page.getByLabel("Username or email").fill(setup.ownerUserName)
  await page.getByLabel("Password", { exact: true }).fill(setup.ownerPassword)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/orgs\/[^/]+\/users|\/account/, { timeout: 30_000 })
  if (/\/orgs\//.test(page.url())) {
    // The member-open users page renders for any authenticated organization context, so
    // only the test-organization slug (with no denied panel) counts as already settled.
    const landedSlug = new URL(page.url()).pathname.split("/")[2] ?? ""
    if (
      landedSlug === organizationSlugSuggest(setup.organizationName) &&
      (await page.getByRole("heading", { name: "Access unavailable" }).count()) === 0
    )
      return
  }

  await adminInvitationsOrgSwitch(page, setup)
  await page.goto("/admin/users")
  await page.waitForURL(/\/orgs\/[^/]+\/users/, { timeout: 30_000 })
  await expect(page).toHaveURL(new RegExp(`/orgs/${organizationSlugSuggest(setup.organizationName)}/users`))
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
}

import type { Page } from "@playwright/test"
import { expect } from "../../harness/e2eExpect.js"
import type { AdminOrgAdminLimitsSetup } from "./adminOrgAdminLimitsSetupCreate.js"
import { adminOrgAdminLimitsSignIn } from "./adminOrgAdminLimitsSignIn.js"

/**
 * Switches the browser session to the test organization through the same
 * `me/organizations/switch` endpoint the shell header uses. The header switcher is disabled
 * on `account` and absent on the denied admin page, so the switch runs via the page's own
 * fetch (session cookies are attached automatically; the CSRF token is read first).
 */
export async function adminOrgAdminLimitsOrgSwitch(page: Page, setup: AdminOrgAdminLimitsSetup): Promise<void> {
  const switched: { ok: boolean; status: number } = await page.evaluate(
    async ({ organizationId, realmId }) => {
      const csrfResponse = await fetch(`/realms/${encodeURIComponent(realmId)}/sessions/csrf`, {
        credentials: "include",
        method: "GET",
      })
      const csrfBody = (await csrfResponse.json()) as { csrfToken?: string }
      if (typeof csrfBody.csrfToken !== "string") return { ok: false, status: csrfResponse.status }
      const switchResponse = await fetch(`/realms/${encodeURIComponent(realmId)}/me/organizations/switch`, {
        body: JSON.stringify({ organizationId }),
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-authworks-browser-mode": "true",
          "x-csrf-token": csrfBody.csrfToken,
        },
        method: "POST",
      })
      return { ok: switchResponse.ok, status: switchResponse.status }
    },
    { organizationId: setup.organizationId, realmId: setup.realmId },
  )
  if (!switched.ok)
    throw new Error(`adminOrgAdminLimits: the organization switch to the test org failed (status ${switched.status}).`)
}

/**
 * Ensures the page holds an authenticated admin session in the test organization. Orchestrator
 * resume re-runs the spec with a fresh browser profile while skipping completed steps, so UI
 * steps after `sign-in` must re-authenticate when the session is gone. Navigates to
 * `/admin/users`; performs the full sign-in when redirected to login, or switches the session
 * to the test org when the denied panel shows. Leaves the page on `/admin/users`; steps that
 * need a deeper page navigate from there.
 */
export async function adminOrgAdminLimitsSessionEnsure(setup: AdminOrgAdminLimitsSetup): Promise<void> {
  const page = setup.context.page
  await page.goto("/admin/users")
  await page.waitForURL(/\/admin\/users|\/login/, { timeout: 30_000 })
  // The guard bounces to /login asynchronously after the session check resolves, so the
  // URL sampled right after navigation can still be /admin/users on a signed-out page.
  // Wait for a settled marker before branching.
  const usersHeading = page.getByRole("heading", { name: "Users" }).first()
  const deniedHeading = page.getByRole("heading", { name: "Access unavailable" })
  const loginMarker = page.getByRole("heading", { name: "Choose a method" }).or(page.getByLabel("Username or email"))
  await expect(usersHeading.or(deniedHeading).or(loginMarker)).toBeVisible({ timeout: 30_000 })
  if (/\/login/.test(page.url())) {
    await adminOrgAdminLimitsSignIn(page, setup)
    return
  }
  if ((await page.getByRole("heading", { name: "Access unavailable" }).count()) > 0) {
    await adminOrgAdminLimitsOrgSwitch(page, setup)
    await page.goto("/admin/users")
  }
  await page.waitForURL(/\/admin\/users/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Users" }).first()).toBeVisible()
}

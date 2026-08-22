import { expect, test } from "@playwright/test"

const activeUserId = "01900000-0000-7000-8000-000000000021"
const inactiveUserId = "01900000-0000-7000-8000-000000000022"
const sessionId = "01900000-0000-7000-8000-0000000000e1"

test("eligible user details open guarded impersonation controls", async ({ page }) => {
  await page.goto(`/demo/admin/users/${activeUserId}`)

  const action = page.getByRole("link", { name: "Impersonate this user", exact: true })
  await expect(action).toBeVisible()
  await action.click()

  await expect(page).toHaveURL(new RegExp(`/demo/admin/impersonation\\?userId=${activeUserId}$`))
  await expect(page.getByLabel("User to impersonate", { exact: true })).toHaveValue(activeUserId)

  await page.goto(`/demo/admin/users/${inactiveUserId}`)
  await expect(page.getByRole("link", { name: "Impersonate this user", exact: true })).toHaveCount(0)
})

test("guarded fixtures prohibit unavailable impersonation", async ({ page }) => {
  await page.goto("/demo/admin/impersonation?state=permission-denied")
  await expect(page.getByRole("heading", { name: "Access unavailable", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Start impersonation", exact: true })).toHaveCount(0)

  await page.goto("/demo/admin/impersonation?state=assurance-required")
  await expect(page.getByRole("heading", { name: "Stronger sign-in required", exact: true })).toBeVisible()

  await page.goto("/demo/admin/impersonation?state=nested-rejected")
  await expect(page.getByRole("heading", { name: "Nested impersonation is not allowed", exact: true })).toBeVisible()
  await expect(page.locator("[data-impersonation-banner]")).toBeVisible()
})

test("a reasoned impersonation exposes its outcome, audit events, and end action", async ({ page }) => {
  await page.goto(`/demo/admin/impersonation?userId=${activeUserId}`)
  await page.getByLabel("Reason", { exact: true }).fill("Ticket NW-4821: reproduce the reported checkout failure.")
  await page.getByLabel("Duration", { exact: true }).selectOption("300")
  await page.getByRole("button", { name: "Start impersonation", exact: true }).click()

  await expect(page.getByRole("status").filter({ hasText: "You are now acting as Alex Morgan." })).toBeVisible()
  await expect(page.locator("[data-impersonation-banner]")).toContainText("Robin Vale is acting as Alex Morgan")
  await expect(page.locator("[data-impersonation-banner]")).toContainText("5:00")

  const auditLink = page
    .getByRole("link", {
      name: "View the audit events for this impersonation",
      exact: true,
    })
    .first()
  await expect(auditLink).toHaveAttribute("href", `/demo/admin/events?q=${sessionId}`)
  await auditLink.click()
  await expect(page.getByText("impersonation.started", { exact: true })).toBeVisible()
  await expect(page.getByText("impersonation.ended", { exact: true })).toBeVisible()

  await page.goto("/demo/admin/impersonation?state=active")
  await page.locator("[data-impersonation-banner]").getByRole("button", { name: "End impersonation" }).click()
  await expect(page.getByRole("status")).toContainText("The impersonation session was ended.")
  await expect(page.locator("[data-impersonation-banner]")).toHaveCount(0)
})

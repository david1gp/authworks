import { expect, test } from "@playwright/test"

const networkRequestsCollect = (page: import("@playwright/test").Page) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr") requests.push(request.url())
  })
  return requests
}

test("the administrator sign-in demo exchanges a credential without storing it", async ({ page }) => {
  const requests = networkRequestsCollect(page)
  await page.goto("/demo/admin/sign-in")

  await expect(page.getByRole("heading", { level: 1, name: "Administrator sign-in", exact: true })).toBeVisible()
  const credential = page.getByLabel("Bootstrap administrator credential", { exact: true })
  await expect(credential).toHaveAttribute("type", "password")

  await credential.fill("short")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("complete bootstrap administrator credential")

  await credential.fill("d".repeat(48))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()
  await expect(page.getByText("bootstrap_admin", { exact: true })).toBeVisible()
  // The credential must not survive the exchange in the field or in browser storage.
  await expect(credential).toHaveCount(0)
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(stored).not.toContain("dddd")
  expect(requests).toEqual([])
})

test("the administrator session demo can be ended", async ({ page }) => {
  await page.goto("/demo/admin/sign-in")
  await page.getByLabel("Bootstrap administrator credential", { exact: true }).fill("d".repeat(48))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible()
})

test("sign-in demo loading, error, and expiry states are URL-selectable", async ({ page }) => {
  await page.goto("/demo/admin/sign-in?state=loading")
  await expect(page.locator("[data-content-state='loading']")).toBeVisible()

  await page.goto("/demo/admin/sign-in?state=error")
  await page.getByLabel("Bootstrap administrator credential", { exact: true }).fill("d".repeat(48))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("bootstrap administrator credentials are invalid")

  await page.goto("/demo/admin/sign-in?state=expired")
  await expect(page.getByRole("heading", { level: 1, name: "Administrator sign-in", exact: true })).toBeVisible()
})

test("the realm overview demo renders realm identity, domains, and the admin session", async ({ page }) => {
  const requests = networkRequestsCollect(page)
  await page.goto("/demo/admin/overview")

  await expect(page.getByRole("heading", { name: "Northwind customer identity", exact: true })).toBeVisible()
  await expect(page.getByText("auth.northwind.example", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("login.northwind.example", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Administrator session", exact: true })).toBeVisible()
  expect(requests).toEqual([])
})

test("realm overview demo loading, error, and expiry states are URL-selectable", async ({ page }) => {
  await page.goto("/demo/admin/overview?state=loading")
  await expect(page.locator("[data-content-state='loading']")).toBeVisible()

  await page.goto("/demo/admin/overview?state=error")
  await expect(page.locator("[data-content-state='error']")).toBeVisible()

  await page.goto("/demo/admin/overview?state=expired")
  await expect(page.locator("[data-content-state='inaccessible']")).toBeVisible()
})

test("realm settings demo saves changes and requires a destructive confirmation", async ({ page }) => {
  const requests = networkRequestsCollect(page)
  await page.goto("/demo/admin/realm")

  await page.getByLabel("Realm name", { exact: true }).fill("Renamed realm")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("saved")

  await page.getByLabel("Status", { exact: true }).selectOption("disabled")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Disabling this realm stops sign-in for every application in it. Continue?")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("button", { name: "Disable realm", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("saved")
  await expect(page.getByRole("button", { name: "Enable realm", exact: true })).toBeVisible()
  expect(requests).toEqual([])
})

test("realm settings demo exposes permission, error, and expiry states", async ({ page }) => {
  await page.goto("/demo/admin/realm?state=permission-denied")
  await page.getByRole("button", { name: "Save settings", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("do not have permission")

  await page.goto("/demo/admin/realm?state=error")
  await expect(page.locator("[data-content-state='error']")).toBeVisible()

  await page.goto("/demo/admin/realm?state=expired")
  await expect(page.locator("[data-content-state='inaccessible']")).toBeVisible()
})

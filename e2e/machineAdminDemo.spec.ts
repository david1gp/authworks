import { expect, test } from "@playwright/test"

const machineUserId = "01900000-0000-7000-8000-000000000071"
const detailBase = `/demo/admin/machine-users/${machineUserId}`

test("the machine user directory lists fixtures and creates a service identity offline", async ({ page }) => {
  await page.goto("/demo/admin/machine-users")

  await expect(page.getByRole("heading", { level: 1, name: "Machine user directory", exact: true })).toBeVisible()
  // Machine users render as a wide table on desktop and as a stacked record list on mobile; assert the visible one.
  await expect(page.getByRole("table").getByText("Billing Sync Service", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Nightly Report Exporter", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Legacy Provisioning Agent", { exact: true })).toBeVisible()

  await page.getByLabel("Search machine users", { exact: true }).fill("report")
  await expect(page).toHaveURL(/q=report/)
  await expect(page.getByRole("table").getByText("Billing Sync Service", { exact: true })).toHaveCount(0)

  await page.getByLabel("Search machine users", { exact: true }).fill("")
  await page.getByRole("button", { name: "Create machine user", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(page).toHaveURL(/dialog=machine-user/)
  await dialog.getByLabel("Display name", { exact: true }).fill("E2E Service")
  await dialog.getByLabel("User name", { exact: true }).fill("e2e-service")
  await dialog.getByLabel("Scopes", { exact: true }).fill("reports.read")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("table").getByText("E2E Service", { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/dialog=/)
})

test("creating a machine user shows the client credentials once and gates acknowledgement", async ({ page }) => {
  await page.goto("/demo/admin/machine-users")

  await page.getByRole("button", { name: "Create machine user", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Display name", { exact: true }).fill("Secret Service")
  await dialog.getByLabel("User name", { exact: true }).fill("secret-service")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("only time")
  // A client-credentials pair is only usable together, so both halves are presented.
  await expect(panel.locator("[data-client-id]")).toContainText("secret-service")
  const secret = await panel.locator("[data-secret-value]").innerText()
  expect(secret.length).toBeGreaterThan(10)

  await expect(panel.getByRole("button", { name: "I have stored the secret", exact: true })).toBeDisabled()
  await panel.getByRole("button", { name: "Copy secret", exact: true }).click()
  await panel.getByRole("button", { name: "I have stored the secret", exact: true }).click()

  await expect(panel).toHaveCount(0)
  // The issued value is not recoverable: it never reappears after acknowledgement.
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

test("a machine user created in the directory opens on its generated detail route", async ({ page }) => {
  await page.goto("/demo/admin/machine-users")

  await page.getByRole("button", { name: "Create machine user", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Display name", { exact: true }).fill("Routed Service")
  await dialog.getByLabel("User name", { exact: true }).fill("routed-service")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await panel.getByRole("button", { name: "Copy secret", exact: true }).click()
  await panel.getByRole("button", { name: "I have stored the secret", exact: true }).click()

  // The generated identifier must resolve: the directory and the detail route share one demo state.
  await page.getByRole("table").getByRole("button", { name: "Routed Service", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Routed Service", exact: true })).toBeVisible()
  await expect(page.locator("[data-content-state='error']")).toHaveCount(0)
  await expect(page.getByText("routed-service", { exact: true }).first()).toBeVisible()
})

test("issuing a credential from the overview presents the value, copy, and acknowledgement", async ({ page }) => {
  await page.goto("/demo/admin/machine-credentials")

  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name", { exact: true }).fill("Overview Token")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  // Closing the issue dialog only changes the URL, so it must not discard the one-time value.
  await expect(page).not.toHaveURL(/dialog=/)
  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-secret-value]")).toContainText("demo-secret-")
  await expect(panel.getByRole("button", { name: "I have stored the secret", exact: true })).toBeDisabled()

  await panel.getByRole("button", { name: "Copy secret", exact: true }).click()
  await panel.getByRole("button", { name: "I have stored the secret", exact: true }).click()
  await expect(panel).toHaveCount(0)
})

test("the machine user detail keeps the stored client secret redacted until rotation", async ({ page }) => {
  await page.goto(detailBase)

  await expect(page.getByRole("heading", { name: "Billing Sync Service", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Client secret", exact: true })).toBeVisible()
  await expect(page.locator("[data-secret-redacted]")).toContainText("Stored and hidden")
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await page.getByRole("button", { name: "Rotate client secret", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText(
    "Rotate this client secret? The current secret stops working immediately and cannot be recovered.",
  )
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator("[data-secret-redacted]")).toContainText("Stored and hidden")

  await page.getByRole("button", { name: "Rotate client secret", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("New client secret")
  await expect(panel.locator("[data-secret-value]")).toContainText("demo-secret-")
  await expect(page.getByRole("status")).toContainText("rotated")
})

test("the credential list shows kind, expiry, and revocation states without any value", async ({ page }) => {
  await page.goto(detailBase)

  await expect(page.getByRole("heading", { name: "Credentials and tokens", exact: true })).toBeVisible()

  const clientSecretRow = page.getByRole("row").filter({ hasText: "Client secret" }).first()
  await expect(clientSecretRow).toContainText("Does not expire")
  await expect(clientSecretRow).toContainText("Active")

  const patRow = page.getByRole("row").filter({ hasText: "Deployment pipeline token" })
  await expect(patRow).toContainText("Personal access token")
  await expect(patRow).toContainText("Active")

  // Expiry is derived against a fixed fixture "now", so the state is deterministic.
  const expiredRow = page.getByRole("row").filter({ hasText: "Expired reporting key" })
  await expect(expiredRow).toContainText("API key")
  await expect(expiredRow).toContainText("Expired")

  const revokedRow = page.getByRole("row").filter({ hasText: "Revoked integration key" })
  await expect(revokedRow).toContainText("Revoked")
  // Revocation is final, so a revoked credential offers no further action.
  await expect(revokedRow.getByRole("button", { name: "Revoke", exact: true })).toHaveCount(0)

  // Credential metadata is listed, but a stored value is never rendered.
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

test("issuing a personal access token shows the value once and lists its metadata", async ({ page }) => {
  await page.goto(detailBase)

  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Credential type", { exact: true }).selectOption("personal_access_token")
  await dialog.getByLabel("Name", { exact: true }).fill("E2E Pipeline Token")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toContainText("New personal access token")
  await expect(panel.locator("[data-secret-value]")).toContainText("demo-secret-")
  await expect(page.getByRole("status")).toContainText("personal access token was issued")

  const row = page.getByRole("row").filter({ hasText: "E2E Pipeline Token" })
  await expect(row).toContainText("Personal access token")
  // With no expiry supplied the credential is issued as non-expiring.
  await expect(row).toContainText("Does not expire")
})

test("issuing an API key with an expiry records the expiry date", async ({ page }) => {
  await page.goto(detailBase)

  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Credential type", { exact: true }).selectOption("api_key")
  await dialog.getByLabel("Name", { exact: true }).fill("E2E Integration Key")
  await dialog.getByLabel("Expires", { exact: true }).fill("2030-01-01")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toContainText("New API key")
  await expect(page.getByRole("status")).toContainText("API key was issued")

  const row = page.getByRole("row").filter({ hasText: "E2E Integration Key" })
  await expect(row).toContainText("API key")
  await expect(row).not.toContainText("Does not expire")
})

test("a past expiry date is rejected before any credential is issued", async ({ page }) => {
  await page.goto(detailBase)

  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name", { exact: true }).fill("Backdated Token")
  await dialog.getByLabel("Expires", { exact: true }).fill("2000-01-01")
  await dialog.getByRole("button", { name: "Issue credential", exact: true }).click()

  await expect(dialog.getByRole("alert")).toContainText("future")
  await expect(page.locator("[data-one-time-secret='machine-credential']")).toHaveCount(0)
})

test("revoking a credential marks it revoked and removes its action", async ({ page }) => {
  await page.goto(detailBase)

  const row = page.getByRole("row").filter({ hasText: "Deployment pipeline token" })
  await row.getByRole("button", { name: "Revoke", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Revoke this credential? Anything using it stops working immediately.")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(row).toContainText("Active")

  await row.getByRole("button", { name: "Revoke", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page.getByRole("status")).toContainText("revoked")
  await expect(row).toContainText("Revoked")
  await expect(row.getByRole("button", { name: "Revoke", exact: true })).toHaveCount(0)
})

test("machine user lifecycle changes are reflected immediately", async ({ page }) => {
  await page.goto(detailBase)

  await page.getByRole("button", { name: "Deactivate", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("status was changed")
  await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Activate", exact: true }).click()
  await expect(page.getByRole("button", { name: "Deactivate", exact: true })).toBeVisible()
})

test("removing a machine user returns to the directory", async ({ page }) => {
  await page.goto(detailBase)

  await page.getByRole("button", { name: "Remove machine user", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this action", exact: true })).toBeVisible()
  await expect(confirmation).toContainText(
    "Remove this machine user? Every credential it owns stops working immediately and cannot be restored.",
  )
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Billing Sync Service", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Remove machine user", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page).toHaveURL(/\/demo\/admin\/machine-users$/)
  await expect(page.getByRole("heading", { level: 1, name: "Machine user directory", exact: true })).toBeVisible()
})

test("the credential overview scopes the list to a selected machine user", async ({ page }) => {
  await page.goto("/demo/admin/machine-credentials")

  await expect(page.getByRole("heading", { level: 1, name: "Credentials and tokens", exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Deployment pipeline token", { exact: true })).toBeVisible()

  await page.getByLabel("Machine user", { exact: true }).selectOption({ label: "Nightly Report Exporter" })
  await expect(page).toHaveURL(/machineUserId=/)

  // Only the selected subject's credentials remain listed.
  await expect(page.getByRole("table").getByText("Deployment pipeline token", { exact: true })).toHaveCount(0)
})

test("the one-time demo state renders an already issued secret directly from the URL", async ({ page }) => {
  await page.goto("/demo/admin/machine-users?state=one-time")

  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-secret-value]")).toContainText("demo-machine-secret-")
  await expect(panel.locator("[data-client-id]")).toContainText("billing-sync")
})

test("the redacted demo state never reveals the stored client secret", async ({ page }) => {
  await page.goto(`${detailBase}?state=redacted`)

  await expect(page.locator("[data-secret-redacted]")).toContainText("Stored and hidden")
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

const stateDestinations = {
  "machine-credentials": "/demo/admin/machine-credentials",
  "machine-user-detail": detailBase,
  "machine-users": "/demo/admin/machine-users",
} as const

for (const [name, path] of Object.entries(stateDestinations)) {
  test(`the ${name} destination exposes URL-selectable fixture states`, async ({ page }) => {
    await page.goto(`${path}?state=error`)
    await expect(page.locator("[data-content-state='error']")).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible()

    await page.goto(`${path}?state=loading`)
    await expect(page.locator("[data-content-state='loading']")).toBeVisible()

    await page.goto(`${path}?state=permission-denied`)
    await expect(page.locator("[data-content-state='inaccessible']")).toContainText("permission")

    await page.goto(`${path}?state=expired`)
    await expect(page.locator("[data-content-state='inaccessible']")).toContainText("stronger")

    await page.goto(`${path}?state=cross-tenant`)
    await expect(page.locator("[data-content-state='inaccessible']")).toContainText("different realm")
  })
}

for (const path of ["/demo/admin/machine-users", "/demo/admin/machine-credentials"]) {
  test(`the ${path} collection exposes an empty state`, async ({ page }) => {
    await page.goto(`${path}?state=empty`)
    await expect(page.locator("[data-content-state='empty']")).toBeVisible()
  })
}

test("machine destinations are reachable from the demo directory", async ({ page }) => {
  await page.goto("/demo/admin")

  await expect(page.getByRole("heading", { name: "Machine users", exact: true })).toBeVisible()
  for (const title of ["Machine user directory", "Machine user detail", "Credentials and tokens"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
  }
})

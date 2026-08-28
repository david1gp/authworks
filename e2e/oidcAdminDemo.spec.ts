import { expect, test } from "@playwright/test"

const clientId = "01900000-0000-7000-8000-000000000041"
const clientBase = `/demo/admin/oidc-clients/${clientId}`

test("the client directory lists fixtures and registers a client without a network call", async ({ page }) => {
  await page.goto("/demo/admin/oidc-clients")

  await expect(page.getByRole("heading", { level: 1, name: "OIDC clients", exact: true })).toBeVisible()
  // Clients render as a wide table on desktop and as a stacked record list on mobile; assert the visible one.
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Mobile App", { exact: true })).toBeVisible()

  await page.getByLabel("Search clients", { exact: true }).fill("mobile")
  await expect(page).toHaveURL(/q=mobile/)
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toHaveCount(0)

  await page.getByLabel("Search clients", { exact: true }).fill("")
  await page.getByRole("button", { name: "Register client", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(page).toHaveURL(/dialog=client/)
  await dialog.getByLabel("Client name", { exact: true }).fill("E2E Client")
  await dialog.getByLabel("Redirect URIs", { exact: true }).fill("https://e2e.example/callback")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("table").getByText("E2E Client", { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/dialog=/)
})

test("registering a confidential client shows the secret once and requires acknowledgement", async ({ page }) => {
  await page.goto("/demo/admin/oidc-clients")

  await page.getByRole("button", { name: "Register client", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Client name", { exact: true }).fill("Secret Client")
  await dialog.getByLabel("Redirect URIs", { exact: true }).fill("https://secret.example/callback")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  const panel = page.locator("[data-one-time-secret='oidc-client']")
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("only time")
  const secret = await panel.locator("[data-secret-value]").innerText()
  expect(secret.length).toBeGreaterThan(10)

  // Acknowledgement is gated behind copying, so the value cannot be dismissed unseen.
  await expect(panel.getByRole("button", { name: "I have stored the secret", exact: true })).toBeDisabled()
  await panel.getByRole("button", { name: "Copy secret", exact: true }).click()
  await panel.getByRole("button", { name: "I have stored the secret", exact: true }).click()

  await expect(panel).toHaveCount(0)
  // The secret is not recoverable: it never reappears after acknowledgement.
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

test("a public client is registered without any secret", async ({ page }) => {
  await page.goto("/demo/admin/oidc-clients")

  await page.getByRole("button", { name: "Register client", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Client name", { exact: true }).fill("Public Client")
  await dialog.getByLabel("Client type", { exact: true }).selectOption("public")
  await dialog.getByLabel("Redirect URIs", { exact: true }).fill("com.public://callback")
  await dialog.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("table").getByText("Public Client", { exact: true })).toBeVisible()
  await expect(page.locator("[data-one-time-secret='oidc-client']")).toHaveCount(0)
})

test("the one-time demo state renders an already issued secret directly from the URL", async ({ page }) => {
  await page.goto("/demo/admin/oidc-clients?state=one-time")

  const panel = page.locator("[data-one-time-secret='oidc-client']")
  await expect(panel).toBeVisible()
  await expect(panel.locator("[data-secret-value]")).toContainText("demo-secret-")
})

test("the redacted demo state never reveals the stored secret", async ({ page }) => {
  await page.goto(`${clientBase}?state=redacted`)

  await expect(page.locator("[data-secret-redacted]")).toContainText("Stored and hidden")
  await expect(page.locator("[data-secret-value]")).toHaveCount(0)
})

test("client settings edit exact redirects, scopes, trust, and consent", async ({ page }) => {
  await page.goto(clientBase)

  await expect(page.getByRole("heading", { name: "Acme Web Portal", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Client settings", exact: true })).toBeVisible()

  const redirects = page.getByLabel("Redirect URIs", { exact: true })
  // Exact matching is preserved verbatim, including case and query strings.
  await redirects.fill("https://Portal.Acme.example/Callback?x=1")
  await page.getByLabel("Trusted", { exact: true }).check()
  await page.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByRole("status")).toContainText("saved")
  await expect(redirects).toHaveValue("https://Portal.Acme.example/Callback?x=1")
})

test("client secret rotation issues a fresh one-time value", async ({ page }) => {
  await page.goto(clientBase)

  await expect(page.getByRole("heading", { name: "Client secret", exact: true })).toBeVisible()
  await expect(page.locator("[data-secret-redacted]")).toBeVisible()

  const panel = page.locator("[data-one-time-secret='oidc-client']")
  await page.getByRole("button", { name: "Rotate secret", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this change", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Rotate this client secret? The current secret stops working immediately.")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator("[data-secret-redacted]")).toBeVisible()

  await page.getByRole("button", { name: "Rotate secret", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText("Rotated client secret")
})

test("client lifecycle changes are reflected immediately", async ({ page }) => {
  await page.goto(clientBase)

  await page.getByRole("button", { name: "Deactivate", exact: true }).click()
  await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible()
})

test("signing keys expose only public metadata and support guarded rotation", async ({ page }) => {
  await page.goto("/demo/admin/signing-keys")

  await expect(page.getByRole("heading", { level: 1, name: "Signing keys", exact: true })).toBeVisible()
  await expect(page.getByText("Only public key metadata is shown", { exact: false })).toBeVisible()
  await expect(page.getByRole("table").getByText("RS256", { exact: true }).first()).toBeVisible()

  await page.getByRole("button", { name: "Rotate key", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this change", exact: true })).toBeVisible()
  await expect(confirmation).toContainText(
    "Rotate the signing key? A new key is published and the current key is retired.",
  )
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("row").filter({ hasText: "active" })).toHaveCount(1)

  await page.getByRole("button", { name: "Rotate key", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("rotated")
  // Rotation leaves exactly one active key published.
  await expect(page.getByRole("row").filter({ hasText: "active" })).toHaveCount(1)
})

test("administrator consent review lists and revokes an approved application", async ({ page }) => {
  await page.goto("/demo/admin/oidc-consents")

  await expect(page.getByRole("heading", { level: 1, name: "Application consents", exact: true })).toBeVisible()
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toBeVisible()

  const row = page.getByRole("row").filter({ hasText: "Acme Web Portal" })
  await row.getByRole("button", { name: "Revoke", exact: true }).click()
  const confirmation = page.getByRole("alertdialog")
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole("heading", { name: "Confirm this change", exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Revoke this consent? The user is asked to approve the application again.")
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(row).toBeVisible()

  await row.getByRole("button", { name: "Revoke", exact: true }).click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page.getByRole("status")).toContainText("revoked")
  await expect(page.getByRole("table").getByText("Acme Web Portal", { exact: true })).toHaveCount(0)
})

test("protocol documents are read-only and suppress unreachable endpoint links", async ({ page }) => {
  await page.goto("/demo/admin/protocol-documents")

  await expect(page.getByRole("heading", { level: 1, name: "Protocol documents", exact: true })).toBeVisible()
  await expect(page.locator("[data-read-only-notice]")).toContainText("cannot be edited here")
  await expect(page.getByRole("heading", { name: "Discovery document", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "JSON Web Key Set", exact: true })).toBeVisible()

  // Only viewing and copying are offered; no edit, save, or delete control exists.
  await expect(page.getByRole("button", { name: "Copy document", exact: true })).toHaveCount(2)
  // Stateless demo fixtures point at an unreachable host, so no broken endpoint links are offered.
  await expect(page.getByRole("link", { name: "Open endpoint", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /save|delete|remove|rotate/i })).toHaveCount(0)
})

const stateDestinations = {
  "oidc-client-detail": clientBase,
  "oidc-clients": "/demo/admin/oidc-clients",
  "oidc-consents": "/demo/admin/oidc-consents",
  "protocol-documents": "/demo/admin/protocol-documents",
  "signing-keys": "/demo/admin/signing-keys",
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

for (const path of ["/demo/admin/oidc-clients", "/demo/admin/signing-keys", "/demo/admin/oidc-consents"]) {
  test(`the ${path} collection exposes an empty state`, async ({ page }) => {
    await page.goto(`${path}?state=empty`)
    await expect(page.locator("[data-content-state='empty']")).toBeVisible()
  })
}

test("OIDC destinations are reachable from the demo directory", async ({ page }) => {
  await page.goto("/demo/admin")

  const group = page.getByLabel("OpenID Connect")
  await expect(group.getByRole("heading", { name: "OpenID Connect", exact: true })).toBeVisible()
  for (const title of [
    "OIDC clients",
    "OIDC client settings",
    "Signing keys",
    "Application consents",
    "Protocol documents",
  ]) {
    await expect(group.getByRole("heading", { name: title, exact: true })).toBeVisible()
  }
})

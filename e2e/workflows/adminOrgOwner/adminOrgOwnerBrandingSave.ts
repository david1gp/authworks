import { expect } from "../../harness/e2eExpect.js"
import { adminOrgOwnerSessionEnsure } from "./adminOrgOwnerSessionEnsure.js"
import type { AdminOrgOwnerSetup } from "./adminOrgOwnerSetupCreate.js"

/**
 * Changes the light primary colour on the branding page, verifies the sign-in preview
 * updates from the form value, saves, and verifies persistence across reload.
 */
export async function adminOrgOwnerBrandingSave(setup: AdminOrgOwnerSetup): Promise<void> {
  const page = setup.context.page
  await adminOrgOwnerSessionEnsure(setup)
  const nextColor = "#7c3aed"
  await page.goto("/admin/configuration/branding")
  await expect(page.getByRole("heading", { name: "Configuration" }).first()).toBeVisible()

  const colorInput = page.locator("#configuration-branding-light-primaryColor")
  await expect(colorInput).toBeVisible()
  await expect(colorInput).toBeEnabled()
  await colorInput.fill(nextColor)

  const preview = page.getByText("Sign-in preview").locator("..").locator("..")
  await expect(preview.locator(`span[style*="${nextColor}"]`).first()).toBeVisible()

  await page.getByRole("button", { name: "Save" }).last().click()
  await expect(page.getByText("Branding was saved.")).toBeVisible()

  await page.reload()
  await expect(page.locator("#configuration-branding-light-primaryColor")).toHaveValue(nextColor)
}

import { expect, test } from "@playwright/test"

test("the email directory opens each fixture-backed renderer preview", async ({ page }) => {
  await page.goto("/demo/emails")

  await expect(page.getByRole("heading", { name: "Email previews", exact: true })).toBeVisible()
  await expect(page.getByText("EmailVerificationRenderRequest", { exact: true })).toBeVisible()
  await expect(page.getByText("EmailOtpRenderRequest", { exact: true })).toBeVisible()
  await expect(page.getByText("EmailRecoveryRenderRequest", { exact: true })).toBeVisible()
  await expect(page.getByText("OrganizationInvitationRenderRequest", { exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Open preview" }).first().click()
  await expect(page).toHaveURL(/\/demo\/emails\/verification$/)
  await expect(page.getByRole("heading", { name: "Email verification", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Text alternative", exact: true })).toBeVisible()
  await expect(page.getByText("member@example.test", { exact: true })).toBeVisible()

  const preview = page.getByTitle("Email verification — HTML preview")
  await expect(preview).toHaveAttribute("sandbox", "")
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer")
  await expect(preview.contentFrame().getByRole("heading", { name: "Verify your email address" })).toBeVisible()

  for (const fixture of [
    { heading: "One-time password", id: "otp", renderedHeading: "Your sign-in code is 123456" },
    { heading: "Password recovery", id: "recovery", renderedHeading: "Reset your password" },
    {
      heading: "Organization invitation",
      id: "organization-invitation",
      renderedHeading: "Join Preview Organization",
    },
  ]) {
    await page.goto(`/demo/emails/${fixture.id}`)
    await expect(page.getByRole("heading", { name: fixture.heading, exact: true })).toBeVisible()
    await expect(
      page.getByTitle(`${fixture.heading} — HTML preview`).contentFrame().getByRole("heading", {
        name: fixture.renderedHeading,
      }),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Text alternative", exact: true })).toBeVisible()
  }
})

test("email previews remain usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/demo/emails/organization-invitation")

  await expect(page.getByRole("heading", { name: "Organization invitation", exact: true })).toBeVisible()
  await expect(page.getByText("Preview Administrator invited you", { exact: false })).toBeVisible()
  await expect(page.getByTitle("Organization invitation — HTML preview")).toBeVisible()
})

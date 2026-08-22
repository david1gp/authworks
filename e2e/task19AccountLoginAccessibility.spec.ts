import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Locator, test } from "@playwright/test"

const viewports = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
] as const

test("account destructive actions require keyboard-operable confirmation", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto("/demo/account/consents")
    const consent = page.getByRole("button", { name: "Revoke", exact: true }).first()

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Revoke access for analytics-dashboard?")
      await dialog.dismiss()
    })
    await consent.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("heading", { name: "analytics-dashboard" })).toBeVisible()

    page.once("dialog", (dialog) => void dialog.accept())
    await consent.press("Enter")
    await expect(page.getByRole("heading", { name: "analytics-dashboard" })).toHaveCount(0)

    await page.goto("/demo/account/sessions")
    const session = page.getByRole("button", { name: "Revoke session", exact: true })
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Revoke this session immediately?")
      await dialog.dismiss()
    })
    await session.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByText("Safari on iPhone", { exact: true })).toBeVisible()

    page.once("dialog", (dialog) => void dialog.accept())
    await session.press("Enter")
    await expect(page.getByText("Safari on iPhone", { exact: true })).toHaveCount(0)
  }
})

test("account identity unlink and invitation decline confirmations guard fixture mutations", async ({ page }) => {
  await page.goto("/demo/account/identities")
  const identity = page.getByRole("button", { name: "Unlink", exact: true }).first()

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Unlink this external account?")
    await dialog.dismiss()
  })
  await identity.click()
  await expect(page.getByRole("heading", { name: "github", exact: true })).toBeVisible()

  page.once("dialog", (dialog) => void dialog.accept())
  await identity.click()
  await expect(page.getByRole("heading", { name: "github", exact: true })).toHaveCount(0)

  await page.goto("/demo/invitations/accept?state=success")
  const decline = page.getByRole("button", { name: "Decline", exact: true })

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Decline this invitation?")
    await dialog.dismiss()
  })
  await decline.click()
  await expect(decline).toBeVisible()

  page.once("dialog", (dialog) => void dialog.accept())
  await decline.click()
  await expect(page.getByRole("heading", { name: "Invitation declined", exact: true })).toBeVisible()
})

test("password and consent controls meet text contrast at desktop and mobile sizes", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto("/demo/login/password")
    await expect(
      elementContrastRatioGet(page.getByRole("button", { name: "Sign in", exact: true })),
    ).resolves.toBeGreaterThanOrEqual(4.5)
    await expect(elementContrastRatioGet(page.locator("main > p"))).resolves.toBeGreaterThanOrEqual(4.5)

    await page.goto("/demo/account/consents")
    await expect(
      elementContrastRatioGet(page.getByRole("button", { name: "Revoke", exact: true }).first()),
    ).resolves.toBeGreaterThanOrEqual(4.5)
  }
})

test("representative login and account demos have no serious axe violations", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const path of ["/demo/login/password", "/demo/account/consents"]) {
      await page.goto(path)
      const accessibility = await new AxeBuilder({ page }).analyze()
      expect(
        accessibility.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        ),
      ).toEqual([])
    }
  }
})

test("Arabic consent is translated, RTL, and usable at desktop and mobile sizes", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto("/demo/account/consents")
    await page.locator("select[aria-label]").selectOption("ar")

    await expect(page.locator("html")).toHaveAttribute("lang", "ar")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page.getByText("التطبيقات التي يمكنها الوصول إلى معلومات من حسابك.", { exact: true })).toBeVisible()
    await expect(page.getByText(/الأذونات: openid, profile, email/)).toBeVisible()
    const revoke = page.getByRole("button", { name: "إبطال", exact: true }).first()
    await expect(elementContrastRatioGet(revoke)).resolves.toBeGreaterThanOrEqual(4.5)

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("هل تريد إلغاء وصول التطبيق analytics-dashboard؟")
      await dialog.dismiss()
    })
    await revoke.press("Enter")
    await expect(page.getByRole("heading", { name: "analytics-dashboard" })).toBeVisible()
    const accessibility = await new AxeBuilder({ page }).analyze()
    expect(
      accessibility.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
    ).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
  }
})

test("the invitations demo follows the canonical route family and keeps demo navigation isolated", async ({ page }) => {
  await page.goto("/demo/account")
  const invitationLink = page.getByRole("link", { name: "My invitations", exact: true })
  await expect(invitationLink).toHaveAttribute("href", "/demo/invitations")
  await invitationLink.click()
  await expect(page).toHaveURL(/\/demo\/invitations$/)

  const organizationsLink = page.getByRole("link", { name: "Switch organization", exact: true })
  await expect(organizationsLink).toHaveAttribute("href", "/demo/account/organizations")
  await organizationsLink.click()
  await expect(page.getByRole("heading", { name: "Northwind Labs", exact: true })).toBeVisible()
})

async function elementContrastRatioGet(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext("2d")
    const rgbaGet = (value: string) => {
      if (context === null) return [0, 0, 0, 0]
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data]
    }
    const luminanceGet = (rgb: number[]) => {
      const channels = rgb.map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
    }
    const foreground = rgbaGet(getComputedStyle(element).color)
    let backgroundElement: Element | null = element
    let background = [255, 255, 255]
    while (backgroundElement !== null) {
      const candidate = rgbaGet(getComputedStyle(backgroundElement).backgroundColor)
      if ((candidate[3] ?? 0) > 250) {
        background = candidate
        break
      }
      backgroundElement = backgroundElement.parentElement
    }
    const foregroundLuminance = luminanceGet(foreground)
    const backgroundLuminance = luminanceGet(background)
    return (
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    )
  })
}

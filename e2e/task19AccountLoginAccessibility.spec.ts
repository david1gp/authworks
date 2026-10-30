import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Locator, type Page } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"

/** Serves the fixture avatar host so the workspace picture renders instead of failing DNS. */
async function demoAssetHostInstall(page: Page) {
  await page.route("https://assets.example.com/**", (route) =>
    route.fulfill({
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ccc"/></svg>`,
      contentType: "image/svg+xml",
    }),
  )
}

const viewports = [
  { height: 720, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
] as const

test("account destructive actions require keyboard-operable confirmation", async ({ page }) => {
  test.setTimeout(180_000)
  await demoAssetHostInstall(page)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const consentOpen = async () => {
      await page.goto("/demo/account")
      await page.locator("#access summary").filter({ hasText: "Application consents" }).click()
      const item = page.getByRole("list", { name: "Application consents" }).getByRole("button").first()
      await item.focus()
      await page.keyboard.press("Enter")
      const dialog = page.getByRole("dialog")
      await expect(dialog.getByRole("heading", { name: "Application consent: analytics-dashboard" })).toBeVisible()
      return dialog
    }

    await (await consentOpen()).getByRole("button", { name: "Revoke", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(page.getByText("analytics-dashboard", { exact: true }).first()).toBeVisible()

    await (await consentOpen()).getByRole("button", { name: "Revoke", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
    await expect(
      page.getByRole("list", { name: "Application consents" }).getByRole("button", { name: /analytics-dashboard/ }),
    ).toHaveCount(0)

    const sessionOpen = async () => {
      await page.goto("/demo/account")
      await page
        .getByRole("region", { name: "Devices and applications" })
        .locator("summary")
        .filter({ hasText: "Sessions and devices" })
        .click()
      const item = page
        .getByRole("list", { name: "Sessions and devices" })
        .getByRole("button", { name: /Safari on iPhone/ })
      await item.focus()
      await page.keyboard.press("Enter")
      return page.getByRole("dialog")
    }

    await (await sessionOpen()).getByRole("button", { name: "Revoke session", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(page.getByText("Safari on iPhone", { exact: true })).toBeVisible()

    await (await sessionOpen()).getByRole("button", { name: "Revoke session", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
    await expect(page.getByText("Safari on iPhone", { exact: true })).toHaveCount(0)
  }
})

test("account identity unlink and invitation decline confirmations guard fixture mutations", async ({ page }) => {
  const identityOpen = async () => {
    await page.goto("/demo/account")
    await page.locator("#security summary").filter({ hasText: "Linked identities" }).click()
    await page.getByRole("list", { name: "Linked identities" }).getByRole("button").first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: /Manage GitHub/ })).toBeVisible()
    return dialog
  }

  await (await identityOpen()).getByRole("button", { name: "Unlink", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(
    page.getByRole("list", { name: "Linked identities" }).getByRole("button", { name: /GitHub/ }),
  ).toHaveCount(1)

  await (await identityOpen()).getByRole("button", { name: "Unlink", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("heading", { name: /Manage GitHub/ })).toHaveCount(0)

  await page.goto("/demo/invitations/accept?state=success")
  const decline = page.getByRole("button", { name: "Decline", exact: true })

  await decline.click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(decline).toBeVisible()

  await decline.click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click()
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

    await page.goto("/demo/account")
    await page.locator("#access summary").filter({ hasText: "Application consents" }).click()
    await page.getByRole("list", { name: "Application consents" }).getByRole("button").first().click()
    await expect(
      elementContrastRatioGet(page.getByRole("dialog").getByRole("button", { name: "Revoke", exact: true })),
    ).resolves.toBeGreaterThanOrEqual(4.5)
  }
})

test("representative login and account demos have no serious axe violations", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const path of ["/demo/login/password", "/demo/account"]) {
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

test("account definition lists use valid semantic children", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto("/demo/account")
    const accessibility = await new AxeBuilder({ page }).withRules(["definition-list", "dlitem"]).analyze()
    expect(accessibility.violations).toEqual([])
  }
})

test("Arabic consent is translated, RTL, and usable at desktop and mobile sizes", async ({ page }) => {
  test.setTimeout(180_000)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await demoAssetHostInstall(page)
    await page.goto("/demo/account")
    await page.locator("select[aria-label]").selectOption("en")
    await page.locator("#access summary").filter({ hasText: "Application consents" }).click()
    await page.locator("select[aria-label]").selectOption("ar")

    await expect(page.locator("html")).toHaveAttribute("lang", "ar")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page.getByText("التطبيقات التي يمكنها الوصول إلى معلومات من حسابك.", { exact: true })).toBeVisible()
    await page.getByRole("list", { name: "أذونات وصول التطبيقات" }).getByRole("button").first().press("Enter")
    const consentDialog = page.getByRole("dialog")
    await expect(consentDialog).toBeVisible()
    await expect(consentDialog.getByText(/الأذونات: openid, profile, email/)).toBeVisible()
    const revoke = consentDialog.getByRole("button", { name: "إبطال", exact: true })
    await expect(elementContrastRatioGet(revoke)).resolves.toBeGreaterThanOrEqual(4.5)

    await revoke.click()
    await expect(page.getByRole("alertdialog")).toContainText("هل تريد إلغاء وصول التطبيق analytics-dashboard؟")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(consentDialog).toBeVisible()
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
  await page.goto("/demo/invitations")
  await expect(page.getByRole("heading", { name: "My invitations", exact: true })).toBeVisible()
  const invitationLink = page.getByRole("link", { name: "Open invitation", exact: true })
  await expect(invitationLink).toHaveAttribute("href", "/demo/invitations/accept")
  await invitationLink.click()
  await expect(page).toHaveURL(/\/demo\/invitations\/accept$/)

  await page.goto("/demo/invitations")
  const organizationsLink = page.getByRole("link", { name: "Organizations", exact: true })
  await expect(organizationsLink).toHaveAttribute("href", "/demo/account#access")
  await organizationsLink.click()
  await expect(page).toHaveURL(/\/demo\/account#access$/)
  await page.locator("#access summary").filter({ hasText: "Organizations" }).click()
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

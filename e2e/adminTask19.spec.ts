import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { demoAdminScenarioGroups } from "../src/features/demo/demoAdminScenarioGroups.js"

const oidcClientId = "01900000-0000-7000-8000-000000000041"
const machineUserId = "01900000-0000-7000-8000-000000000071"
const administrationDemoPages = demoAdminScenarioGroups.flatMap((group) =>
  group.scenarios.filter((scenario) => scenario.availability === "available").map((scenario) => scenario.path),
)

test.describe("task 19 administration browser fixes", () => {
  test("every administration demo page has one page heading", async ({ page }) => {
    test.setTimeout(180_000)
    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 844, width: 390 },
    ]) {
      await page.setViewportSize(viewport)
      for (const path of administrationDemoPages) {
        const demoPage = await page.context().newPage()
        try {
          await demoPage.setViewportSize(viewport)
          await demoPage.goto(path, { waitUntil: "domcontentloaded" })
          await expect(demoPage.locator("h1"), `${viewport.width}px ${path}`).toHaveCount(1)
        } finally {
          await demoPage.close()
        }
      }
    }
  })

  test("every administration demo page has no horizontal overflow", async ({ page }) => {
    test.setTimeout(180_000)
    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 844, width: 390 },
    ]) {
      await page.setViewportSize(viewport)
      for (const path of administrationDemoPages) {
        const demoPage = await page.context().newPage()
        try {
          await demoPage.setViewportSize(viewport)
          await demoPage.goto(path, { waitUntil: "domcontentloaded" })
          const documentWidth = await demoPage.evaluate(() => ({
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
          }))
          expect(documentWidth.scroll, `${viewport.width}px ${path}`).toBeLessThanOrEqual(documentWidth.client)
        } finally {
          await demoPage.close()
        }
      }
    }
  })

  for (const viewport of [
    { height: 900, name: "desktop", width: 1440 },
    { height: 844, name: "mobile", width: 390 },
  ]) {
    test(`the Arabic realm overview is translated and RTL at ${viewport.name} size`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/demo/admin/overview")
      await page.getByLabel("Language").selectOption("ar")

      await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
      await expect(page.locator("html")).toHaveAttribute("lang", "ar")
      await expect(page.getByText("معاينة بيانات تجريبية مستقلة", { exact: true })).toBeVisible()
      await expect(page.getByRole("heading", { name: "نظرة عامة على النطاق", exact: true })).toBeVisible()
      await expect(page.getByText("هوية عميل Northwind", { exact: true })).toBeVisible()
      await expect(page.getByText("حالة البيانات التجريبية", { exact: true })).toBeVisible()
      await expect(page.getByRole("link", { name: "نجاح", exact: true })).toBeVisible()

      const documentWidth = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client)

      if (viewport.name === "desktop") {
        await expect(page.locator("aside")).toHaveCSS("right", "0px")
        await expect(page.locator("main")).toHaveCSS("margin-right", "256px")
      }

      const accessibility = await new AxeBuilder({ page }).analyze()
      expect(accessibility.violations).toEqual([])
    })
  }

  test("mobile OIDC redirect and scope content remains readable", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 })
    await page.goto("/demo/admin/oidc-clients")

    const redirectCell = page.getByRole("cell", { name: /https:\/\/portal\.acme\.example\/callback/ }).first()
    await expect(redirectCell).toBeVisible()
    expect(await contentClips(redirectCell)).toBe(false)
    await expect(page.getByRole("table", { name: "OpenID Connect clients" })).toHaveAttribute("tabindex", "0")

    await page.goto(`/demo/admin/oidc-clients/${oidcClientId}`)
    expect(await contentClips(page.getByLabel("Redirect URIs", { exact: true }))).toBe(false)
    expect(await contentClips(page.getByText("offline_access", { exact: true }))).toBe(false)
  })

  test("mobile machine-user tables expose complete scope content", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 })
    await page.goto("/demo/admin/machine-users")

    const userScopes = page.getByRole("cell", { name: "billing.read, billing.write", exact: true })
    await expect(userScopes).toBeVisible()
    expect(await contentClips(userScopes)).toBe(false)
    await expect(page.getByRole("table", { name: "Machine users" })).toHaveAttribute("tabindex", "0")

    await page.goto(`/demo/admin/machine-users/${machineUserId}`)
    const credentialScopes = page.getByRole("cell", { name: "billing.read, billing.write", exact: true }).first()
    await expect(credentialScopes).toBeVisible()
    expect(await contentClips(credentialScopes)).toBe(false)
    await expect(page.getByRole("table", { name: "Credentials and tokens" })).toHaveAttribute("tabindex", "0")
  })

  test("representative administration views meet text contrast", async ({ page }) => {
    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 844, width: 390 },
    ]) {
      await page.setViewportSize(viewport)
      for (const path of [
        "/demo/admin/overview",
        "/demo/admin/domains",
        "/demo/admin/login-policy",
        `/demo/admin/oidc-clients/${oidcClientId}?state=redacted`,
      ]) {
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
})

async function contentClips(locator: import("@playwright/test").Locator): Promise<boolean> {
  return locator.evaluate(
    (element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight,
  )
}

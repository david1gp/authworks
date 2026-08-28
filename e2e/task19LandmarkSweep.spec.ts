import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

/** The routes the dedicated sweep reported duplicate landmark names on. */
const routes = [
  "/demo/admin/sign-in",
  "/demo/admin/branding",
  "/demo/admin/login-policy",
  "/demo/admin/memberships",
  "/demo/admin/invitations",
  "/demo/admin/domains",
  "/demo/admin/projects/01900000-0000-7000-8000-000000000031/roles-grants",
  "/demo/invitations",
  "/demo/account/consents",
] as const

const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
] as const

test("authenticated routes expose no duplicate landmark names", async ({ page }) => {
  test.setTimeout(180_000)
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator("main h1")).toBeVisible()
    const duplicates = await landmarkNameDuplicatesRead(page)
    expect(duplicates, route).toEqual([])
  }
})

test("redesigned panels never repeat the page heading as a panel heading", async ({ page }) => {
  for (const route of ["/demo/admin/sign-in", "/demo/admin/branding"] as const) {
    await page.goto(route)
    const title = await page.locator("main h1").innerText()
    await expect(page.getByRole("heading", { exact: true, name: title })).toHaveCount(1)
  }
})

test("account email addresses stay fully readable beside their actions at 390px", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/demo/account/email")
  const addresses = page.getByRole("list", { name: "Email addresses" }).getByRole("listitem")
  await expect(addresses.first()).toBeVisible()

  for (const address of await addresses.all()) {
    const email = address.locator("span").first()
    const clipped = await email.evaluate((element) => element.scrollWidth > element.clientWidth + 1)
    expect(clipped, await email.innerText()).toBe(false)
  }
  await expect(page.getByRole("button", { name: "Remove", exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  )
})

test("swept routes stay free of serious axe violations at desktop and mobile sizes", async ({ page }) => {
  test.setTimeout(300_000)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator("main h1")).toBeVisible()
      const accessibility = await new AxeBuilder({ page }).analyze()
      expect(
        accessibility.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        ),
        `${viewport.name} ${route}`,
      ).toEqual([])
    }
  }
})

async function landmarkNameDuplicatesRead(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = "main, nav, aside, header, footer, form[aria-label], [role='region'], section[aria-label]"
    const seen = new Map<string, number>()
    for (const element of document.querySelectorAll(selector)) {
      const labelled = element.getAttribute("aria-labelledby")
      const name =
        element.getAttribute("aria-label")?.trim() ??
        (labelled ? (document.getElementById(labelled)?.textContent?.trim() ?? "") : "")
      if (name.length === 0) continue
      const key = `${element.tagName.toLowerCase()}:${name}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([key, count]) => `${key} x${count}`)
  })
}

import { AxeBuilder } from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { demoAdminScenarioGroups } from "../src/features/demo/demoAdminScenarioGroups.js"

type Finding = string

const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
] as const

const scenarios = demoAdminScenarioGroups.flatMap((group) =>
  group.scenarios
    .filter((scenario) => scenario.availability === "available")
    .map((scenario) => ({ groupKey: group.key, scenario })),
)

test.describe("task 19 administration full-state sweep", () => {
  for (const viewport of viewports) {
    for (const { groupKey, scenario } of scenarios) {
      test(`${viewport.name} ${scenario.path}`, async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize(viewport)
        const problems: Finding[] = []
        for (const state of scenario.states) {
          const url = `${scenario.path}?state=${state}`
          const consoleErrors: string[] = []
          const pageErrors: string[] = []
          const onPage = await page.context().newPage()
          onPage.on("console", (message) => {
            if (message.type() === "error") consoleErrors.push(message.text())
          })
          onPage.on("pageerror", (error) => pageErrors.push(String(error)))
          try {
            await onPage.setViewportSize(viewport)
            await onPage.goto(url, { waitUntil: "domcontentloaded" })
            await onPage.waitForTimeout(250)

            const headings = await onPage.locator("h1").count()
            if (headings !== 1) problems.push(`${url}: expected exactly one h1, found ${headings}`)

            const widths = await onPage.evaluate(() => ({
              client: document.documentElement.clientWidth,
              scroll: document.documentElement.scrollWidth,
            }))
            if (widths.scroll > widths.client) {
              problems.push(`${url}: horizontal overflow scroll=${widths.scroll} client=${widths.client}`)
            }

            for (const error of pageErrors) problems.push(`${url}: pageerror ${error}`)
            for (const error of consoleErrors) {
              if (!error.includes("favicon")) problems.push(`${url}: console.error ${error.slice(0, 300)}`)
            }

            const accessibility = await new AxeBuilder({ page: onPage }).analyze()
            for (const violation of accessibility.violations) {
              if (violation.impact === "serious" || violation.impact === "critical") {
                problems.push(
                  `${url}: axe ${violation.id} (${violation.impact}) [${violation.nodes
                    .map((node) => node.target.join(" "))
                    .slice(0, 3)
                    .join("; ")}]`,
                )
              }
            }
          } finally {
            await onPage.close()
          }
        }
        expect(problems, `${viewport.name} ${scenario.path}`).toEqual([])
      })
    }
  }
})

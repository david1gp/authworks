import { AxeBuilder } from "@axe-core/playwright"
import { type ConsoleMessage, expect, type Page, test } from "@playwright/test"
import { demoAdminScenarioGroups } from "../src/features/demo/demoAdminScenarioGroups.js"

type Finding = string

const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
] as const
const routeLoadAttemptLimit = 2
const routeLoadRetryDelay = 250
const routeLoadTimeout = 15_000

const scenarios = demoAdminScenarioGroups.flatMap((group) =>
  group.scenarios.filter((scenario) => scenario.availability === "available"),
)

test.describe("task 19 administration full-state sweep", () => {
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      test(`${viewport.name} ${scenario.path}`, async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize(viewport)
        const problems: Finding[] = []
        for (const state of scenario.states) {
          const url = `${scenario.path}?state=${state}`
          const onPage = await page.context().newPage()
          try {
            await onPage.setViewportSize(viewport)
            const routeLoad = await routeLoadUntilReady(onPage, url)

            if (
              routeLoad.responseStatus === null ||
              routeLoad.responseStatus < 200 ||
              routeLoad.responseStatus >= 300
            ) {
              problems.push(`${url}: goto response ${routeLoadResponseDescribe(routeLoad)}`)
            }
            if (routeLoad.navigationError) problems.push(`${url}: goto error ${routeLoad.navigationError}`)
            if (routeLoad.viteOverlay) problems.push(`${url}: vite overlay ${routeLoad.viteOverlay}`)

            const headings = await onPage.locator("h1").count()
            if (headings !== 1) problems.push(`${url}: expected exactly one h1, found ${headings}`)

            const widths = await onPage.evaluate(() => ({
              client: document.documentElement.clientWidth,
              scroll: document.documentElement.scrollWidth,
            }))
            if (widths.scroll > widths.client) {
              problems.push(`${url}: horizontal overflow scroll=${widths.scroll} client=${widths.client}`)
            }

            for (const error of routeLoad.pageErrors) problems.push(`${url}: pageerror ${error}`)
            for (const error of routeLoad.consoleErrors) {
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

type RouteLoadAttempt = {
  attempt: number
  consoleErrors: string[]
  navigationError: string | null
  pageErrors: string[]
  pageUrl: string
  readiness: "ready" | "timeout"
  readinessError: string | null
  appEmpty: boolean
  responseStatus: number | null
  responseUrl: string | null
  viteOverlay: string | null
}

async function routeLoadUntilReady(page: Page, url: string): Promise<RouteLoadAttempt> {
  const attempts: RouteLoadAttempt[] = []

  for (let attempt = 1; attempt <= routeLoadAttemptLimit; attempt += 1) {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const onConsole = (message: ConsoleMessage) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    }
    const onPageError = (error: Error) => pageErrors.push(String(error))
    let navigationError: string | null = null
    let response: Awaited<ReturnType<Page["goto"]>> = null
    let readinessError: string | null = null
    let routeLoadReady = false

    page.on("console", onConsole)
    page.on("pageerror", onPageError)
    try {
      try {
        response = await page.goto(url, { timeout: routeLoadTimeout, waitUntil: "domcontentloaded" })
      } catch (error) {
        navigationError = error instanceof Error ? error.message : String(error)
      }

      try {
        await page.locator("main h1").waitFor({ state: "visible", timeout: routeLoadTimeout })
      } catch (error) {
        readinessError = error instanceof Error ? error.message : String(error)
      }
      routeLoadReady = readinessError === null
    } finally {
      if (!routeLoadReady) {
        page.off("console", onConsole)
        page.off("pageerror", onPageError)
      }
    }

    const routeLoadAttempt: RouteLoadAttempt = {
      attempt,
      consoleErrors,
      navigationError,
      pageErrors,
      pageUrl: page.url(),
      readiness: readinessError ? "timeout" : "ready",
      readinessError,
      appEmpty: await routeLoadAppEmptyRead(page),
      responseStatus: response?.status() ?? null,
      responseUrl: response?.url() ?? null,
      viteOverlay: await routeLoadViteOverlayRead(page),
    }
    attempts.push(routeLoadAttempt)

    if (routeLoadAttempt.readiness === "ready") return routeLoadAttempt
    if (attempt === routeLoadAttemptLimit || !routeLoadAttemptShouldRetry(routeLoadAttempt)) {
      throw new Error(
        `${url}: main h1 readiness timed out after ${attempts.length} attempt(s): ${attempts
          .map(routeLoadAttemptDescribe)
          .join(" | ")}`,
      )
    }

    console.log(`[task19] retrying transient route load ${url}: ${routeLoadAttemptDescribe(routeLoadAttempt)}`)
    await page.waitForTimeout(routeLoadRetryDelay)
  }

  throw new Error(`${url}: route load attempts unexpectedly exhausted`)
}

function routeLoadAttemptShouldRetry(attempt: RouteLoadAttempt): boolean {
  return (
    attempt.readiness === "timeout" &&
    (attempt.navigationError !== null ||
      attempt.responseStatus === null ||
      attempt.responseStatus >= 500 ||
      attempt.viteOverlay !== null ||
      attempt.appEmpty)
  )
}

async function routeLoadViteOverlayRead(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const overlay = document.querySelector("vite-error-overlay, #vite-error-overlay, .vite-error-overlay")
    if (!overlay) return null
    const text = overlay.shadowRoot?.textContent ?? overlay.textContent ?? ""
    return text.replace(/\s+/g, " ").trim().slice(0, 500) || "present"
  })
}

function routeLoadAttemptDescribe(attempt: RouteLoadAttempt): string {
  const details = [
    `attempt=${attempt.attempt}`,
    `response=${routeLoadResponseDescribe(attempt)}`,
    `pageUrl=${attempt.pageUrl}`,
    `readiness=${attempt.readiness}`,
    `appEmpty=${attempt.appEmpty}`,
  ]
  if (attempt.navigationError) details.push(`navigationError=${attempt.navigationError.slice(0, 300)}`)
  if (attempt.viteOverlay) details.push(`viteOverlay=${attempt.viteOverlay}`)
  if (attempt.pageErrors.length > 0) details.push(`pageErrors=${attempt.pageErrors.slice(0, 3).join(" || ")}`)
  if (attempt.consoleErrors.length > 0) {
    details.push(
      `consoleErrors=${attempt.consoleErrors
        .slice(0, 3)
        .map((error) => error.slice(0, 300))
        .join(" || ")}`,
    )
  }
  const readinessError = attempt.readinessError
  if (readinessError) {
    const readinessErrorLine = readinessError.split("\n")[0] ?? ""
    details.push(`readinessError=${readinessErrorLine.slice(0, 300)}`)
  }
  return details.join(" ")
}

async function routeLoadAppEmptyRead(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const app = document.querySelector("#app")
    return app !== null && app.children.length === 0
  })
}

function routeLoadResponseDescribe(attempt: Pick<RouteLoadAttempt, "responseStatus" | "responseUrl">): string {
  if (attempt.responseStatus === null) return `none url=${attempt.responseUrl ?? "none"}`
  return `${attempt.responseStatus} url=${attempt.responseUrl ?? "none"}`
}

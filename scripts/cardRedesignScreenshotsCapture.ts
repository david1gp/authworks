import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "@playwright/test"

// Captures full-page screenshots of the card-redesign pilot demo pages.
// Usage: CARD_SCREENSHOT_BASE_URL=http://localhost:5173 CARD_SCREENSHOT_PHASE=before bun run scripts/cardRedesignScreenshotsCapture.ts
const baseUrl = (process.env.CARD_SCREENSHOT_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "")
const phase = process.env.CARD_SCREENSHOT_PHASE ?? "before"
const outputDir = join(import.meta.dirname, "..", "docs", "card-redesign-screenshots", phase)
const isAfter = phase === "after"

const pages = [
  {
    name: "users",
    route: "/demo/admin/users",
    expectedTexts: {
      desktop: ["Ada Osei", "ada.osei@acme.example", "13 people"],
      mobile: isAfter ? ["Ada Osei", "ada.osei@acme.example", "13 people"] : ["Ada Osei", "@ada.osei", "13 people"],
    },
    expectedDomTexts: { desktop: [], mobile: [] },
  },
  {
    name: "organizations",
    route: "/demo/admin/organizations",
    expectedTexts: {
      desktop: ["Acme Corporation", "Initech Partners", "2 organizations"],
      mobile: ["Acme Corporation", "Initech Partners", "2 organizations"],
    },
    expectedDomTexts: { desktop: [], mobile: [] },
  },
  {
    name: "sessions",
    route: "/demo/admin/sessions",
    expectedTexts: {
      desktop: ["Firefox on Linux", "Safari on iPhone", "192.0.2.10"],
      // Before state: the sessions table is not rendered visibly at 390px; the loaded
      // count is visible and the rows are present in the DOM (checked below).
      mobile: isAfter
        ? ["Firefox on Linux", "Safari on iPhone", "2 sessions on this page"]
        : ["2 sessions on this page"],
    },
    expectedDomTexts: { desktop: [], mobile: isAfter ? [] : ["Firefox on Linux", "Safari on iPhone"] },
  },
] as const

const viewports = [
  { label: "desktop", viewport: { width: 1440, height: 900 } },
  { label: "mobile", viewport: { width: 390, height: 844 } },
] as const

mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const target of pages) {
    for (const { label, viewport } of viewports) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })
      page.on("pageerror", (error) => consoleErrors.push(String(error)))
      await page.goto(`${baseUrl}${target.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
      const visibleTexts = target.expectedTexts[label]
      for (const text of visibleTexts) {
        // innerText excludes display:none subtrees, so this waits for a visibly rendered copy
        // (responsive layouts keep a hidden desktop table in the DOM on mobile).
        await page.waitForFunction((expected) => document.body.innerText.includes(expected), text, {
          timeout: 15_000,
        })
      }
      const domTexts = target.expectedDomTexts[label]
      for (const text of domTexts) {
        await page.waitForFunction((expected) => (document.body.textContent ?? "").includes(expected), text, {
          timeout: 15_000,
        })
      }
      await page.waitForTimeout(500)
      const path = join(outputDir, `${target.name}-${label}.png`)
      await page.screenshot({ path, fullPage: true })
      console.log(
        `${target.name}-${label}: OK ${path} (verified visible: ${visibleTexts.join(", ")}` +
          (domTexts.length > 0 ? `; verified in DOM: ${domTexts.join(", ")}` : "") +
          `)` +
          (consoleErrors.length > 0 ? ` consoleErrors=${consoleErrors.join(" | ")}` : ""),
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
}

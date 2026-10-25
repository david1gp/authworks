import { test as base } from "@playwright/test"

/** Console levels worth keeping for failure diagnostics; `log`/`info`/`debug` are always dropped. */
const e2eBrowserConsoleLevels = new Set(["error", "warning"])

/** Upper bound so a chatty page cannot balloon the failure report. */
const e2eBrowserConsoleLimit = 200

/**
 * Playwright `test` that records browser console errors and warnings for every page in the test's
 * context and prints them only when the test fails (or always with `AUTHWORKS_E2E_CONSOLE=1`).
 * Passing tests stay silent, so expected diagnostics such as mocked invalid-response logs do not
 * drown the run output.
 */
export const e2eBrowserConsoleTest = base.extend<{ readonly browserConsoleCapture: undefined }>({
  browserConsoleCapture: [
    async ({ context }, use, testInfo) => {
      const lines: string[] = []
      let dropped = 0
      context.on("console", (message) => {
        if (!e2eBrowserConsoleLevels.has(message.type())) return
        if (lines.length >= e2eBrowserConsoleLimit) {
          dropped++
          return
        }
        lines.push(`[${message.type()}] ${message.text()}`)
      })
      context.on("weberror", (error) => {
        lines.push(`[pageerror] ${error.error().message}`)
      })
      await use(undefined)
      const failed = testInfo.status !== testInfo.expectedStatus
      if (lines.length === 0 || (!failed && process.env.AUTHWORKS_E2E_CONSOLE !== "1")) return
      const suffix = dropped > 0 ? `\n… ${dropped} more console message(s) dropped` : ""
      const body = `${lines.join("\n")}${suffix}`
      await testInfo.attach("browser-console", { body, contentType: "text/plain" })
      process.stderr.write(`\nBrowser console for "${testInfo.title}":\n${body}\n`)
    },
    { auto: true },
  ],
})

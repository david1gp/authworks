import type { Page } from "@playwright/test"
import { e2eBrowserConsoleTest as base } from "./e2eBrowserConsoleTest.js"

type E2ePageErrorFixtures = {
  readonly pageErrors: Error[]
  readonly pageErrorsAllowed: boolean
}

function e2ePageErrorDescribe(error: Error): string {
  const message = error.message.length > 0 ? error.message : String(error)
  const stack = error.stack ?? String(error)
  return stack.includes(message) ? stack : `${message}\n${stack}`
}

function e2ePageErrorsCollect(page: Page, pageErrors: Error[]): void {
  page.on("pageerror", (error) => {
    pageErrors.push(error)
  })
  page.context().on("page", (popup) => {
    popup.on("pageerror", (error) => {
      pageErrors.push(error)
    })
  })
}

export const e2eTest = base.extend<E2ePageErrorFixtures>({
  pageErrors: [
    async ({ browserName: _browserName }, use) => {
      await use([])
    },
    { scope: "test" },
  ],
  pageErrorsAllowed: [
    // Biome flags the empty destructuring pattern, but Playwright requires it.
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
    async ({}, use) => {
      await use(false)
    },
    { scope: "test" },
  ],
  page: async ({ context, page, pageErrors, pageErrorsAllowed }, use) => {
    e2ePageErrorsCollect(page, pageErrors)
    void context
    await use(page)
    if (!pageErrorsAllowed && pageErrors.length > 0) {
      const details = pageErrors.map((error) => e2ePageErrorDescribe(error)).join("\n---\n")
      throw new Error(`Unexpected browser page error(s) (${pageErrors.length}):\n${details}`)
    }
  },
})

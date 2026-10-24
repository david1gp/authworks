import { test as base, type Page } from "@playwright/test"
import { e2eTargetBaseUrlGet } from "./harness/e2eTargetBaseUrlGet.js"
import { productionE2eCredentialsGet } from "./productionE2eCredentialsGet.js"

type ProductionAuth = {
  readonly signIn: (page: Page) => Promise<void>
}

type ProductionAuthFixtures = {
  readonly productionAuth: ProductionAuth
}

export const productionAuthTest = base.extend<ProductionAuthFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
  productionAuth: async ({}, use) => {
    const credentials = productionE2eCredentialsGet()
    if (!credentials.success) throw new Error(credentials.errorMessage)
    const { password, username } = credentials.data
    const targetOrigin = e2eTargetBaseUrlGet()

    await use({
      signIn: async (page) => {
        const loginResponse = page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.origin === targetOrigin && url.pathname.endsWith("/password/login")
        })
        await page.goto("/login/password?return_to=%2Faccount")
        await page.getByLabel("Username or email", { exact: true }).fill(username)
        await page.getByLabel("Password", { exact: true }).fill(password)
        await page.getByRole("button", { name: "Sign in", exact: true }).click()

        const response = await loginResponse
        if (!response.ok()) throw new Error("The production password authentication request failed.")
      },
    })
  },
})

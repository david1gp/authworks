import { type Page, test as base } from "@playwright/test"
import { productionE2eCredentialsGet } from "./productionE2eCredentialsGet.js"

const productionOrigin = "https://authworks.contentoren.de"

type ProductionAuth = {
  readonly signIn: (page: Page) => Promise<void>
}

type ProductionAuthFixtures = {
  readonly productionAuth: ProductionAuth
}

export const productionAuthTest = base.extend<ProductionAuthFixtures>({
  productionAuth: async ({}, use) => {
    const credentials = productionE2eCredentialsGet()
    if (!credentials.success) throw new Error(credentials.errorMessage)
    const { password, username } = credentials.data

    await use({
      signIn: async (page) => {
        const loginResponse = page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.origin === productionOrigin && url.pathname.endsWith("/password/login")
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

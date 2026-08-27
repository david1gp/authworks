import { expect } from "@playwright/test"
import { productionAuthTest } from "./productionAuthTest.js"

productionAuthTest("the dedicated production account authenticates", async ({ page, productionAuth }) => {
  await productionAuth.signIn(page)
  await expect(page).toHaveURL("https://authworks.contentoren.de/account")
})

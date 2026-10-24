import { expect } from "@playwright/test"
import { e2eTargetBaseUrlGet } from "./harness/e2eTargetBaseUrlGet.js"
import { productionAuthTest } from "./productionAuthTest.js"

productionAuthTest("the dedicated production account authenticates", async ({ page, productionAuth }) => {
  await productionAuth.signIn(page)
  await expect(page).toHaveURL(`${e2eTargetBaseUrlGet()}/account`)
})

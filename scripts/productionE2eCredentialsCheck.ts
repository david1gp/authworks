import { productionE2eCredentialsGet } from "../e2e/productionE2eCredentialsGet.js"

const credentials = productionE2eCredentialsGet()
if (!credentials.success) {
  process.stderr.write(`${credentials.errorMessage}\n`)
  process.exitCode = 1
}

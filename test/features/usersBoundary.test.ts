import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import * as realmServer from "../../src/features/realms/server/index.js"

test("users consumes realms through its explicit public and server surfaces", async () => {
  expect(realmServer.realmAdministratorContextAuthorize).toBeFunction()
  expect(realmServer.realmBootstrapAdminAuthenticate).toBeFunction()
  expect(realmServer.realmGet).toBeFunction()
  expect(realmServer.realmSystemContextCreate).toBeFunction()
  expect(realmServer.realmTenantContextResolve).toBeFunction()

  const files = Array.from(new Bun.Glob("src/features/users/**/*.ts").scanSync())
  const violations: string[] = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    for (const match of source.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
      const importedPath = match[1]
      if (
        importedPath?.includes("../../realms/") &&
        !["../../realms/public/index.js", "../../realms/server/index.js"].includes(importedPath)
      )
        violations.push(`${file}: ${importedPath}`)
    }
  }

  expect(violations).toEqual([])
})

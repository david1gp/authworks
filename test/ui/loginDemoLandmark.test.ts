import { describe, expect, test } from "bun:test"

const sourceRead = async (path: string) => await Bun.file(new URL(path, import.meta.url)).text()

describe("demo landmark composition", () => {
  test("wraps the login directory in one main without adding a destination wrapper", async () => {
    const source = await sourceRead("../../src/features/login/ui/LoginDemoApp.tsx")

    expect(source).toMatch(/fallback=\{\s*<main>\s*<DemoLoginDirectory \/>\s*<\/main>\s*\}/)
    expect(source.match(/<main\b/g)).toHaveLength(1)
  })

  test("keeps the existing single-main shells for login, account, and admin demos", async () => {
    for (const path of [
      "../../src/features/login/ui/LoginFrame.tsx",
      "../../src/features/login/ui/LoginUnavailableFrame.tsx",
      "../../src/features/account/ui/AccountDemoScreen.tsx",
      "../../src/features/admin/ui/AdminDemoApp.tsx",
    ]) {
      const source = await sourceRead(path)
      expect(source.match(/<main\b/g), path).toHaveLength(1)
    }
  })
})

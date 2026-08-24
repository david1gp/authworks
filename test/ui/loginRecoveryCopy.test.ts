import { describe, expect, test } from "bun:test"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"

describe("login recovery reference copy", () => {
  test("keeps the source comma in the legal footer", () => {
    expect(englishCatalog["login.common.legal"]).toBe("By continuing, you acknowledge the {terms} and the {privacy}.")
  })

  test("uses the source confirmation label for new-password forms", () => {
    expect(englishCatalog["account.password.confirm"]).toBe("Confirm new password")
  })
})

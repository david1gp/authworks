import { expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"

mock.module("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/demo/account", search: "" }),
}))

const { accountSecurityDemoStateCreate } = await import("./accountSecurityDemoStateCreate.js")

test("demo connected applications paginate and only revoke after confirmation, including unloaded families", async () => {
  await createRoot(async (dispose) => {
    const state = accountSecurityDemoStateCreate(() => "refresh-tokens")
    expect(state.refreshTokens().map((token) => token.clientName)).toEqual(["Acme Dashboard"])
    expect(state.refreshTokensNextPageToken()).toBe("demo-next-page")
    const pending = state.refreshTokensRevokeAll()
    expect(state.confirmation.open()).toBe(true)
    state.confirmation.cancel()
    await pending
    expect(state.refreshTokens()[0]?.status).toBe("active")

    const revoke = state.refreshTokensRevokeAll()
    state.confirmation.accept()
    await revoke
    expect(state.refreshTokens()[0]?.status).toBe("revoked")
    state.refreshTokensLoadMore()
    expect(state.refreshTokens().map((token) => token.status)).toEqual(["revoked", "revoked"])
    expect(state.refreshTokensNextPageToken()).toBeUndefined()
    dispose()
  })
})

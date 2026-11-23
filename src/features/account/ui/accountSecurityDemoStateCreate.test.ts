import { expect, mock, test } from "bun:test"
import { flush, createRoot } from "solid-js"

mock.module("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/demo/account", search: "" }),
}))

const { accountSecurityDemoStateCreate } = await import("./accountSecurityDemoStateCreate.js")

test("demo connected applications paginate and only revoke after confirmation, including unloaded families", async () => {
  await createRoot((dispose) => {
    const state = accountSecurityDemoStateCreate(() => "refresh-tokens")
    expect(state.refreshTokens().map((token) => token.clientName)).toEqual(["Acme Dashboard"])
    expect(state.refreshTokensNextPageToken()).toBe("demo-next-page")
    return async () => {
      flush()
      const pending = state.refreshTokensRevokeAll()
      flush()
      expect(state.confirmation.open()).toBe(true)
      state.confirmation.cancel()
      await pending
      flush()
      expect(state.refreshTokens()[0]?.status).toBe("active")

      const revoke = state.refreshTokensRevokeAll()
      flush()
      state.confirmation.accept()
      await revoke
      flush()
      expect(state.refreshTokens()[0]?.status).toBe("revoked")
      state.refreshTokensLoadMore()
      flush()
      expect(state.refreshTokens().map((token) => token.status)).toEqual(["revoked", "revoked"])
      expect(state.refreshTokensNextPageToken()).toBeUndefined()
      dispose()
    }
  })()
})

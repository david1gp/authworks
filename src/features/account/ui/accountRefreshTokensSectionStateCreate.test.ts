import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { OidcRefreshTokenMetadata } from "../../oidc/public/oidcRefreshTokenMetadataSchema.js"
import { accountRefreshTokensSectionStateCreate } from "./accountRefreshTokensSectionStateCreate.js"

const token = (familyId: string, status: OidcRefreshTokenMetadata["status"]): OidcRefreshTokenMetadata => ({
  clientId: "01900000-0000-7000-8000-000000000031",
  clientName: "Example application",
  createdAt: 1,
  expiresAt: 2,
  familyId,
  lastUsedAt: null,
  revokedAt: status === "revoked" ? 3 : null,
  scope: ["openid"],
  status,
})

test("connected application summary counts only loaded families and keeps the next page available", () => {
  createRoot((dispose) => {
    const tokens = createSignalObject([token("one", "active")])
    const nextPage = createSignalObject<string | undefined>("cursor")
    const state = accountRefreshTokensSectionStateCreate(tokens.get, nextPage.get)

    expect(state.summaryValue()).toBe("1 application shown")
    expect(state.summaryStatus()).toBe("1 active shown")
    expect(state.canRevokeAll()).toBe(true)
    tokens.set([token("one", "revoked")])
    expect(state.summaryStatus()).toBe("Available")
    tokens.set([token("one", "revoked"), token("two", "expired")])
    nextPage.set(undefined)
    expect(state.summaryValue()).toBe("2 applications shown")
    expect(state.summaryStatus()).toBe("No active applications")
    expect(state.canRevokeAll()).toBe(false)
    dispose()
  })
})

test("application revocation dispatches only from the open dialog for a still-active family", () => {
  createRoot((dispose) => {
    const tokens = createSignalObject([token("one", "active"), token("two", "revoked")])
    const state = accountRefreshTokensSectionStateCreate(tokens.get, () => undefined)
    const revoked: string[] = []
    const revoke = async (id: string) => {
      revoked.push(id)
    }

    state.tokenRevoke("one", revoke)
    state.dialogOpenChange("missing", true)
    expect(state.dialogOpen("missing")).toBe(false)
    state.dialogOpenChange("one", true)
    state.tokenRevoke("two", revoke)
    state.dialogOpenChange("two", true)
    state.tokenRevoke("two", revoke)
    state.dialogOpenChange("one", true)
    tokens.set([token("one", "expired"), token("two", "revoked")])
    state.tokenRevoke("one", revoke)
    tokens.set([token("one", "active"), token("two", "revoked")])
    state.tokenRevoke("one", revoke)
    tokens.set([token("two", "revoked")])
    expect(state.dialogOpen("one")).toBe(false)
    state.tokenRevoke("one", revoke)
    expect(revoked).toEqual(["one"])
    dispose()
  })
})

test("revoke-all requires its own labelled dialog and closes when no eligible families remain", () => {
  createRoot((dispose) => {
    const tokens = createSignalObject([token("one", "active")])
    const state = accountRefreshTokensSectionStateCreate(tokens.get, () => undefined)
    let calls = 0
    const revoke = async () => {
      calls += 1
    }

    state.tokensRevokeAll(revoke)
    state.dialogOpenChange("one", true)
    state.allDialogOpenChange(true)
    expect(state.dialogOpen("one")).toBe(false)
    expect(state.allDialogOpen()).toBe(true)
    state.tokensRevokeAll(revoke)
    tokens.set([token("one", "revoked")])
    expect(state.allDialogOpen()).toBe(false)
    state.tokensRevokeAll(revoke)
    state.allDialogOpenChange(true)
    expect(state.allDialogOpen()).toBe(false)
    expect(calls).toBe(1)
    dispose()
  })
})

test("application card nests metadata and explicit destructive controls inside accessible dialogs", async () => {
  const source = await Bun.file(new URL("./AccountRefreshTokensSection.tsx", import.meta.url)).text()
  expect(source).toContain("<AccountDisclosure")
  expect(source).toContain("icon={mdiKeyChain}")
  expect(source).toContain("value={state.summaryValue()}")
  expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.refreshTokens.description"))
  expect(source).toContain('title={messageTranslate("account.refreshTokens.manage"')
  expect(source).toContain("open={state.dialogOpen(token.familyId)}")
  expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("<AccountRoleList"))
  expect(source.indexOf("<AccountRoleList")).toBeLessThan(source.indexOf("</AuthenticatedDialog>"))
  expect(source).toContain('when={token.status === "active"}')
  expect(source).toContain("state.tokenRevoke(token.familyId, props.state.refreshTokenRevoke)")
  expect(source).toContain('description={messageTranslate("account.refreshTokens.revokeAllConfirm")}')
  expect(source).toContain("state.tokensRevokeAll(props.state.refreshTokensRevokeAll)")
  expect(source).toContain("onClick={props.state.refreshTokensLoadMore}")
  expect(source).not.toContain("AuthenticatedToolbar")
})

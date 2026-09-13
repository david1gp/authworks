import { createRoot, createSignal } from "solid-js"
import { describe, expect, test } from "bun:test"
import type { OidcClient } from "../../src/features/oidc/public/oidcClientSchema.js"
import { oidcAdminClientDetailViewStateCreate } from "../../src/features/oidc/ui/oidcAdminClientDetailViewStateCreate.js"
import { oidcAdminClientListViewStateCreate } from "../../src/features/oidc/ui/oidcAdminClientListViewStateCreate.js"

const client = {
  allowedScopes: ["openid", "profile"],
  accessTokenRoleAssertion: true,
  clientType: "confidential",
  additionalOrigins: ["https://console.example"],
  createdAt: 1,
  id: "01900000-0000-7000-8000-000000000041",
  idTokenUserinfoAssertion: true,
  name: "Portal",
  postLogoutRedirectUris: [],
  realmId: "01900000-0000-7000-8000-000000000001",
  redirectUris: ["https://portal.example/callback"],
  requireConsent: true,
  status: "active",
  trusted: false,
  updatedAt: 1,
} satisfies OidcClient

const submitEvent = { preventDefault: () => undefined } as SubmitEvent

describe("OIDC client compatibility form state", () => {
  test("sends create settings and resets them after a successful create", async () => {
    const requests: unknown[] = []
    const state = oidcAdminClientListViewStateCreate({
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: {
        clientCreate: async (input: unknown) => {
          requests.push(input)
          return true
        },
        clients: () => [],
      } as never,
      search: () => "",
      searchSet: () => undefined,
    })

    state.name.set("Compatibility client")
    state.redirectUris.set("https://portal.example/callback")
    state.idTokenUserinfoAssertion.set(true)
    state.accessTokenRoleAssertion.set(true)
    state.additionalOrigins.set("https://console.example\nhttps://admin.example")
    await state.createSubmit(submitEvent)

    expect(requests[0]).toMatchObject({
      accessTokenRoleAssertion: true,
      additionalOrigins: ["https://console.example", "https://admin.example"],
      idTokenUserinfoAssertion: true,
    })
    expect(state.accessTokenRoleAssertion.get()).toBe(false)
    expect(state.additionalOrigins.get()).toBe("")
    expect(state.idTokenUserinfoAssertion.get()).toBe(false)
  })

  test("hydrates detail settings and sends explicit false and empty values", async () => {
    const [currentClient, currentClientSet] = createSignal<OidcClient | undefined>(client)
    let request: unknown
    const state = createRoot((dispose) => {
      const detail = oidcAdminClientDetailViewStateCreate({
        onRemoved: () => undefined,
        page: {
          client: currentClient,
          clientUpdate: async (_clientId: string, input: unknown) => {
            request = input
            return true
          },
        } as never,
      })
      return { dispose, detail }
    })

    await Promise.resolve()
    expect(state.detail.accessTokenRoleAssertion.get()).toBe(true)
    expect(state.detail.idTokenUserinfoAssertion.get()).toBe(true)
    expect(state.detail.additionalOrigins.get()).toBe("https://console.example")

    state.detail.accessTokenRoleAssertion.set(false)
    state.detail.idTokenUserinfoAssertion.set(false)
    state.detail.additionalOrigins.set("")
    state.detail.settingsSubmit(submitEvent)
    await Promise.resolve()

    expect(request).toMatchObject({
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })

    currentClientSet({
      ...client,
      accessTokenRoleAssertion: false,
      additionalOrigins: [],
      idTokenUserinfoAssertion: false,
    })
    await Promise.resolve()
    expect(state.detail.additionalOrigins.get()).toBe("")
    state.dispose()
  })
})

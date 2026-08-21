import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
}))

const [{ oidcAdminFailureStatusSelect }, { oidcAdminSecretPanelStateCreate }, { oidcAdminUriListParse }] =
  await Promise.all([
    import("../../src/features/oidc/ui/oidcAdminFailureStatusSelect.js"),
    import("../../src/features/oidc/ui/oidcAdminSecretPanelStateCreate.js"),
    import("../../src/features/oidc/ui/oidcAdminUriListParse.js"),
  ])

describe("OIDC administration failure mapping", () => {
  test("separates permission, assurance, tenant, and generic failures", () => {
    expect(oidcAdminFailureStatusSelect({ code: "oidc.forbidden" })).toBe("permission-denied")
    expect(oidcAdminFailureStatusSelect({ statusCode: 403 })).toBe("permission-denied")
    expect(oidcAdminFailureStatusSelect({ statusCode: 401 })).toBe("permission-denied")
    expect(oidcAdminFailureStatusSelect({ code: "authorization.insufficient-assurance" })).toBe("assurance-required")
    expect(oidcAdminFailureStatusSelect({ code: "oidc.tenant-mismatch" })).toBe("cross-tenant")
    expect(oidcAdminFailureStatusSelect({ code: "oidc.read-failed" })).toBe("error")
  })
})

describe("exact redirect URI and scope entry", () => {
  test("splits on newlines and commas, trims, and de-duplicates without normalising", () => {
    expect(oidcAdminUriListParse(" https://a.example/cb \n https://b.example/cb,https://a.example/cb ")).toEqual([
      "https://a.example/cb",
      "https://b.example/cb",
    ])
  })

  test("preserves case, query strings, and trailing segments exactly", () => {
    expect(oidcAdminUriListParse("https://Portal.Acme.example/Callback?x=1")).toEqual([
      "https://Portal.Acme.example/Callback?x=1",
    ])
    // A trailing slash is a different exact URI and must not be collapsed.
    expect(oidcAdminUriListParse("https://a.example/cb\nhttps://a.example/cb/")).toEqual([
      "https://a.example/cb",
      "https://a.example/cb/",
    ])
  })

  test("drops empty entries", () => {
    expect(oidcAdminUriListParse("\n\n , ,\n")).toEqual([])
  })
})

describe("one-time client secret panel", () => {
  test("requires a copy before acknowledgement is offered", async () => {
    const state = oidcAdminSecretPanelStateCreate({
      onAcknowledge: () => undefined,
      secret: () => "top-secret",
      writeText: async () => undefined,
    })

    expect(state.copied()).toBe(false)
    state.copy()
    await Promise.resolve()
    expect(state.copied()).toBe(true)
    expect(state.copyFailed()).toBe(false)
  })

  test("reports a denied clipboard instead of losing the value", async () => {
    const state = oidcAdminSecretPanelStateCreate({
      onAcknowledge: () => undefined,
      secret: () => "top-secret",
      writeText: async () => {
        throw new Error("denied")
      },
    })

    state.copy()
    await Promise.resolve()
    await Promise.resolve()
    expect(state.copyFailed()).toBe(true)
    expect(state.copied()).toBe(false)
  })

  test("copies the exact secret and acknowledges once", async () => {
    const written: string[] = []
    let acknowledged = 0
    const state = oidcAdminSecretPanelStateCreate({
      onAcknowledge: () => {
        acknowledged += 1
      },
      secret: () => "exact-secret-value",
      writeText: async (value) => {
        written.push(value)
      },
    })

    state.copy()
    await Promise.resolve()
    state.acknowledge()

    expect(written).toEqual(["exact-secret-value"])
    expect(acknowledged).toBe(1)
    expect(state.copied()).toBe(false)
  })
})

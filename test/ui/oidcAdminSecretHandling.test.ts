import { beforeEach, describe, expect, mock, test } from "bun:test"

/** A real storage implementation so acknowledgement is exercised through the browser API. */
const sessionStorageCreate = (): Storage => {
  const entries = new Map<string, string>()
  return {
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size
    },
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value),
  } as Storage
}

const sessionStorage = sessionStorageCreate()

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
}))

const [
  { oidcAdminFailureStatusSelect },
  { oidcAdminSecretPanelStateCreate },
  { oidcAdminUriListParse },
  { confirmStateCreate: oidcAdminConfirmStateCreate },
  { oidcAdminSecretAcknowledgementStore },
  { oidcAdminDocumentOpenHrefSelect },
  { oidcAdminDemoIssuedSecretSeedSelect },
  { demoAdminOidcClients },
] = await Promise.all([
  import("../../src/features/oidc/ui/oidcAdminFailureStatusSelect.js"),
  import("../../src/features/oidc/ui/oidcAdminSecretPanelStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminUriListParse.js"),
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminSecretAcknowledgementStore.js"),
  import("../../src/features/oidc/ui/oidcAdminDocumentOpenHrefSelect.js"),
  import("../../src/features/oidc/ui/oidcAdminDemoIssuedSecretSeedSelect.js"),
  import("../../src/features/demo/demoAdminOidcClients.js"),
])

// A real storage is injected rather than a global `window`, which would make unrelated
// modules treat this process as a browser and change their locale resolution.
oidcAdminSecretAcknowledgementStore.storageSet(sessionStorage)
beforeEach(() => {
  sessionStorage.clear()
  oidcAdminSecretAcknowledgementStore.storageSet(sessionStorage)
})

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

describe("destructive OIDC confirmations", () => {
  test("stay closed until an action asks, and expose the localized message", () => {
    const state = oidcAdminConfirmStateCreate()

    expect(state.open()).toBe(false)
    const pending = state.confirm("Remove this OIDC client?")
    expect(state.open()).toBe(true)
    expect(state.message()).toBe("Remove this OIDC client?")
    state.accept()

    return pending.then((confirmed) => {
      expect(confirmed).toBe(true)
      expect(state.open()).toBe(false)
    })
  })

  test("cancelling declines the action and closes the prompt", async () => {
    const state = oidcAdminConfirmStateCreate()

    const pending = state.confirm("Rotate the signing key?")
    state.cancel()

    expect(await pending).toBe(false)
    expect(state.open()).toBe(false)
  })

  test("a superseding request declines the previous one so no caller waits forever", async () => {
    const state = oidcAdminConfirmStateCreate()

    const first = state.confirm("Retire this signing key?")
    const second = state.confirm("Revoke this consent?")
    state.accept()

    expect(await first).toBe(false)
    expect(await second).toBe(true)
  })
})

describe("acknowledged one-time secrets", () => {
  test("build a marker that contains no secret material and hides a re-seeded secret", () => {
    const marker = oidcAdminSecretAcknowledgementStore.markerBuild("client-1", "rotated")

    expect(marker).not.toContain("secret")
    expect(oidcAdminSecretAcknowledgementStore.acknowledged(marker)).toBe(false)
    oidcAdminSecretAcknowledgementStore.acknowledge(marker)
    // A reload re-reads the same marker, so the panel does not reappear.
    expect(oidcAdminSecretAcknowledgementStore.acknowledged(marker)).toBe(true)
    expect(
      oidcAdminSecretAcknowledgementStore.acknowledged(
        oidcAdminSecretAcknowledgementStore.markerBuild("client-2", "rotated"),
      ),
    ).toBe(false)
  })

  test("write only a non-secret marker into the browser session storage", () => {
    const marker = oidcAdminSecretAcknowledgementStore.markerBuild("client-9", "rotated")

    oidcAdminSecretAcknowledgementStore.acknowledge(marker)

    const raw = sessionStorage.getItem("authworks.oidc.acknowledged-secrets") ?? ""
    expect(JSON.parse(raw)).toContain(marker)
    expect(raw).not.toContain("top-secret")
  })

  test("survive a reload of the same browser session and stay per client", () => {
    oidcAdminSecretAcknowledgementStore.acknowledge(
      oidcAdminSecretAcknowledgementStore.markerBuild("client-reload", "rotated"),
    )

    // A reload re-reads session storage rather than any in-memory state.
    expect(
      oidcAdminSecretAcknowledgementStore.acknowledged(
        oidcAdminSecretAcknowledgementStore.markerBuild("client-reload", "rotated"),
      ),
    ).toBe(true)
    expect(
      oidcAdminSecretAcknowledgementStore.acknowledged(
        oidcAdminSecretAcknowledgementStore.markerBuild("client-other", "rotated"),
      ),
    ).toBe(false)
  })
})

describe("one-time demo secret seeding", () => {
  test("seeds the selected client rather than always the first client", () => {
    const second = demoAdminOidcClients[1]
    if (second === undefined) throw new Error("fixture is missing a second client")

    const seeded = oidcAdminDemoIssuedSecretSeedSelect({
      clientId: second.id,
      clients: demoAdminOidcClients,
      secret: "demo-secret",
    })

    expect(seeded?.clientId).toBe(second.id)
    expect(seeded?.clientName).toBe(second.name)
  })

  test("seeds the first client only for a collection screen without a selection", () => {
    const seeded = oidcAdminDemoIssuedSecretSeedSelect({
      clientId: undefined,
      clients: demoAdminOidcClients,
      secret: "demo-secret",
    })

    expect(seeded?.clientId).toBe(demoAdminOidcClients[0]?.id)
  })

  test("seeds nothing for an unknown client so no foreign identity is shown", () => {
    expect(
      oidcAdminDemoIssuedSecretSeedSelect({
        clientId: "missing",
        clients: demoAdminOidcClients,
        secret: "demo-secret",
      }),
    ).toBeUndefined()
  })
})

describe("read-only protocol document endpoints", () => {
  test("offers an open control only for an endpoint this origin actually serves", () => {
    expect(oidcAdminDocumentOpenHrefSelect("https://auth.example/.well-known/jwks.json", "https://auth.example")).toBe(
      "https://auth.example/.well-known/jwks.json",
    )
    // A stateless demo fixture points at an unreachable host, so no broken link is rendered.
    expect(
      oidcAdminDocumentOpenHrefSelect("https://auth.demo.example/.well-known/jwks.json", "https://localhost:5173"),
    ).toBeUndefined()
    expect(oidcAdminDocumentOpenHrefSelect("not a url", "https://auth.example")).toBeUndefined()
    expect(oidcAdminDocumentOpenHrefSelect("https://auth.example/x", undefined)).toBeUndefined()
  })
})

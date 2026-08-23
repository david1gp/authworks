import { beforeEach, describe, expect, test } from "bun:test"
import { accountRecoveryCodeAcknowledgementStore } from "../../src/features/account/ui/accountRecoveryCodeAcknowledgementStore.js"

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
const storageKey = "authworks.account.acknowledged-recovery-codes"

// A real storage is injected rather than a global `window`, which would make unrelated
// modules treat this process as a browser and change their locale resolution.
accountRecoveryCodeAcknowledgementStore.storageSet(sessionStorage)
beforeEach(() => {
  sessionStorage.clear()
  accountRecoveryCodeAcknowledgementStore.storageSet(sessionStorage)
})

describe("acknowledged one-time recovery codes", () => {
  test("build a marker from the issuance identity that contains no code material", () => {
    const marker = accountRecoveryCodeAcknowledgementStore.markerBuild("user-1", 1_700_000_000_000)

    expect(marker).toBe("user-1:1700000000000")
    expect(marker).not.toContain("AX7K")
  })

  test("hide re-seeded codes after a dismissal and stay per issuance", () => {
    const marker = accountRecoveryCodeAcknowledgementStore.markerBuild("user-1", 1_700_000_000_000)

    expect(accountRecoveryCodeAcknowledgementStore.acknowledged(marker)).toBe(false)
    accountRecoveryCodeAcknowledgementStore.acknowledge(marker)
    // A reload re-reads the same marker, so the panel does not reappear.
    expect(accountRecoveryCodeAcknowledgementStore.acknowledged(marker)).toBe(true)
    // A regenerated issuance is a different marker and is shown again.
    expect(
      accountRecoveryCodeAcknowledgementStore.acknowledged(
        accountRecoveryCodeAcknowledgementStore.markerBuild("user-1", 1_700_000_999_000),
      ),
    ).toBe(false)
    expect(
      accountRecoveryCodeAcknowledgementStore.acknowledged(
        accountRecoveryCodeAcknowledgementStore.markerBuild("user-2", 1_700_000_000_000),
      ),
    ).toBe(false)
  })

  test("treat a missing issuance timestamp as a stable initial issuance", () => {
    const marker = accountRecoveryCodeAcknowledgementStore.markerBuild("user-1", undefined)

    accountRecoveryCodeAcknowledgementStore.acknowledge(marker)

    expect(
      accountRecoveryCodeAcknowledgementStore.acknowledged(
        accountRecoveryCodeAcknowledgementStore.markerBuild("user-1", null),
      ),
    ).toBe(true)
  })

  test("write only a non-secret marker into the browser session storage", () => {
    const marker = accountRecoveryCodeAcknowledgementStore.markerBuild("user-9", 1_700_000_000_000)

    accountRecoveryCodeAcknowledgementStore.acknowledge(marker)

    const raw = sessionStorage.getItem(storageKey) ?? ""
    expect(JSON.parse(raw)).toContain(marker)
    expect(raw).not.toContain("AX7K-2QPL")
    expect(raw).not.toContain("B9MN-4TRS")
  })

  test("survive a reload of the same browser session", () => {
    accountRecoveryCodeAcknowledgementStore.acknowledge(
      accountRecoveryCodeAcknowledgementStore.markerBuild("user-reload", 1_700_000_000_000),
    )

    // A reload re-reads session storage rather than any in-memory state.
    accountRecoveryCodeAcknowledgementStore.storageSet(sessionStorage)

    expect(
      accountRecoveryCodeAcknowledgementStore.acknowledged(
        accountRecoveryCodeAcknowledgementStore.markerBuild("user-reload", 1_700_000_000_000),
      ),
    ).toBe(true)
  })

  test("keep working without any storage so a blocked partition cannot break the screen", () => {
    accountRecoveryCodeAcknowledgementStore.storageSet(undefined)
    const marker = accountRecoveryCodeAcknowledgementStore.markerBuild("user-memory", 1_700_000_000_000)

    accountRecoveryCodeAcknowledgementStore.acknowledge(marker)

    expect(accountRecoveryCodeAcknowledgementStore.acknowledged(marker)).toBe(true)
  })
})

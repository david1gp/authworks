import { afterEach, describe, expect, test } from "bun:test"
import { Window } from "happy-dom"
import { createRoot } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { UserExportResponse } from "../../users/public/userExportResponseSchema.js"
import { accountDemoAdapterCreate } from "./accountDemoAdapterCreate.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

const cleanups: (() => void)[] = []
const submitEvent = { preventDefault: () => {} } as SubmitEvent

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function deletionStateCreate() {
  const adapter = accountDemoAdapterCreate(() => "success")
  let deleteCalls = 0
  const state = createRoot((dispose) => {
    cleanups.push(dispose)
    return accountPageStateCreate({
      adapter: {
        ...adapter,
        deleteAccount: async () => {
          deleteCalls += 1
          return adapter.deleteAccount()
        },
      },
      initialStatus: "loading",
      kind: "delete",
    })
  })
  return { state, deleteCalls: () => deleteCalls }
}

describe("account deletion dialog state", () => {
  test("requires an open dialog, matching email and the existing confirmation before deletion", async () => {
    const { state, deleteCalls } = deletionStateCreate()
    await state.load(true)
    state.deletionConfirmation.set(state.user.get()?.email ?? "")
    await state.accountDelete(submitEvent)
    expect(deleteCalls()).toBe(0)

    state.deletionDialogOpenSet(true)
    state.deletionConfirmation.set("wrong@example.com")
    await state.accountDelete(submitEvent)
    expect(state.validationMessage.get()).toBe("The email address does not match.")
    expect(state.confirmation.open()).toBe(false)
    expect(deleteCalls()).toBe(0)

    state.deletionConfirmation.set(state.user.get()?.email ?? "")
    const cancelled = state.accountDelete(submitEvent)
    expect(state.confirmation.open()).toBe(true)
    expect(state.deletionPending.get()).toBe(true)
    state.deletionDialogOpenSet(false)
    expect(state.deletionDialogOpen.get()).toBe(true)
    state.confirmation.cancel()
    await cancelled
    expect(state.deletionPending.get()).toBe(false)
    expect(state.deletionDialogOpen.get()).toBe(true)
    expect(deleteCalls()).toBe(0)

    state.deletionDialogOpenSet(false)
    expect(state.deletionConfirmation.get()).toBe("")
    expect(state.validationMessage.get()).toBeUndefined()
    state.deletionDialogOpenSet(true)
    expect(state.deletionConfirmation.get()).toBe("")
  })

  test("blocks duplicate submissions while confirming and shows success only after accepting", async () => {
    const { state, deleteCalls } = deletionStateCreate()
    await state.load(true)
    state.deletionDialogOpenSet(true)
    state.deletionConfirmation.set(state.user.get()?.email ?? "")

    const submitted = state.accountDelete(submitEvent)
    await state.accountDelete(submitEvent)
    expect(state.confirmation.open()).toBe(true)
    state.confirmation.accept()
    await submitted

    expect(deleteCalls()).toBe(1)
    expect(state.status.get()).toBe("success")
    expect(state.user.get()?.state).toBe("deleted")
    expect(state.deletionDialogOpen.get()).toBe(false)
    expect(state.deletionConfirmation.get()).toBe("")
  })

  test("preserves error and retry behavior when deletion fails on the server", async () => {
    const available = accountDemoAdapterCreate(() => "success")
    const failure = accountDemoAdapterCreate(() => "error")
    const retryState = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountPageStateCreate({
        adapter: { ...available, deleteAccount: failure.deleteAccount },
        initialStatus: "loading",
        kind: "delete",
      })
    })
    await retryState.load(true)
    retryState.deletionDialogOpenSet(true)
    retryState.deletionConfirmation.set(retryState.user.get()?.email ?? "")
    const submitted = retryState.accountDelete(submitEvent)
    retryState.confirmation.accept()
    await submitted

    expect(retryState.status.get()).toBe("error")
    expect(retryState.errorMessage.get()).toBeTruthy()
    expect(retryState.deletionPending.get()).toBe(false)
    await retryState.load(true)
    expect(retryState.status.get()).toBe("ready")
    expect(retryState.deletionDialogOpen.get()).toBe(false)
    expect(retryState.deletionConfirmation.get()).toBe("")
  })
})

describe("account password change", () => {
  test("notifies onPasswordChanged only after a successful password save", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    let notifications = 0
    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountPageStateCreate({
        adapter,
        initialStatus: "ready",
        kind: "password",
        onPasswordChanged: () => {
          notifications += 1
        },
      })
    })
    state.newPassword.set("new-password-12")
    state.confirmPassword.set("new-password-12")
    await state.passwordSubmit(submitEvent)
    expect(state.status.get()).toBe("success")
    expect(notifications).toBe(1)
  })

  test("does not notify onPasswordChanged when the password save fails", async () => {
    const adapter = accountDemoAdapterCreate(() => "error")
    let notifications = 0
    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountPageStateCreate({
        adapter,
        initialStatus: "ready",
        kind: "password",
        onPasswordChanged: () => {
          notifications += 1
        },
      })
    })
    state.newPassword.set("new-password-12")
    state.confirmPassword.set("new-password-12")
    await state.passwordSubmit(submitEvent)
    expect(state.status.get()).toBe("error")
    expect(notifications).toBe(0)
  })
})

describe("account export download", () => {
  const exportFixture: UserExportResponse = {
    consents: [],
    emails: [],
    externalIdentities: [],
    memberships: [],
    mfa: { emailOtp: false, passkeyCount: 0, password: true, recoveryCodesAvailable: false, totpEnrolled: false },
    passkeys: [],
    phone: null,
    profile: accountDemoUserFixture.profile,
    sessions: [],
    state: "active",
    userId: accountDemoUserFixture.id,
    userName: accountDemoUserFixture.userName,
  }

  const domInstall = () => {
    const browserWindow = new Window()
    const globalValues = globalThis as unknown as Record<string, unknown>
    const previous = new Map<string, unknown>()
    for (const name of ["document", "window"] as const) {
      previous.set(name, globalValues[name])
      globalValues[name] = name === "document" ? browserWindow.document : browserWindow
    }
    const restore = () => {
      for (const [name, value] of previous) {
        if (value === undefined) delete globalValues[name]
        else globalValues[name] = value
      }
    }
    cleanups.push(restore)
    return restore
  }

  test("downloads the export payload through the adapter exactly once", async () => {
    const restore = domInstall()
    let exportCalls = 0
    const downloaded: string[] = []
    const createdUrls: string[] = []
    const urlGlobals = URL as unknown as { revokeObjectURL?: (url: string) => void }
    const originalRevokeObjectURL = urlGlobals.revokeObjectURL
    const originalCreateObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (() => {
      createdUrls.push("blob:account-export")
      return "blob:account-export"
    }) as typeof URL.createObjectURL
    urlGlobals.revokeObjectURL = () => {}
    const originalCreateElement = document.createElement.bind(document)
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options)
      if (tagName === "a") {
        element.addEventListener("click", () => downloaded.push((element as HTMLAnchorElement).href))
      }
      return element
    }) as typeof document.createElement
    try {
      const adapter = {
        ...accountDemoAdapterCreate(() => "success"),
        exportData: async () => {
          exportCalls += 1
          return resultCreate(exportFixture)
        },
      }
      const state = createRoot((dispose) => {
        cleanups.push(dispose)
        return accountPageStateCreate({ adapter, initialStatus: "ready", kind: "overview" })
      })
      await state.load(true)

      await state.exportDownload()

      expect(exportCalls).toBe(1)
      expect(state.exportPending.get()).toBe(false)
      expect(state.exportError.get()).toBeUndefined()
      expect(downloaded).toEqual(["blob:account-export"])
      expect(createdUrls).toEqual(["blob:account-export"])
    } finally {
      URL.createObjectURL = originalCreateObjectURL
      if (originalRevokeObjectURL === undefined) delete urlGlobals.revokeObjectURL
      else urlGlobals.revokeObjectURL = originalRevokeObjectURL
      document.createElement = originalCreateElement
      restore()
    }
  })

  test("surfaces adapter failures without downloading", async () => {
    const adapter = {
      ...accountDemoAdapterCreate(() => "success"),
      exportData: async () => resultErrorCodedCreate("accountExportGet", "The export failed.", "users.read-failed"),
    }
    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountPageStateCreate({ adapter, initialStatus: "ready", kind: "overview" })
    })
    await state.load(true)

    await state.exportDownload()

    expect(state.exportPending.get()).toBe(false)
    expect(state.exportError.get()).toBe("The export failed.")
  })

  test("reports an unavailable export when the adapter has no export transport", async () => {
    const { exportData: _removed, ...adapter } = accountDemoAdapterCreate(() => "success")
    const state = createRoot((dispose) => {
      cleanups.push(dispose)
      return accountPageStateCreate({ adapter, initialStatus: "ready", kind: "overview" })
    })
    await state.load(true)

    await state.exportDownload()

    expect(state.exportPending.get()).toBe(false)
    expect(state.exportError.get()).toBe("The data export is unavailable right now.")
  })
})

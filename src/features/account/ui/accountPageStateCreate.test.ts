import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { accountDemoAdapterCreate } from "./accountDemoAdapterCreate.js"
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

import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  onMount: () => {},
}))

const [{ accountDemoAdapterCreate }, { accountPageStateCreate }] = await Promise.all([
  import("../../src/features/account/ui/accountDemoAdapterCreate.js"),
  import("../../src/features/account/ui/accountPageStateCreate.js"),
])

const submitEvent = { preventDefault: () => {} } as SubmitEvent

describe("account email-address state", () => {
  test("lists addresses and adds a verified secondary address", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    const state = accountPageStateCreate({ adapter, initialStatus: "ready", kind: "email" })
    await state.load(true)

    expect(state.emailAddresses.get()).toMatchObject([
      { email: "avery.stone@example.com", isPrimary: true, verified: true },
      { email: "avery.secondary@example.com", isPrimary: false, verified: true },
    ])

    state.emailCandidate.set("avery.new@example.com")
    await state.emailAddressAddStart(submitEvent)
    expect(state.emailChallengeId.get()).toBe("account-demo-email-address-add")
    expect(state.emailStatus.get()).toBe("code")

    await state.emailAddressAddResend()
    expect(state.emailStatus.get()).toBe("code")
    state.emailToken.set("demo-email-address-token-000000000000000000000")
    await state.emailAddressAddVerify(submitEvent)

    expect(state.emailAddresses.get()).toContainEqual(
      expect.objectContaining({ email: "avery.new@example.com", isPrimary: false, verified: true }),
    )
    expect(state.user.get()?.email).toBe("avery.stone@example.com")
    expect(state.emailStatus.get()).toBe("success")
  })

  test("promotes a verified secondary and refuses to remove the primary", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    let removeCalls = 0
    const state = accountPageStateCreate({
      adapter: {
        ...adapter,
        emailAddressRemove: async (emailId) => {
          removeCalls += 1
          return adapter.emailAddressRemove(emailId)
        },
      },
      initialStatus: "ready",
      kind: "email",
    })
    await state.load(true)

    await state.emailAddressRemove("account-demo-email-primary")
    expect(removeCalls).toBe(0)
    expect(state.emailAddresses.get()).toHaveLength(2)

    await state.emailAddressPrimarySet("account-demo-email-secondary")
    expect(state.user.get()?.email).toBe("avery.secondary@example.com")
    expect(state.emailAddresses.get().find((address) => address.id === "account-demo-email-secondary")?.isPrimary).toBe(
      true,
    )

    await state.emailAddressRemove("account-demo-email-primary")
    expect(removeCalls).toBe(1)
    expect(state.emailAddresses.get()).toHaveLength(1)
  })

  test("validates add and verify input before calling the adapter", async () => {
    const adapter = accountDemoAdapterCreate(() => "success")
    let starts = 0
    let verifies = 0
    const state = accountPageStateCreate({
      adapter: {
        ...adapter,
        emailAddressAddStart: async (input) => {
          starts += 1
          return adapter.emailAddressAddStart(input)
        },
        emailAddressAddVerify: async (input) => {
          verifies += 1
          return adapter.emailAddressAddVerify(input)
        },
      },
      initialStatus: "ready",
      kind: "email",
    })

    state.emailCandidate.set("not-an-email")
    await state.emailAddressAddStart(submitEvent)
    expect(starts).toBe(0)
    expect(state.emailValidationMessage.get()).toBe("Enter a valid email address.")

    state.emailCandidate.set("avery.new@example.com")
    await state.emailAddressAddStart(submitEvent)
    state.emailToken.set("too-short")
    await state.emailAddressAddVerify(submitEvent)
    expect(starts).toBe(1)
    expect(verifies).toBe(0)
    expect(state.emailValidationMessage.get()).toBe("Enter the verification token from the email.")
  })
})

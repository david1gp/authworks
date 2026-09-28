import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { accountEmailAddressViewStateCreate } from "./accountEmailAddressViewStateCreate.js"

const address = (id: string, isPrimary: boolean, verified: boolean): UserEmailAddress => ({
  createdAt: 1,
  email: `${id}@example.com`,
  id,
  isPrimary,
  updatedAt: 1,
  verified,
  verifiedAt: verified ? 1 : null,
  version: 1,
})

test("email card summary follows the primary address and its verification state without changing data", () => {
  createRoot((dispose) => {
    const addresses = createSignalObject<readonly UserEmailAddress[]>([])
    const state = accountEmailAddressViewStateCreate(addresses.get)

    expect(state.summaryValue()).toBe("Email not set")
    expect(state.summaryStatus()).toBe("Not set")
    expect(state.summaryTone()).toBe("neutral")
    addresses.set([address("first", true, false), address("second", false, true)])
    expect(state.summaryValue()).toBe("first@example.com")
    expect(state.summaryStatus()).toBe("Verification pending")
    addresses.set([address("first", false, false), address("second", true, true)])
    expect(state.summaryValue()).toBe("second@example.com")
    expect(state.summaryStatus()).toBe("Verified")
    expect(state.summaryTone()).toBe("success")
    dispose()
  })
})

test("email row selection opens only its own dialog and closes when its address is removed", () => {
  createRoot((dispose) => {
    const addresses = createSignalObject<readonly UserEmailAddress[]>([
      address("first", true, true),
      address("second", false, true),
    ])
    const state = accountEmailAddressViewStateCreate(addresses.get)

    state.dialogOpenChange("second", true)
    expect(state.dialogOpen("first")).toBe(false)
    expect(state.dialogOpen("second")).toBe(true)
    state.dialogOpenChange("first", false)
    expect(state.dialogOpen("second")).toBe(true)
    addresses.set([address("first", true, true)])
    expect(state.dialogOpen("second")).toBe(false)
    state.dialogOpenChange("first", true)
    state.dialogOpenChange("first", false)
    expect(state.dialogOpen("first")).toBe(false)
    dispose()
  })
})

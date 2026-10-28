import { expect, test } from "bun:test"
import { adminActivityDemoAccessPermits } from "./adminActivityDemoAccessPermits.js"

test("member and guest demo simulations cannot discover or open Activity", () => {
  expect(adminActivityDemoAccessPermits("?as=member")).toBe(false)
  expect(adminActivityDemoAccessPermits("?as=guest")).toBe(false)
  for (const role of ["owner", "admin", "realm-admin"]) expect(adminActivityDemoAccessPermits(`?as=${role}`)).toBe(true)
})

import { expect, test } from "bun:test"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryUserListResponse } from "../public/directoryUserListSchema.js"
import { directoryEntryListPageCreate } from "./directoryEntryListPageCreate.js"

type Entry = DirectoryUserListResponse["items"][number]

function entry(id: string, state: "active" | "deleted"): Entry {
  return {
    memberships: [],
    team: null,
    user: {
      createdAt: 1,
      email: `${id}@example.com`,
      emailVerified: true,
      id,
      state,
      userName: id,
      verificationState: "verified",
    },
  } as Entry
}

function user(id: string, state: "active" | "deleted"): User {
  return { createdAt: 1, id, state } as User
}

const usersById = new Map<string, User>([
  ["anna", user("anna", "active")],
  ["zed", user("zed", "deleted")],
])
const entries: readonly Entry[] = [entry("anna", "active"), entry("zed", "deleted")]

test("people list hides deleted users unless explicitly requested", () => {
  const hidden = directoryEntryListPageCreate({ entries, usersById })
  expect(hidden.success).toBe(true)
  if (!hidden.success) throw new Error(hidden.errorMessage)
  expect(hidden.data.items.map((item) => item.user.id)).toEqual(["anna"])

  const shown = directoryEntryListPageCreate({ entries, query: { includeDeleted: true }, usersById })
  expect(shown.success).toBe(true)
  if (!shown.success) throw new Error(shown.errorMessage)
  expect(shown.data.items.map((item) => item.user.id).sort()).toEqual(["anna", "zed"])

  const onlyDeleted = directoryEntryListPageCreate({ entries, query: { state: "deleted" }, usersById })
  expect(onlyDeleted.success).toBe(true)
  if (!onlyDeleted.success) throw new Error(onlyDeleted.errorMessage)
  expect(onlyDeleted.data.items.map((item) => item.user.id)).toEqual(["zed"])
})

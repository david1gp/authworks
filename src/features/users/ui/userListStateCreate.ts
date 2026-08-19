import { useLocation, useNavigate } from "@solidjs/router"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import * as v from "valibot"
import { demoAdminUsers } from "../../demo/demoAdminUsers.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { userCreateRequestSchema } from "../public/userCreateRequestSchema.js"
import type { User } from "../public/userSchema.js"

const createSchema = v.picklist(["1", "user"])

export function userListStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const users = createSignalObject<User[]>([...demoAdminUsers])
  const query = createSignalObject(searchQueryGet(location.search))
  const email = createSignalObject("")
  const userName = createSignalObject("")
  const displayName = createSignalObject("")
  const error = createSignalObject<string | undefined>(undefined)
  const filteredUsers = () => {
    const value = query.get().toLowerCase()
    if (!value) return users.get()
    return users.get().filter((user) => `${user.userName} ${user.email} ${user.id}`.toLowerCase().includes(value))
  }
  const searchSet = (value: string) => {
    query.set(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set("q", value)
    else url.searchParams.delete("q")
    window.history.replaceState({}, "", url)
  }
  const createOpenSet = (open: boolean) => {
    const params = new URLSearchParams(location.search)
    if (open) params.set("create", "user")
    else params.delete("create")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true })
    error.set(undefined)
  }
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(userCreateRequestSchema, {
      email: email.get(),
      profile: displayName.get() ? { displayName: displayName.get() } : {},
      userName: userName.get(),
    })
    if (!result.success) {
      error.set("Enter a valid email address and username.")
      return
    }
    const timestamp = Date.now()
    const user: User = {
      createdAt: timestamp,
      email: result.output.email,
      emailVerified: false,
      id: demoResourceIdGenerate(),
      realmId: demoRealmId,
      profile: result.output.profile,
      state: "initial",
      updatedAt: timestamp,
      userName: result.output.userName,
      verificationState: "unverified",
    }
    demoAdminUsers.push(user)
    users.set([...users.get(), user])
    email.set("")
    userName.set("")
    displayName.set("")
    createOpenSet(false)
  }
  const openUser = (id: string) => navigate(`/demo/admin/users/${id}`)

  // Production would use userApiClientCreate here instead of the in-memory append.
  return {
    badgeVariant: (state: "initial" | "active" | "inactive" | "locked" | "suspended" | "deleted") =>
      (
        ({
          initial: "subtle",
          active: "filledGreen",
          inactive: "filledYellow",
          locked: "filledRed",
          suspended: "filledYellow",
          deleted: "filledRed",
        }) as const
      )[state],
    createOpen: () => createValueGet(location.search) !== undefined,
    createOpenSet,
    displayName: displayName.get,
    email: email.get,
    error: error.get,
    filteredUsers,
    onDisplayName: displayName.set,
    onEmail: email.set,
    onUserName: userName.set,
    openUser,
    query: query.get,
    searchSet,
    submit,
    userName: userName.get,
  }
}

function searchQueryGet(search: string): string {
  const value = new URLSearchParams(search).get("q")
  const result = v.safeParse(v.optional(v.string()), value ?? undefined)
  return result.success ? (result.output ?? "") : ""
}

function createValueGet(search: string): string | undefined {
  const value = new URLSearchParams(search).get("create")
  const result = v.safeParse(createSchema, value)
  return result.success ? result.output : undefined
}

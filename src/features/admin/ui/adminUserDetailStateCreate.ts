import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { User } from "../../users/public/userSchema.js"

/** Holds the editable profile draft for an administered user detail page. */
export function adminUserDetailStateCreate(user: () => User | undefined) {
  const displayName = createSignalObject("")
  const firstName = createSignalObject("")
  const lastName = createSignalObject("")
  const nickName = createSignalObject("")
  const preferredLanguage = createSignalObject("")

  createEffect(
    on(user, (current) => {
      if (current === undefined) return
      displayName.set(current.profile.displayName ?? "")
      firstName.set(current.profile.firstName ?? "")
      lastName.set(current.profile.lastName ?? "")
      nickName.set(current.profile.nickName ?? "")
      preferredLanguage.set(current.profile.preferredLanguage ?? "")
    }),
  )

  return {
    displayName,
    draft: () => ({
      displayName: displayName.get(),
      firstName: firstName.get(),
      lastName: lastName.get(),
      nickName: nickName.get(),
      preferredLanguage: preferredLanguage.get(),
    }),
    firstName,
    lastName,
    nickName,
    preferredLanguage,
  }
}

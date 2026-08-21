import type { Accessor } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { passwordApiClientCreate } from "../../passwords/client/passwordApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

export function accountProductionAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
) {
  const session = productionSessionContextGet()
  const realmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : (session.realms[0]?.id ?? "")
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin
  const users = userApiClientCreate({ baseUrl })
  const passwords = passwordApiClientCreate({ baseUrl })
  return accountPageStateCreate({
    adapter: {
      deleteAccount: () => users.userMeDelete(realmId()),
      loadUser: async () => {
        const result = await users.userMeGet(realmId())
        if (!result.success) return result
        if (result.status === "unchanged")
          return resultErrorCodedCreate(
            "accountUserLoad",
            "The account response was unchanged.",
            "platform.invalid-response",
          )
        return resultCreate(result.data)
      },
      updatePassword: (input) => passwords.passwordMeChange(realmId(), input),
      updateProfile: (input) => users.userMeProfileUpdate(realmId(), input),
    },
    kind: kind(),
  })
}

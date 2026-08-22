import type { Accessor } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { passwordApiClientCreate } from "../../passwords/client/passwordApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"

export function accountProductionAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
) {
  const session = productionSessionContextGet()
  const fallbackRealmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : (session.realms[0]?.id ?? "")
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin
  let realmIdPromise: Promise<string> | undefined
  const realmIdResolve = () => {
    realmIdPromise ??= productionRealmIdResolve({
      baseUrl,
      domain: typeof window === "undefined" ? "localhost" : window.location.host,
      fallbackRealmId: fallbackRealmId(),
    })
    return realmIdPromise
  }
  const users = userApiClientCreate({ baseUrl })
  const passwords = passwordApiClientCreate({ baseUrl })
  return accountPageStateCreate({
    adapter: {
      deleteAccount: async () => users.userMeDelete(await realmIdResolve()),
      loadUser: async () => {
        const result = await users.userMeGet(await realmIdResolve())
        if (!result.success) return result
        if (result.status === "unchanged")
          return resultErrorCodedCreate(
            "accountUserLoad",
            "The account response was unchanged.",
            "platform.invalid-response",
          )
        return resultCreate(result.data)
      },
      updatePassword: async (input) => passwords.passwordMeChange(await realmIdResolve(), input),
      updateProfile: async (input) => users.userMeProfileUpdate(await realmIdResolve(), input),
    },
    kind: kind(),
  })
}

import type { Accessor } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { passwordApiClientCreate } from "../../passwords/client/passwordApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { whatsappOtpApiClientCreate } from "../../whatsappOtp/client/whatsappOtpApiClientCreate.js"
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
  const whatsappOtp = whatsappOtpApiClientCreate({ baseUrl })
  return accountPageStateCreate({
    adapter: {
      deleteAccount: async () => users.userMeDelete(await realmIdResolve()),
      emailAddressAddResend: async (input) => users.userMeEmailAddressAddResend(await realmIdResolve(), input),
      emailAddressAddStart: async (input) => users.userMeEmailAddressAddStart(await realmIdResolve(), input),
      emailAddressAddVerify: async (input) => users.userMeEmailAddressAddVerify(await realmIdResolve(), input),
      emailAddressList: async () => {
        const result = await users.userMeEmailAddressList(await realmIdResolve())
        if (!result.success) return result
        if (result.status === "unchanged")
          return resultErrorCodedCreate(
            "accountEmailAddressList",
            "The account email-address response was unchanged.",
            "platform.invalid-response",
          )
        return resultCreate(result.data)
      },
      emailAddressPrimarySet: async (emailId) => users.userMeEmailAddressPrimarySet(await realmIdResolve(), emailId),
      emailAddressRemove: async (emailId) => users.userMeEmailAddressRemove(await realmIdResolve(), emailId),
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
      phoneChangeResend: async (input) => whatsappOtp.whatsappOtpPhoneChangeResend(await realmIdResolve(), input),
      phoneChangeStart: async (input) => whatsappOtp.whatsappOtpPhoneChangeStart(await realmIdResolve(), input),
      phoneChangeVerify: async (input) => whatsappOtp.whatsappOtpPhoneChangeVerify(await realmIdResolve(), input),
      profilePictureRemove: async () => users.userMeProfilePictureRemove(await realmIdResolve()),
      profilePictureUpload: async (file) => users.userMeProfilePictureUpload(await realmIdResolve(), file),
      updatePassword: async (input) => passwords.passwordMeChange(await realmIdResolve(), input),
      updateProfile: async (input) => users.userMeProfileUpdate(await realmIdResolve(), input),
    },
    kind: kind(),
  })
}

import { type Accessor, createEffect, on } from "solid-js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { productionRealmIdResolve } from "../../../ui/production/productionRealmIdResolve.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import type { ProductionSessionContextValue } from "../../../ui/production/productionSessionContextValue.js"
import { passwordApiClientCreate } from "../../passwords/client/passwordApiClientCreate.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import { whatsappOtpApiClientCreate } from "../../whatsappOtp/client/whatsappOtpApiClientCreate.js"
import { accountPageStateCreate } from "./accountPageStateCreate.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

export function accountProductionAdapterStateCreate(
  kind: Accessor<"delete" | "email" | "overview" | "password" | "profile">,
  options: {
    readonly initialStatus?: AccountViewStatus
    readonly realmId?: string
    readonly session?: ProductionSessionContextValue
  } = {},
) {
  const session = options.session ?? productionSessionContextGet()
  const fallbackRealmId = () => {
    const realm = session.guard.realm
    return typeof realm === "object" ? realm.realmId : (session.realms[0]?.id ?? "")
  }
  const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin
  const realmIdResolve = () => {
    if (options.realmId !== undefined) return Promise.resolve(options.realmId)
    return productionRealmIdResolve({
      baseUrl,
      domain: typeof window === "undefined" ? "localhost" : window.location.host,
      fallbackRealmId: fallbackRealmId(),
    })
  }
  const users = userApiClientCreate({ baseUrl })
  const passwords = passwordApiClientCreate({ baseUrl })
  const whatsappOtp = whatsappOtpApiClientCreate({ baseUrl })
  let userOperationTail = Promise.resolve()
  const userOperationRun = <T>(operation: () => Promise<T>) => {
    const result = userOperationTail.then(operation, operation)
    userOperationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
  const page = accountPageStateCreate({
    adapter: {
      deleteAccount: () => userOperationRun(async () => users.userMeDelete(await realmIdResolve())),
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
      emailAddressPrimarySet: (emailId) =>
        userOperationRun(async () => users.userMeEmailAddressPrimarySet(await realmIdResolve(), emailId)),
      emailAddressRemove: async (emailId) => users.userMeEmailAddressRemove(await realmIdResolve(), emailId),
      loadUser: () =>
        userOperationRun(async () => {
          const result = await users.userMeGet(await realmIdResolve())
          if (!result.success) return result
          if (result.status === "unchanged")
            return resultErrorCodedCreate(
              "accountUserLoad",
              "The account response was unchanged.",
              "platform.invalid-response",
            )
          return resultCreate({ user: result.data.user })
        }),
      phoneChangeResend: async (input) => whatsappOtp.whatsappOtpPhoneChangeResend(await realmIdResolve(), input),
      phoneChangeStart: async (input) => whatsappOtp.whatsappOtpPhoneChangeStart(await realmIdResolve(), input),
      phoneChangeVerify: (input) =>
        userOperationRun(async () => whatsappOtp.whatsappOtpPhoneChangeVerify(await realmIdResolve(), input)),
      profilePictureRemove: () =>
        userOperationRun(async () => users.userMeProfilePictureRemove(await realmIdResolve())),
      profilePictureUpload: (file) =>
        userOperationRun(async () => users.userMeProfilePictureUpload(await realmIdResolve(), file)),
      updatePassword: async (input) => passwords.passwordMeChange(await realmIdResolve(), input),
      updateProfile: (input) => userOperationRun(async () => users.userMeProfileUpdate(await realmIdResolve(), input)),
    },
    initialStatus: options.initialStatus,
    kind,
  })
  createEffect(
    on(
      kind,
      () => {
        void page.load(true)
      },
      { defer: true },
    ),
  )
  return page
}

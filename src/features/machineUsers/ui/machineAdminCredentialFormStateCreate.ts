import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MachineAdminPageState } from "./machineAdminPageStateCreate.js"
import { machineAdminScopeListParse } from "./machineAdminScopeListParse.js"

/**
 * Shared issue form for personal access tokens and API keys. An empty expiry means the
 * credential does not expire, which is stated explicitly in the view rather than implied.
 */
export function machineAdminCredentialFormStateCreate(options: {
  readonly kind: () => "api_key" | "personal_access_token"
  readonly machineUserId: () => string | undefined
  readonly onIssued: () => void
  readonly page: MachineAdminPageState
}) {
  const name = createSignalObject("")
  const scopes = createSignalObject("")
  const expiresAt = createSignalObject("")
  const formError = createSignalObject<string | undefined>(undefined)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const machineUserId = options.machineUserId()
    if (machineUserId === undefined) return
    if (name.get().trim().length === 0) {
      formError.set(messageTranslate("admin.machine.credentials.nameRequired"))
      return
    }
    const expiryInput = expiresAt.get().trim()
    const expiryTimestamp = expiryInput.length === 0 ? undefined : Date.parse(expiryInput)
    if (expiryTimestamp !== undefined && Number.isNaN(expiryTimestamp)) {
      formError.set(messageTranslate("admin.machine.credentials.expiryInvalid"))
      return
    }
    if (expiryTimestamp !== undefined && expiryTimestamp <= options.page.now()) {
      formError.set(messageTranslate("admin.machine.credentials.expiryPast"))
      return
    }
    const parsedScopes = machineAdminScopeListParse(scopes.get())
    formError.set(undefined)

    const input = {
      ...(expiryTimestamp === undefined ? {} : { expiresAt: expiryTimestamp }),
      name: name.get().trim(),
      ...(parsedScopes.length === 0 ? {} : { scopes: [...parsedScopes] }),
    } satisfies { expiresAt?: number; name: string; scopes?: string[] }
    const issued =
      options.kind() === "api_key"
        ? await options.page.apiKeyCreate(machineUserId, input)
        : await options.page.personalAccessTokenCreate(machineUserId, input)
    if (!issued) return
    name.set("")
    scopes.set("")
    expiresAt.set("")
    options.onIssued()
  }

  return {
    expiresAt,
    formError: formError.get,
    kind: options.kind,
    name,
    page: options.page,
    scopes,
    submit,
  }
}

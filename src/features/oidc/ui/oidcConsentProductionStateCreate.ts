import { onMount } from "solid-js"
import type { ResultErr } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { loginInteractionHandleSelect } from "../../login/model/loginInteractionHandleSelect.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcInteractionDetails } from "../public/oidcInteractionDetailsSchema.js"
import { oidcConsentScopeLabelSelect } from "./oidcConsentScopeLabelSelect.js"

type OidcConsentProductionClient = Pick<
  ReturnType<typeof oidcApiClientCreate>,
  "oidcConsentBrowserDecide" | "oidcInteractionBrowserGet"
>

type OidcConsentProductionStateCreateOptions = {
  readonly assign?: (url: string) => void
  readonly baseUrl?: string
  readonly client?: OidcConsentProductionClient
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly search?: () => string
}

export type OidcConsentProductionStatus = "invalid" | "loading" | "missing" | "ready" | "unauthenticated"

export type OidcConsentProductionState = ReturnType<typeof oidcConsentProductionStateCreate>

/**
 * Production consent view state. Reads the interaction handle from the URL, loads the
 * authorization request through the browser client, and follows the server-provided
 * redirect after an approve or deny decision. Errors never surface raw codes; the view
 * renders catalog messages for each status.
 */
export function oidcConsentProductionStateCreate(options: OidcConsentProductionStateCreateOptions = {}) {
  const search = options.search ?? (() => window.location.search)
  const assign = options.assign ?? ((url: string) => window.location.assign(url))
  const api =
    options.client ??
    oidcApiClientCreate({
      baseUrl: options.baseUrl ?? window.location.origin,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    })
  const rawHandle = () => new URLSearchParams(search()).get("interaction")
  const handle = () => loginInteractionHandleSelect(rawHandle())
  const initialStatus = (): OidcConsentProductionStatus => {
    if (rawHandle() === null) return "missing"
    return handle() === undefined ? "invalid" : "loading"
  }
  const status = createSignalObject<OidcConsentProductionStatus>(initialStatus())
  const details = createSignalObject<OidcInteractionDetails | undefined>(undefined)
  const deciding = createSignalObject<"approve" | "deny" | undefined>(undefined)

  const statusFromResult = (result: ResultErr): OidcConsentProductionStatus =>
    result.code === "oidc.unauthorized" || result.statusCode === 401 ? "unauthenticated" : "invalid"

  const load = async (): Promise<void> => {
    const current = handle()
    if (rawHandle() === null) {
      details.set(undefined)
      status.set("missing")
      return
    }
    if (current === undefined) {
      details.set(undefined)
      status.set("invalid")
      return
    }
    status.set("loading")
    const result = await api.oidcInteractionBrowserGet(current)
    if (!result.success) {
      details.set(undefined)
      status.set(statusFromResult(result))
      return
    }
    if (result.status !== "current") {
      details.set(undefined)
      status.set("invalid")
      return
    }
    details.set(result.data)
    status.set("ready")
  }

  const decide = (decision: "approve" | "deny") => async (): Promise<void> => {
    const current = handle()
    const loaded = details.get()
    if (current === undefined || loaded === undefined || deciding.get() !== undefined) return
    deciding.set(decision)
    const result = await api.oidcConsentBrowserDecide(loaded.realm_id, current, decision)
    if (result.success) {
      assign(result.data)
      return
    }
    deciding.set(undefined)
    details.set(undefined)
    status.set(statusFromResult(result))
  }

  onMount(() => {
    void load()
  })

  return {
    approve: decide("approve"),
    deciding: deciding.get,
    deny: decide("deny"),
    details: details.get,
    load,
    scopes: () =>
      (details.get()?.scopes ?? []).map((scope) => {
        const key = oidcConsentScopeLabelSelect(scope)
        return { label: key === undefined ? scope : messageTranslate(key), raw: scope }
      }),
    signIn: () => assign(signInHref()),
    signInHref,
    status: status.get,
  }

  function signInHref(): string {
    const current = handle()
    return current === undefined ? "/login" : `/login?interaction=${encodeURIComponent(current)}`
  }
}

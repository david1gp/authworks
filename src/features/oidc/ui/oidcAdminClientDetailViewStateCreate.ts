import { createEffect, on } from "solid-js"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { oidcClientUpdateRequestSchema } from "../public/oidcClientUpdateRequestSchema.js"
import type { OidcAdminPageState } from "./oidcAdminPageStateCreate.js"
import { oidcAdminScopesSupported } from "./oidcAdminScopesSupported.js"
import { oidcAdminUriListParse } from "./oidcAdminUriListParse.js"

/**
 * View state for a single OIDC client. The editable form mirrors the loaded client, and the
 * client secret is write-only: it can be rotated or revoked but never read back.
 */
export function oidcAdminClientDetailViewStateCreate(options: {
  readonly onRemoved: () => void
  readonly page: OidcAdminPageState
}) {
  const name = createSignalObject("")
  const redirectUris = createSignalObject("")
  const postLogoutRedirectUris = createSignalObject("")
  const scopes = createSignalObject<readonly string[]>([])
  const requireConsent = createSignalObject(true)
  const trusted = createSignalObject(false)
  const formError = createSignalObject<string | undefined>(undefined)

  createEffect(
    on(
      () => options.page.client(),
      (client) => {
        if (client === undefined) return
        name.set(client.name)
        redirectUris.set(client.redirectUris.join("\n"))
        postLogoutRedirectUris.set(client.postLogoutRedirectUris.join("\n"))
        scopes.set([...client.allowedScopes])
        requireConsent.set(client.requireConsent)
        trusted.set(client.trusted)
      },
    ),
  )

  return {
    formError: formError.get,
    name,
    page: options.page,
    postLogoutRedirectUris,
    redirectUris,
    requireConsent,
    scopeToggle: (scope: string) =>
      scopes.set(
        scopes.get().includes(scope) ? scopes.get().filter((item) => item !== scope) : [...scopes.get(), scope],
      ),
    scopes: scopes.get,
    scopesSupported: oidcAdminScopesSupported,
    settingsSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      const client = options.page.client()
      if (client === undefined) return
      const parsed = v.safeParse(oidcClientUpdateRequestSchema, {
        allowedScopes: [...scopes.get()],
        name: name.get(),
        postLogoutRedirectUris: [...oidcAdminUriListParse(postLogoutRedirectUris.get())],
        redirectUris: [...oidcAdminUriListParse(redirectUris.get())],
        requireConsent: requireConsent.get(),
        trusted: trusted.get(),
      })
      if (!parsed.success) {
        formError.set(messageTranslate("admin.oidc.clients.invalid"))
        return
      }
      formError.set(undefined)
      void options.page.clientUpdate(client.id, parsed.output)
    },
    trusted,
    clientRemove: async (clientId: string) => {
      await options.page.clientLifecycleSet(clientId, "removed")
      if (options.page.client()?.status === "removed") options.onRemoved()
    },
  }
}

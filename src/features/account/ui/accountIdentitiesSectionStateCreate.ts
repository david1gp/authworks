import { useLocation, useNavigate } from "@solidjs/router"
import { type Accessor, createEffect, on } from "solid-js"
import * as v from "valibot"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import {
  externalIdentitySchema,
  type ExternalIdentity,
} from "../../externalIdentities/public/externalIdentitySchema.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

type IdentityState = Pick<
  AccountSecurityViewState,
  | "error"
  | "identities"
  | "identityLinkCancel"
  | "identityLinkConfirm"
  | "identityLinkConfirmation"
  | "identityLinkProvider"
  | "identityProviderLinked"
  | "identityProviders"
  | "pendingId"
>

const linkDialogSchema = v.literal("open")

/** URL-held presentation only; provider callbacks, confirmation tokens and mutations stay in the adapter. */
export function accountIdentitiesSectionStateCreate(security: Accessor<IdentityState>) {
  const location = useLocation()
  const navigate = useNavigate()
  const count = () => security().identities().length
  const availableProviders = () =>
    security()
      .identityProviders()
      .filter((provider) => provider.enabled && !security().identityProviderLinked(provider.id))
  const linkAvailable = () =>
    availableProviders().length > 0 ||
    security().identityLinkProvider() !== undefined ||
    security().identityLinkConfirmation() !== undefined
  const selectedId = () => {
    const parsed = v.safeParse(
      externalIdentitySchema.entries.id,
      new URLSearchParams(location.search).get("accountIdentity"),
    )
    return parsed.success ? parsed.output : undefined
  }
  const linkDialogOpen = () =>
    linkAvailable() &&
    v.safeParse(linkDialogSchema, new URLSearchParams(location.search).get("accountIdentityLink")).success
  const selectionReplace = (id: string | undefined, link: boolean) => {
    const params = new URLSearchParams(location.search)
    params.delete("accountIdentity")
    params.delete("accountIdentityLink")
    if (id !== undefined) params.set("accountIdentity", id)
    if (link) params.set("accountIdentityLink", "open")
    const search = params.toString()
    navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true, scroll: false })
  }
  const dialogOpen = (id: string) =>
    !linkDialogOpen() &&
    selectedId() === id &&
    security()
      .identities()
      .some((identity) => identity.id === id)
  const dialogOpenChange = (id: string, open: boolean) => {
    if (open) {
      if (
        security()
          .identities()
          .some((identity) => identity.id === id)
      )
        selectionReplace(id, false)
      return
    }
    if (selectedId() === id && !linkDialogOpen()) selectionReplace(undefined, false)
  }
  const linkDialogOpenChange = (open: boolean) => {
    if (security().pendingId() === "identity:link:confirm") return
    if (open && !linkAvailable()) return
    selectionReplace(undefined, open)
  }
  const providerLabel = (providerId: string | undefined) =>
    security()
      .identityProviders()
      .find((provider) => provider.id === providerId)?.displayName
  const identityLabel = (identity: ExternalIdentity) => providerLabel(identity.providerId) ?? identity.providerType
  const identityValue = (identity: ExternalIdentity) =>
    identity.email ?? identity.username ?? identity.displayName ?? identity.externalSubject

  // A callback can arrive after the user closes the picker or collapses the card. Keep explicit
  // confirmation reachable in a dialog, without ever linking as a side effect of opening it.
  createEffect(
    on(
      () => security().identityLinkConfirmation(),
      (confirmation) => {
        if (confirmation !== undefined && !linkDialogOpen()) selectionReplace(undefined, true)
      },
    ),
  )

  return {
    availableProviders,
    count,
    dialogOpen,
    dialogOpenChange,
    identityLabel,
    identityTitle: (identity: ExternalIdentity) =>
      messageTranslate("account.identities.manage", {
        provider: identityLabel(identity),
        account: identityValue(identity),
      }),
    identityValue,
    linkAvailable,
    linkConfirm: async () => {
      if (security().pendingId() !== undefined || security().identityLinkConfirmation() === undefined) return
      await security().identityLinkConfirm()
      if (security().identityLinkConfirmation() === undefined && security().error() === undefined) {
        selectionReplace(undefined, false)
      }
    },
    linkCancel: () => {
      if (security().pendingId() !== undefined) return
      security().identityLinkCancel()
      selectionReplace(undefined, false)
    },
    linkDialogOpen,
    linkDialogOpenChange,
    linkProviderLabel: () =>
      providerLabel(security().identityLinkProvider()) ?? messageTranslate("account.identities.externalAccount"),
    summaryStatus: () => messageTranslate(count() > 0 ? "account.status.configured" : "account.status.notConfigured"),
    summaryTone: () => (count() > 0 ? ("success" as const) : ("neutral" as const)),
    summaryValue: () => messageTranslate("account.security.identityCount", { count: count() }),
  }
}

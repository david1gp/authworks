import { mdiAccountGroupOutline } from "@adaptive-ds/mdi/mdiAccountGroupOutline.js"
import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiDevices } from "@adaptive-ds/mdi/mdiDevices.js"
import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiHistory } from "@adaptive-ds/mdi/mdiHistory.js"
import { mdiPencilOutline } from "@adaptive-ds/mdi/mdiPencilOutline.js"
import { mdiShieldAccountOutline } from "@adaptive-ds/mdi/mdiShieldAccountOutline.js"
import { mdiWhatsapp } from "@adaptive-ds/mdi/mdiWhatsapp.js"
import { A, useLocation, useNavigate } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedCopyableId } from "../../../ui/authenticated/AuthenticatedCopyableId.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedStatTile } from "../../../ui/authenticated/AuthenticatedStatTile.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { AdminEventTable } from "./AdminEventTable.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminRealmQueryParse } from "./adminRealmQuerySchema.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"
import { adminWhatsappViewStateCreate } from "./adminWhatsappViewStateCreate.js"

const dialogQuerySet = (
  pathname: string,
  search: string,
  navigate: (href: string, options?: { replace?: boolean }) => void,
  dialog: "edit-realm" | undefined,
) => {
  const params = new URLSearchParams(search)
  if (dialog === undefined) params.delete("dialog")
  else params.set("dialog", dialog)
  const encoded = params.toString()
  navigate(`${pathname}${encoded.length === 0 ? "" : `?${encoded}`}`, { replace: true })
}

/** Merged realm overview and settings: identity header, editable settings, and explore links. */
export function AdminRealmView(props: {
  readonly basePath: string
  readonly state: ReturnType<typeof adminPageStateCreate>
  readonly usersHref: string
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const whatsapp = adminWhatsappViewStateCreate({ usage: () => props.state.whatsappUsage() })
  const dialogOpenSet = (dialog: "edit-realm" | undefined) =>
    dialogQuerySet(location.pathname, location.search, navigate, dialog)
  const dialogOpen = () => adminRealmQueryParse(location.search).dialog === "edit-realm"
  const realmStatusValue = {
    get: (): string => props.state.realmStatus.get(),
    set: (value: string) => props.state.realmStatus.set(value === "disabled" ? "disabled" : "active"),
  }

  return (
    <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <Show when={props.state.notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>

      <Show when={props.state.status() === "permission-denied" && props.state.realm()}>
        <AuthenticatedNotice message={messageTranslate("admin.realm.permissionDenied")} tone="danger" />
      </Show>

      <Show
        when={props.state.status() === "ready" || (props.state.status() === "permission-denied" && props.state.realm())}
        fallback={
          <ProductionStatePanel
            detail={
              props.state.status() === "permission-denied"
                ? messageTranslate("admin.realm.permissionDenied")
                : props.state.error()
            }
            onRetry={props.state.status() === "error" ? props.state.reload : undefined}
            state={adminViewStatusPanelState(props.state.status())}
            title={props.state.status() === "expired" ? messageTranslate("admin.session.expired") : undefined}
          />
        }
      >
        <Show when={props.state.realm()}>
          {(realm) => (
            <>
              <AuthenticatedPageHeader
                actions={
                  props.state.status() !== "permission-denied" ? (
                    <AuthenticatedButton
                      icon={mdiPencilOutline}
                      onClick={() => dialogOpenSet("edit-realm")}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("admin.realm.edit")}
                    </AuthenticatedButton>
                  ) : undefined
                }
                meta={
                  <>
                    <AuthenticatedStatus
                      label={
                        realm().status === "active"
                          ? messageTranslate("admin.realm.statusActive")
                          : messageTranslate("admin.realm.statusDisabled")
                      }
                      tone={realm().status === "active" ? "success" : "danger"}
                    />
                    <span>
                      {messageTranslate("admin.realm.identifier")}{" "}
                      <AuthenticatedCopyableId label={messageTranslate("admin.realm.identifier")} value={realm().id} />
                    </span>
                    <span>
                      {messageTranslate("admin.realm.primaryDomain")} {realm().domain}
                    </span>
                    <span class="flex flex-wrap items-center gap-1">
                      {messageTranslate("admin.realm.domains")}{" "}
                      <For each={realm().domains}>{(domain) => <AuthenticatedChip label={domain} />}</For>
                    </span>
                  </>
                }
                title={realm().name}
              />

              <Show when={props.state.realmSummary()}>
                {(summary) => (
                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiDomain}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("shell.nav.organizations")}
                        value={summary().organizations}
                        href={`${props.basePath}/organizations`}
                      />
                    </div>
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiAccountGroupOutline}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("shell.nav.users")}
                        value={summary().users}
                        href={props.usersHref}
                      />
                    </div>
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiShieldAccountOutline}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("shell.nav.realmAdministrators")}
                        value={summary().realmAdministrators}
                        href={`${props.basePath}/realm/administrators`}
                      />
                    </div>
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiApplicationOutline}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("shell.nav.oidcClients")}
                        value={summary().oidcClients}
                        href={`${props.basePath}/oidc-clients`}
                      />
                    </div>
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiDevices}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("admin.redesign.activeSessions")}
                        value={summary().activeSessions}
                        href={`${props.basePath}/sessions`}
                      />
                    </div>
                    <div class="relative min-w-0">
                      <Icon
                        aria-hidden="true"
                        class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                        path={mdiHistory}
                      />
                      <AuthenticatedStatTile
                        label={messageTranslate("admin.redesign.events24H")}
                        value={summary().auditEvents24h}
                        href={`${props.basePath}/events`}
                      />
                    </div>
                    <Show when={props.state.whatsappUsage()}>
                      <div class="relative min-w-0">
                        <Icon
                          aria-hidden="true"
                          class="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"
                          path={mdiWhatsapp}
                        />
                        <AuthenticatedStatTile
                          label={messageTranslate("shell.nav.whatsapp")}
                          value={props.state.whatsappUsage()?.totals.sentLastDay ?? 0}
                          hint={whatsapp.remainingHint()}
                          href={`${props.basePath}/whatsapp`}
                        />
                      </div>
                    </Show>
                  </div>
                )}
              </Show>

              <AuthenticatedSection
                title={messageTranslate("admin.redesign.recentAuditEvents")}
                actions={
                  <A class="text-xs font-medium text-accent hover:underline" href={`${props.basePath}/events`}>
                    {messageTranslate("admin.redesign.viewAll")}
                  </A>
                }
              >
                <Show
                  when={props.state.events().length > 0}
                  fallback={
                    <p class="px-4 py-3 text-xs text-muted-foreground">
                      {messageTranslate("admin.redesign.noRecentAuditEvents")}
                    </p>
                  }
                >
                  <AdminEventTable state={props.state} />
                </Show>
              </AuthenticatedSection>

              <Show when={props.state.status() !== "permission-denied"}>
                <AuthenticatedDialog
                  description={messageTranslate("admin.realm.editDescription")}
                  onOpenChange={(next) => {
                    if (!next) dialogOpenSet(undefined)
                  }}
                  open={dialogOpen()}
                  title={messageTranslate("admin.realm.editTitle")}
                >
                  <form class="grid gap-4" onSubmit={props.state.realmSave}>
                    <div class="grid gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="admin-realm-name">
                        {messageTranslate("admin.realm.name")}
                      </Label>
                      <AuthenticatedInput
                        id="admin-realm-name"
                        maxlength={128}
                        onInput={(event) => props.state.realmName.set(event.currentTarget.value)}
                        value={props.state.realmName.get()}
                      />
                    </div>
                    <div class="grid gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="admin-realm-status">
                        {messageTranslate("admin.realm.status")}
                      </Label>
                      <AuthenticatedSelect
                        getOptions={() => ["active", "disabled"]}
                        id="admin-realm-status"
                        valueSignal={realmStatusValue}
                        valueText={(value) =>
                          value === "disabled"
                            ? messageTranslate("admin.realm.statusDisabled")
                            : messageTranslate("admin.realm.statusActive")
                        }
                      />
                    </div>
                    <div class="grid gap-1.5">
                      <Label class="text-[0.8125rem] font-medium" for="admin-realm-domains">
                        {messageTranslate("admin.realm.domains")}
                      </Label>
                      <AuthenticatedInput
                        id="admin-realm-domains"
                        onInput={(event) => props.state.realmDomains.set(event.currentTarget.value)}
                        value={props.state.realmDomains.get()}
                      />
                      <p class="text-xs text-muted-foreground">{messageTranslate("admin.realm.domainsHint")}</p>
                    </div>
                    <Show when={props.state.validationMessage()}>
                      {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
                    </Show>
                    <div class="flex justify-end gap-2">
                      <AuthenticatedButton icon={mdiContentSave} type="submit" variant="filledBlue">
                        {messageTranslate("common.save")}
                      </AuthenticatedButton>
                    </div>
                  </form>
                </AuthenticatedDialog>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </div>
  )
}

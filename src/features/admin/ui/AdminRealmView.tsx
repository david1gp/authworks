import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiPencilOutline } from "@adaptive-ds/mdi/mdiPencilOutline.js"
import { useLocation, useNavigate } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSelect } from "../../../ui/authenticated/AuthenticatedSelect.js"
import { AuthenticatedStatTile } from "../../../ui/authenticated/AuthenticatedStatTile.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { adminPageStateCreate } from "./adminPageStateCreate.js"
import { adminRealmQueryParse } from "./adminRealmQuerySchema.js"
import { adminViewStatusPanelState } from "./adminViewStatusPanelState.js"

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

type RealmExploreTile = {
  readonly description: string
  readonly href: (basePath: string) => string
  readonly titleKey:
    | "shell.nav.realmAdministrators"
    | "shell.nav.organizations"
    | "shell.nav.oidcClients"
    | "shell.nav.sessions"
    | "shell.nav.auditEvents"
}

const exploreTiles = (): readonly RealmExploreTile[] => [
  {
    description: messageTranslate("admin.realm.explore.administratorsDescription"),
    href: (basePath) => `${basePath}/realm/administrators`,
    titleKey: "shell.nav.realmAdministrators",
  },
  {
    description: messageTranslate("admin.realm.explore.organizationsDescription"),
    href: (basePath) => `${basePath}/organizations`,
    titleKey: "shell.nav.organizations",
  },
  {
    description: messageTranslate("admin.realm.explore.oidcClientsDescription"),
    href: (basePath) => `${basePath}/oidc-clients`,
    titleKey: "shell.nav.oidcClients",
  },
  {
    description: messageTranslate("admin.realm.explore.sessionsDescription"),
    href: (basePath) => `${basePath}/sessions`,
    titleKey: "shell.nav.sessions",
  },
  {
    description: messageTranslate("admin.realm.explore.auditEventsDescription"),
    href: (basePath) => `${basePath}/events`,
    titleKey: "shell.nav.auditEvents",
  },
]

const exploreTileLabel = (titleKey: RealmExploreTile["titleKey"]): string => messageTranslate(titleKey)

/** Merged realm overview and settings: identity header, editable settings, and explore links. */
export function AdminRealmView(props: {
  readonly basePath: string
  readonly state: ReturnType<typeof adminPageStateCreate>
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const dialogOpenSet = (dialog: "edit-realm" | undefined) =>
    dialogQuerySet(location.pathname, location.search, navigate, dialog)
  const dialogOpen = () => adminRealmQueryParse(location.search).dialog === "edit-realm"
  const realmStatusValue = {
    get: (): string => props.state.realmStatus.get(),
    set: (value: string) => props.state.realmStatus.set(value === "disabled" ? "disabled" : "active"),
  }

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
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
                description={messageTranslate("admin.realm.description")}
                meta={
                  <AuthenticatedStatus
                    label={
                      realm().status === "active"
                        ? messageTranslate("admin.realm.statusActive")
                        : messageTranslate("admin.realm.statusDisabled")
                    }
                    tone={realm().status === "active" ? "success" : "danger"}
                  />
                }
                title={realm().name}
              />

              <AuthenticatedSection padded title={messageTranslate("admin.realm.identityTitle")}>
                <AuthenticatedFieldList
                  columns={3}
                  fields={[
                    { identifier: true, label: messageTranslate("admin.realm.identifier"), value: realm().id },
                    { label: messageTranslate("admin.realm.primaryDomain"), value: realm().domain },
                    {
                      label: messageTranslate("admin.realm.status"),
                      value:
                        realm().status === "active"
                          ? messageTranslate("admin.realm.statusActive")
                          : messageTranslate("admin.realm.statusDisabled"),
                    },
                  ]}
                />
              </AuthenticatedSection>

              <AuthenticatedSection padded title={messageTranslate("admin.realm.domains")}>
                <ul class="grid min-w-0 gap-2">
                  <For each={realm().domains}>
                    {(domain) => (
                      <li class="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        <span class="min-w-0 truncate font-mono text-[0.8125rem]" title={domain}>
                          {domain}
                        </span>
                        <Show when={domain === realm().domain}>
                          <AuthenticatedChip label={messageTranslate("admin.realm.primary")} tone="accent" />
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </AuthenticatedSection>

              <AuthenticatedSection title={messageTranslate("admin.realm.exploreTitle")}>
                <div class="grid min-w-0 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
                  <For each={exploreTiles()}>
                    {(tile) => (
                      <AuthenticatedStatTile
                        hint={tile.description}
                        href={tile.href(props.basePath)}
                        label={exploreTileLabel(tile.titleKey)}
                        value={exploreTileLabel(tile.titleKey)}
                      />
                    )}
                  </For>
                </div>
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

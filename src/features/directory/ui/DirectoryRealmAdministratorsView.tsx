import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedAvatar } from "../../../ui/authenticated/AuthenticatedAvatar.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedChip } from "../../../ui/authenticated/AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../../../ui/authenticated/AuthenticatedDataTable.js"
import { AuthenticatedDialog } from "../../../ui/authenticated/AuthenticatedDialog.js"
import { AuthenticatedEmptyState } from "../../../ui/authenticated/AuthenticatedEmptyState.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedRecordItem } from "../../../ui/authenticated/AuthenticatedRecordItem.js"
import { AuthenticatedRecordList } from "../../../ui/authenticated/AuthenticatedRecordList.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSkeleton } from "../../../ui/authenticated/AuthenticatedSkeleton.js"
import type { AuthenticatedDataTableColumn } from "../../../ui/authenticated/authenticatedDataTableColumn.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import type { ConfirmState } from "../../../ui/confirm/confirmStateCreate.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { RealmAdministrator } from "../../realms/public/realmAdministratorSchema.js"
import {
  type DirectoryRealmAdministratorCandidate,
  directoryRealmAdministratorAddedByNameGet,
  directoryRealmAdministratorNameGet,
} from "./directoryRealmAdministratorsAdapter.js"
import type { DirectoryRealmAdministratorsViewState } from "./directoryRealmAdministratorsViewStateCreate.js"
import { directoryRoleIconGet } from "./directoryRoleIconGet.js"
import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"

export type DirectoryRealmAdministratorsShellState = {
  readonly confirmState: ConfirmState
  readonly view: DirectoryRealmAdministratorsViewState
}

const administratorNameGet = (admin: RealmAdministrator): string => directoryRealmAdministratorNameGet(admin)

/** The realm administrators page: table of administrators with grant picker and guarded revoke. */
export function DirectoryRealmAdministratorsView(props: { readonly state: DirectoryRealmAdministratorsShellState }) {
  const view = () => props.state.view
  const page = () => view().page

  const administratorColumns = (): AuthenticatedDataTableColumn<RealmAdministrator>[] => [
    {
      cell: (admin) => (
        <span class="flex min-w-0 items-center gap-2.5">
          <AuthenticatedAvatar name={administratorNameGet(admin)} size="sm" />
          <span class="grid min-w-0">
            <span class="truncate font-medium">{administratorNameGet(admin)}</span>
            <span class="truncate text-xs text-muted-foreground">{admin.user.email}</span>
            <span class="truncate font-mono text-[0.6875rem] text-muted-foreground">@{admin.user.userName}</span>
          </span>
        </span>
      ),
      header: messageTranslate("admin.realmAdministrators.tableUser"),
      key: "user",
    },
    {
      cell: (admin) => (
        <AuthenticatedRelativeTime
          fallback={
            <span class="text-muted-foreground">{messageTranslate("admin.realmAdministrators.tableAdded")}</span>
          }
          value={admin.createdAt}
        />
      ),
      header: messageTranslate("admin.realmAdministrators.tableAdded"),
      key: "added",
    },
    {
      cell: (admin) => {
        const granterNames = () => page().administrators()
        const name = () =>
          admin.createdBy === undefined
            ? messageTranslate("admin.realmAdministrators.systemAdded")
            : directoryRealmAdministratorAddedByNameGet(granterNames(), admin) === "system"
              ? messageTranslate("admin.realmAdministrators.systemAdded")
              : directoryRealmAdministratorAddedByNameGet(granterNames(), admin)
        return <span class="truncate">{name()}</span>
      },
      header: messageTranslate("admin.realmAdministrators.tableAddedBy"),
      key: "added-by",
    },
    {
      cell: (admin) => (
        <Show
          when={!page().lastAdmin()}
          fallback={
            <span title={messageTranslate("admin.realmAdministrators.lastAdminHint")}>
              <AuthenticatedButton disabled icon={directoryRoleIconGet("owner")} size="sm" variant="outline">
                {messageTranslate("admin.realmAdministrators.remove")}
              </AuthenticatedButton>
            </span>
          }
        >
          <AuthenticatedButton
            disabled={page().pendingId() === `revoke:${admin.userId}`}
            icon={directoryRoleIconGet("owner")}
            onClick={() => void page().administratorRemove(admin)}
            size="sm"
            variant="outlineRed"
          >
            {messageTranslate("admin.realmAdministrators.remove")}
          </AuthenticatedButton>
        </Show>
      ),
      header: messageTranslate("admin.realmAdministrators.remove"),
      key: "actions",
    },
  ]

  const countLabel = () =>
    page().administrators().length === 1
      ? messageTranslate("admin.realmAdministrators.countOne")
      : messageTranslate("admin.realmAdministrators.count", { count: page().administrators().length })

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <ConfirmDialog state={props.state.confirmState} titleKey="admin.common.confirmTitle" />
      <AuthenticatedPageHeader
        actions={
          <AuthenticatedButton
            icon={authenticatedIconRegistry.directoryCreateUser}
            onClick={() => view().dialogOpenSet(true)}
            variant="filledBlue"
          >
            {messageTranslate("admin.realmAdministrators.add")}
          </AuthenticatedButton>
        }
        description={messageTranslate("admin.realmAdministrators.description")}
        title={messageTranslate("admin.realmAdministrators.title")}
      />
      <Show when={page().notice()}>{(notice) => <AuthenticatedNotice message={notice()} />}</Show>
      <Show when={page().danger()}>{(danger) => <AuthenticatedNotice message={danger()} tone="danger" />}</Show>
      <AuthenticatedPageBody>
        <Show
          when={page().status() === "ready" || page().status() === "empty"}
          fallback={
            <Show
              when={page().status() === "loading"}
              fallback={
                <AuthenticatedSection>
                  <AuthenticatedEmptyState
                    actions={
                      <AuthenticatedButton onClick={page().reload} variant="outline">
                        {messageTranslate("common.retry")}
                      </AuthenticatedButton>
                    }
                    description={page().error() ?? messageTranslate("common.error")}
                    title={messageTranslate("common.error")}
                  />
                </AuthenticatedSection>
              }
            >
              <AuthenticatedSection>
                <div class="grid gap-2 p-5">
                  <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
                </div>
              </AuthenticatedSection>
            </Show>
          }
        >
          <Show
            when={page().administrators().length > 0}
            fallback={
              <AuthenticatedSection>
                <AuthenticatedEmptyState
                  actions={
                    <AuthenticatedButton
                      icon={authenticatedIconRegistry.directoryCreateUser}
                      onClick={() => view().dialogOpenSet(true)}
                      variant="filledBlue"
                    >
                      {messageTranslate("admin.realmAdministrators.add")}
                    </AuthenticatedButton>
                  }
                  description={messageTranslate("admin.realmAdministrators.emptyDescription")}
                  title={messageTranslate("admin.realmAdministrators.emptyTitle")}
                />
              </AuthenticatedSection>
            }
          >
            <AuthenticatedSection
              description={countLabel()}
              label={messageTranslate("admin.realmAdministrators.title")}
              title={messageTranslate("admin.realmAdministrators.title")}
            >
              <AuthenticatedDataTable
                caption={messageTranslate("admin.realmAdministrators.title")}
                columns={administratorColumns()}
                rowKey={(admin) => admin.userId}
                rows={page().administrators()}
              />
              <AuthenticatedRecordList label={messageTranslate("admin.realmAdministrators.title")}>
                <For each={page().administrators()}>
                  {(admin) => (
                    <AuthenticatedRecordItem
                      actions={
                        <Show
                          when={!page().lastAdmin()}
                          fallback={
                            <span title={messageTranslate("admin.realmAdministrators.lastAdminHint")}>
                              <AuthenticatedButton
                                disabled
                                icon={directoryRoleIconGet("owner")}
                                size="sm"
                                variant="outline"
                              >
                                {messageTranslate("admin.realmAdministrators.remove")}
                              </AuthenticatedButton>
                            </span>
                          }
                        >
                          <AuthenticatedButton
                            disabled={page().pendingId() === `revoke:${admin.userId}`}
                            icon={directoryRoleIconGet("owner")}
                            onClick={() => void page().administratorRemove(admin)}
                            size="sm"
                            variant="outlineRed"
                          >
                            {messageTranslate("admin.realmAdministrators.remove")}
                          </AuthenticatedButton>
                        </Show>
                      }
                      fields={[
                        {
                          label: messageTranslate("admin.realmAdministrators.tableAdded"),
                          value: localeDateFormat(admin.createdAt, { dateStyle: "medium" }),
                        },
                        {
                          label: messageTranslate("admin.realmAdministrators.tableAddedBy"),
                          value:
                            admin.createdBy === undefined
                              ? messageTranslate("admin.realmAdministrators.systemAdded")
                              : admin.createdBy,
                        },
                      ]}
                      title={
                        <span class="flex items-center gap-2">
                          <AuthenticatedAvatar name={administratorNameGet(admin)} size="sm" />
                          <span class="grid min-w-0">
                            <span class="truncate">{administratorNameGet(admin)}</span>
                            <span class="truncate text-xs font-normal text-muted-foreground">{admin.user.email}</span>
                          </span>
                        </span>
                      }
                    />
                  )}
                </For>
              </AuthenticatedRecordList>
            </AuthenticatedSection>
          </Show>
        </Show>
      </AuthenticatedPageBody>
      <AddAdministratorDialog state={view()} />
    </div>
  )
}

function AddAdministratorDialog(props: { readonly state: DirectoryRealmAdministratorsViewState }) {
  const page = () => props.state.page
  const candidateSelect = (candidate: DirectoryRealmAdministratorCandidate) => {
    if (candidate.alreadyAdmin) return
    void page().administratorGrant(candidate)
  }
  return (
    <AuthenticatedDialog
      description={messageTranslate("admin.realmAdministrators.addDialogDescription")}
      onOpenChange={(open) => {
        if (!open) props.state.dialogOpenSet(false)
      }}
      open={props.state.dialogOpen()}
      title={messageTranslate("admin.realmAdministrators.addDialogTitle")}
    >
      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <Label class="text-[0.8125rem] font-medium" for="realm-administrators-search">
            {messageTranslate("admin.realmAdministrators.search")}
          </Label>
          <AuthenticatedInput
            id="realm-administrators-search"
            onInput={(event) => props.state.dialogSearchInput(event.currentTarget.value)}
            placeholder={messageTranslate("admin.realmAdministrators.invitePlaceholder")}
            value={props.state.addSearch.get()}
          />
        </div>
        <Show
          when={page().searchStatus() !== "idle"}
          fallback={
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.realmAdministrators.invitePlaceholder")}
            </p>
          }
        >
          <Show
            when={page().searchStatus() === "ready" || page().searchStatus() === "empty"}
            fallback={
              <Show
                when={page().searchStatus() === "loading"}
                fallback={
                  <AuthenticatedNotice
                    message={page().searchError() ?? messageTranslate("common.error")}
                    tone="danger"
                  />
                }
              >
                <div aria-label={messageTranslate("common.loading")} class="grid gap-2" role="status">
                  <For each={[0, 1, 2]}>{(index) => <AuthenticatedSkeleton index={index} />}</For>
                </div>
              </Show>
            }
          >
            <Show
              when={page().candidates().length > 0}
              fallback={
                <AuthenticatedEmptyState
                  description={messageTranslate("admin.realmAdministrators.emptySearchDescription")}
                  icon={mdiMagnify}
                  title={messageTranslate("admin.realmAdministrators.search")}
                />
              }
            >
              <ul class="grid max-h-80 gap-1 overflow-y-auto">
                <For each={page().candidates()}>
                  {(candidate) => (
                    <li>
                      <button
                        class="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-start transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={candidate.alreadyAdmin || page().pendingId() === `grant:${candidate.userId}`}
                        onClick={() => candidateSelect(candidate)}
                        type="button"
                      >
                        <AuthenticatedAvatar name={candidate.displayName} size="sm" />
                        <span class="grid min-w-0 flex-1">
                          <span class="truncate text-sm font-medium">{candidate.displayName}</span>
                          <span class="truncate text-xs text-muted-foreground">{candidate.email}</span>
                        </span>
                        <Show
                          when={candidate.alreadyAdmin}
                          fallback={
                            <span class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
                              <Icon
                                aria-hidden="true"
                                class="size-3.5"
                                path={authenticatedIconRegistry.directoryCreateUser}
                              />
                              {messageTranslate("admin.realmAdministrators.grant")}
                            </span>
                          }
                        >
                          <AuthenticatedChip
                            label={messageTranslate("admin.realmAdministrators.alreadyAdmin")}
                            tone="neutral"
                          />
                        </Show>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </Show>
      </div>
    </AuthenticatedDialog>
  )
}

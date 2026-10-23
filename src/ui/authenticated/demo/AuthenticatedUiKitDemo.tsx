import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiArchiveOutline } from "@adaptive-ds/mdi/mdiArchiveOutline.js"
import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClockOutline } from "@adaptive-ds/mdi/mdiClockOutline.js"
import { mdiCogOutline } from "@adaptive-ds/mdi/mdiCogOutline.js"
import { mdiDeleteOutline } from "@adaptive-ds/mdi/mdiDeleteOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiInboxOutline } from "@adaptive-ds/mdi/mdiInboxOutline.js"
import { mdiKeyOutline } from "@adaptive-ds/mdi/mdiKeyOutline.js"
import { mdiPaletteOutline } from "@adaptive-ds/mdi/mdiPaletteOutline.js"
import { mdiPencilOutline } from "@adaptive-ds/mdi/mdiPencilOutline.js"
import { mdiRobotOutline } from "@adaptive-ds/mdi/mdiRobotOutline.js"
import { mdiShieldCheckOutline } from "@adaptive-ds/mdi/mdiShieldCheckOutline.js"
import { mdiWeb } from "@adaptive-ds/mdi/mdiWeb.js"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../i18n/model/messageTranslate.js"
import { AuthenticatedActionMenu } from "../AuthenticatedActionMenu.js"
import { AuthenticatedAvatar } from "../AuthenticatedAvatar.js"
import { AuthenticatedButton } from "../AuthenticatedButton.js"
import { AuthenticatedChip } from "../AuthenticatedChip.js"
import { AuthenticatedDataTable } from "../AuthenticatedDataTable.js"
import { AuthenticatedEmptyState } from "../AuthenticatedEmptyState.js"
import { AuthenticatedOptionCard } from "../AuthenticatedOptionCard.js"
import { AuthenticatedPageBody } from "../AuthenticatedPageBody.js"
import { AuthenticatedPageHeader } from "../AuthenticatedPageHeader.js"
import { AuthenticatedProfileHeader } from "../AuthenticatedProfileHeader.js"
import { AuthenticatedRelativeTime } from "../AuthenticatedRelativeTime.js"
import { AuthenticatedSearchField } from "../AuthenticatedSearchField.js"
import { AuthenticatedSection } from "../AuthenticatedSection.js"
import { AuthenticatedSkeleton } from "../AuthenticatedSkeleton.js"
import { AuthenticatedStatTile } from "../AuthenticatedStatTile.js"
import { AuthenticatedStatus } from "../AuthenticatedStatus.js"
import { AuthenticatedSubNav } from "../AuthenticatedSubNav.js"
import { AuthenticatedTabs } from "../AuthenticatedTabs.js"
import { AuthenticatedToolbar } from "../AuthenticatedToolbar.js"
import type { AuthenticatedDataTableColumn } from "../authenticatedDataTableColumn.js"
import { authenticatedUiKitDemoStateCreate } from "./authenticatedUiKitDemoStateCreate.js"
import type { DemoUiKitTableRow } from "./demoUiKitQuerySchema.js"
import { demoUiKitTableRows } from "./demoUiKitTableRows.js"

const demoUiKitRecentSignInAt = Date.now() - 4 * 3_600_000

const demoUiKitRoleTone = (role: DemoUiKitTableRow["role"]) =>
  role === "owner" ? "accent" : role === "admin" ? "warning" : role === "member" ? "success" : "neutral"

const demoUiKitRoleLabelKey = (role: DemoUiKitTableRow["role"]) =>
  role === "owner"
    ? "ui.authenticated.demo.roleOwner"
    : role === "admin"
      ? "ui.authenticated.demo.roleAdmin"
      : role === "member"
        ? "ui.authenticated.demo.roleMember"
        : "ui.authenticated.demo.roleGuest"

function AuthenticatedUiKitDemoTableUserCell(props: { readonly row: DemoUiKitTableRow }) {
  return (
    <span class="flex min-w-0 items-center gap-2.5">
      <AuthenticatedAvatar name={props.row.name} size="sm" />
      <span class="min-w-0">
        <span class="block truncate text-sm font-medium">{props.row.name}</span>
        <span class="block truncate text-xs text-muted-foreground">{props.row.email}</span>
      </span>
    </span>
  )
}

/**
 * Showcase for every `src/ui/authenticated` primitive on realistic administration fixtures: a
 * users-like table with avatar cells, chips, and relative timestamps plus the surrounding page
 * chrome (tabs, sub-navigation, profile header, option cards, stat tiles, search, and skeleton).
 */
export function AuthenticatedUiKitDemo() {
  const state = authenticatedUiKitDemoStateCreate()

  const columns: readonly AuthenticatedDataTableColumn<DemoUiKitTableRow>[] = [
    {
      key: "user",
      header: messageTranslate("admin.organizations.memberships.user"),
      cell: (row) => <AuthenticatedUiKitDemoTableUserCell row={row} />,
    },
    {
      key: "role",
      header: messageTranslate("admin.organizations.memberships.roles"),
      sortKey: "role",
      cell: (row) => (
        <AuthenticatedChip
          label={messageTranslate(demoUiKitRoleLabelKey(row.role))}
          tone={demoUiKitRoleTone(row.role)}
        />
      ),
    },
    {
      key: "lastSignIn",
      header: messageTranslate("admin.users.sessions.lastUsed"),
      sortKey: "lastSignInAt",
      cell: (row) => (
        <AuthenticatedRelativeTime fallback={messageTranslate("ui.authenticated.never")} value={row.lastSignInAt} />
      ),
    },
    {
      key: "state",
      header: messageTranslate("admin.users.state"),
      cell: (row) => (
        <AuthenticatedStatus
          label={
            row.state === "active"
              ? messageTranslate("admin.users.lifecycle.active")
              : messageTranslate("admin.users.lifecycle.suspended")
          }
          tone={row.state === "active" ? "success" : "warning"}
        />
      ),
    },
    {
      key: "created",
      header: messageTranslate("admin.users.createdAt"),
      sortKey: "createdAt",
      align: "end",
      cell: (row) => (
        <span class="block text-end tabular-nums">
          <AuthenticatedRelativeTime value={row.createdAt} />
        </span>
      ),
    },
  ]

  return (
    <AuthenticatedPageBody>
      <AuthenticatedPageHeader
        description={messageTranslate("ui.authenticated.demo.description")}
        eyebrow={messageTranslate("demo.nav.admin")}
        title={messageTranslate("ui.authenticated.demo.title")}
      />
      <AuthenticatedToolbar
        label={messageTranslate("ui.authenticated.demo.dataTitle")}
        summary={messageTranslate("admin.users.count", { count: state.rows().length })}
      >
        <AuthenticatedSearchField
          onInput={state.searchInput}
          placeholder={messageTranslate("ui.authenticated.demo.searchPlaceholder")}
          value={state.search()}
        />
      </AuthenticatedToolbar>
      <AuthenticatedSection
        actions={
          <AuthenticatedButton onClick={state.toggleLoading} size="sm" variant="outline">
            {messageTranslate("ui.authenticated.demo.loadingBlurb")}
          </AuthenticatedButton>
        }
        description={messageTranslate("ui.authenticated.demo.dataDescription")}
        title={messageTranslate("ui.authenticated.demo.dataTitle")}
      >
        <AuthenticatedDataTable
          activeSort={state.activeSort()}
          caption={messageTranslate("ui.authenticated.demo.sortCaption")}
          columns={columns}
          empty={() => (
            <AuthenticatedEmptyState
              title={messageTranslate("ui.authenticated.demo.emptyTitle")}
              description={messageTranslate("ui.authenticated.demo.emptyDescription")}
              icon={mdiInboxOutline}
            />
          )}
          loading={state.loading()}
          onSortChange={state.sortChange}
          rowHref={(row) => `/demo/admin/ui-kit/users/${row.id}`}
          rowKey={(row) => row.id}
          rows={state.rows()}
        />
      </AuthenticatedSection>
      <AuthenticatedSection
        actions={
          <AuthenticatedButton onClick={state.toggleEmpty} size="sm" variant="outline">
            {messageTranslate("ui.authenticated.demo.emptyBlurb")}
          </AuthenticatedButton>
        }
        description={messageTranslate("ui.authenticated.demo.emptyBlurb")}
        title={messageTranslate("ui.authenticated.demo.emptyTitle")}
      >
        <div class="px-5 py-4">
          <Show
            when={state.rows().length > 0}
            fallback={
              <AuthenticatedEmptyState
                title={messageTranslate("ui.authenticated.demo.emptyTitle")}
                description={messageTranslate("ui.authenticated.demo.emptyDescription")}
                icon={mdiInboxOutline}
              />
            }
          >
            <p class="text-sm text-muted-foreground">{messageTranslate("ui.authenticated.demo.loadingBlurb")}</p>
          </Show>
        </div>
      </AuthenticatedSection>
      <div class="grid gap-5 lg:grid-cols-2">
        <AuthenticatedSection
          description={messageTranslate("ui.authenticated.demo.tabsDescription")}
          title={messageTranslate("ui.authenticated.demo.tabsTitle")}
        >
          <div class="px-5 py-4">
            <AuthenticatedTabs
              active={state.activeTab()}
              items={[
                {
                  value: "people",
                  label: messageTranslate("ui.authenticated.demo.tabsTitle"),
                  href: "/demo/admin/ui-kit?tab=people",
                  icon: mdiAccountOutline,
                },
                {
                  value: "service-accounts",
                  label: messageTranslate("ui.authenticated.demo.subNavTitle"),
                  href: "/demo/admin/ui-kit?tab=service-accounts",
                  icon: mdiRobotOutline,
                },
                {
                  value: "invitations",
                  label: messageTranslate("ui.authenticated.demo.chipsTitle"),
                  href: "/demo/admin/ui-kit?tab=invitations",
                  icon: mdiEmailOutline,
                },
              ]}
              label={messageTranslate("ui.authenticated.demo.tabsTitle")}
            />
            <p class="mt-3 text-[0.8125rem] text-muted-foreground">
              {state.activeTab() === "people"
                ? messageTranslate("ui.authenticated.demo.peopleBlurb")
                : state.activeTab() === "service-accounts"
                  ? messageTranslate("ui.authenticated.demo.serviceBlurb")
                  : messageTranslate("ui.authenticated.demo.inviteBlurb")}
            </p>
          </div>
        </AuthenticatedSection>
        <AuthenticatedSection
          description={messageTranslate("ui.authenticated.demo.sectionsBlurb")}
          title={messageTranslate("ui.authenticated.demo.subNavTitle")}
        >
          <div class="grid gap-4 px-5 py-4 sm:grid-cols-[12rem_1fr]">
            <AuthenticatedSubNav
              active={state.activeSection()}
              items={[
                {
                  value: "general",
                  label: messageTranslate("demo.admin.scenario.users.title"),
                  description: messageTranslate("ui.authenticated.demo.sectionsBlurb"),
                  href: "/demo/admin/ui-kit?section=general",
                  icon: mdiCogOutline,
                },
                {
                  value: "branding",
                  label: messageTranslate("demo.admin.scenario.branding.title"),
                  href: "/demo/admin/ui-kit?section=branding",
                  icon: mdiPaletteOutline,
                },
                {
                  value: "domains",
                  label: messageTranslate("admin.realm.domains"),
                  href: "/demo/admin/ui-kit?section=domains",
                  icon: mdiWeb,
                },
              ]}
              label={messageTranslate("ui.authenticated.demo.subNavTitle")}
            />
            <p class="text-[0.8125rem] text-muted-foreground">{messageTranslate("ui.authenticated.demo.rolesBlurb")}</p>
          </div>
        </AuthenticatedSection>
      </div>
      <AuthenticatedSection
        actions={
          <AuthenticatedActionMenu
            items={[
              {
                label: messageTranslate("ui.authenticated.demo.rowEdit"),
                icon: mdiPencilOutline,
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.rowEdit")),
              },
              {
                label: messageTranslate("ui.authenticated.demo.menuRename"),
                icon: mdiPencilOutline,
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.menuRename")),
              },
              {
                label: messageTranslate("ui.authenticated.demo.menuArchive"),
                icon: mdiArchiveOutline,
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.menuArchive")),
              },
              {
                label: messageTranslate("ui.authenticated.demo.rowDelete"),
                icon: mdiDeleteOutline,
                tone: "danger",
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.rowDelete")),
              },
            ]}
          />
        }
        description={messageTranslate("ui.authenticated.demo.keyboardHint")}
        title={messageTranslate("ui.authenticated.demo.chipsTitle")}
      >
        <div class="flex flex-wrap items-center gap-1.5 px-5 py-4">
          <AuthenticatedChip label={messageTranslate("ui.authenticated.demo.roleOwner")} tone="accent" />
          <AuthenticatedChip label={messageTranslate("ui.authenticated.demo.roleAdmin")} tone="warning" />
          <AuthenticatedChip label={messageTranslate("ui.authenticated.demo.roleMember")} tone="success" />
          <AuthenticatedChip label={messageTranslate("ui.authenticated.demo.roleGuest")} tone="neutral" />
          <AuthenticatedChip
            label={messageTranslate("admin.users.lifecycle.active")}
            icon={mdiShieldCheckOutline}
            tone="success"
          />
          <AuthenticatedChip
            label={messageTranslate("admin.users.lifecycle.suspended")}
            icon={mdiClockOutline}
            tone="warning"
          />
          <Show when={state.actionMessage()}>
            {(selected) => (
              <span class="text-[0.8125rem] text-muted-foreground" role="status">
                {selected()}
              </span>
            )}
          </Show>
        </div>
        <p class="border-t border-line-subtle px-5 py-3 text-[0.8125rem] text-muted-foreground">
          {messageTranslate("ui.authenticated.demo.chipBlurb")}
        </p>
      </AuthenticatedSection>
      <AuthenticatedSection
        description={messageTranslate("ui.authenticated.demo.optionsDescription")}
        title={messageTranslate("ui.authenticated.demo.optionsTitle")}
      >
        <div
          class="grid gap-3 px-5 py-4 sm:grid-cols-2"
          role="radiogroup"
          aria-label={messageTranslate("admin.organizations.memberships.roles")}
        >
          <For
            each={
              [
                {
                  role: "owner",
                  labelKey: "ui.authenticated.demo.roleOwner" as const,
                  blurb: messageTranslate("ui.authenticated.demo.ownerBlurb"),
                  icon: mdiShieldCheckOutline,
                  disabled: true,
                },
                {
                  role: "admin",
                  labelKey: "ui.authenticated.demo.roleAdmin" as const,
                  blurb: messageTranslate("ui.authenticated.demo.adminBlurb"),
                  icon: mdiKeyOutline,
                  disabled: false,
                },
                {
                  role: "member",
                  labelKey: "ui.authenticated.demo.roleMember" as const,
                  blurb: messageTranslate("ui.authenticated.demo.memberBlurb"),
                  icon: mdiAccountOutline,
                  disabled: false,
                },
                {
                  role: "guest",
                  labelKey: "ui.authenticated.demo.roleGuest" as const,
                  blurb: messageTranslate("ui.authenticated.demo.guestBlurb"),
                  icon: mdiClockOutline,
                  disabled: false,
                },
              ] as const
            }
          >
            {(option) => (
              <AuthenticatedOptionCard
                checkedRole="radio"
                description={option.blurb}
                disabled={option.disabled}
                icon={option.icon}
                onSelect={() => state.roleSelect(option.role)}
                selected={state.selectedRole() === option.role}
                title={messageTranslate(option.labelKey)}
              />
            )}
          </For>
        </div>
      </AuthenticatedSection>
      <AuthenticatedProfileHeader
        avatar={<AuthenticatedAvatar name={messageTranslate("ui.authenticated.demo.profileName")} size="xl" />}
        title={messageTranslate("ui.authenticated.demo.profileName")}
        subtitle="alex.morgan@northwind.example"
        chips={
          <>
            <AuthenticatedChip label={messageTranslate("ui.authenticated.demo.roleOwner")} tone="accent" />
            <AuthenticatedStatus label={messageTranslate("admin.users.lifecycle.active")} tone="success" />
          </>
        }
        actions={
          <AuthenticatedActionMenu
            items={[
              {
                label: messageTranslate("ui.authenticated.demo.rowEdit"),
                icon: mdiPencilOutline,
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.rowEdit")),
              },
              {
                label: messageTranslate("ui.authenticated.demo.menuDelete"),
                icon: mdiDeleteOutline,
                tone: "danger",
                onSelect: () => state.menuSelect(messageTranslate("ui.authenticated.demo.menuDelete")),
              },
            ]}
          />
        }
        meta={[
          {
            label: messageTranslate("admin.users.sessions.lastUsed"),
            value: <AuthenticatedRelativeTime value={demoUiKitRecentSignInAt} />,
          },
          {
            label: messageTranslate("admin.users.state"),
            value: <>{messageTranslate("admin.users.lifecycle.active")}</>,
          },
          {
            label: messageTranslate("admin.users.createdAt"),
            value: <AuthenticatedRelativeTime value={demoUiKitTableRows[0]?.createdAt ?? Date.now()} />,
          },
          {
            label: messageTranslate("admin.users.identifier"),
            value: <span class="font-mono">{demoUiKitTableRows[0]?.id ?? ""}</span>,
          },
        ]}
      />
      <div class="grid gap-5 sm:grid-cols-3">
        <AuthenticatedStatTile
          label={messageTranslate("admin.users.title")}
          value={state.rows().length}
          hint={messageTranslate("ui.authenticated.demo.statHint")}
          href="/demo/admin/ui-kit?tab=people"
        />
        <AuthenticatedStatTile
          label={messageTranslate("admin.organizations.memberships.roles")}
          value={<>4</>}
          hint={messageTranslate("ui.authenticated.demo.rolesBlurb")}
        />
        <AuthenticatedStatTile
          label={messageTranslate("admin.users.sessions.lastUsed")}
          value={
            <AuthenticatedRelativeTime
              fallback={messageTranslate("ui.authenticated.never")}
              value={demoUiKitRecentSignInAt}
            />
          }
          hint={messageTranslate("ui.authenticated.demo.timeDescription")}
        />
      </div>
      <AuthenticatedSection
        description={messageTranslate("ui.authenticated.demo.avatarDescription")}
        title={messageTranslate("ui.authenticated.demo.avatarTitle")}
      >
        <div class="flex flex-wrap items-center gap-3 px-5 py-4">
          <AuthenticatedAvatar name={messageTranslate("ui.authenticated.demo.profileName")} size="sm" />
          <AuthenticatedAvatar name="Priya Raman" size="md" />
          <AuthenticatedAvatar name="Sam Okafor" size="lg" />
          <AuthenticatedAvatar name="Noor Haddad" size="xl" />
          <span class="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            <AuthenticatedRelativeTime value={demoUiKitRecentSignInAt} />
            <span class="grid size-5 place-items-center rounded-full bg-success-soft text-success">
              <Icon aria-hidden="true" class="size-3.5" path={mdiCheck} />
            </span>
          </span>
        </div>
      </AuthenticatedSection>
      <AuthenticatedSection
        description={messageTranslate("ui.authenticated.demo.skeletonDescription")}
        title={messageTranslate("ui.authenticated.demo.skeletonTitle")}
      >
        <div class="grid gap-2 px-5 py-4">
          <AuthenticatedSkeleton class="h-4 w-2/3" index={0} />
          <AuthenticatedSkeleton class="h-4 w-1/2" index={1} />
          <AuthenticatedSkeleton class="h-9 w-full" index={2} />
        </div>
      </AuthenticatedSection>
      <AuthenticatedSection
        description={messageTranslate("ui.authenticated.demo.searchDescription")}
        title={messageTranslate("ui.authenticated.demo.searchTitle")}
      >
        <div class="px-5 py-4">
          <AuthenticatedSearchField
            onInput={state.searchInput}
            placeholder={messageTranslate("ui.authenticated.demo.searchPlaceholder")}
            value={state.search()}
          />
        </div>
      </AuthenticatedSection>
    </AuthenticatedPageBody>
  )
}

import { For, Show } from "solid-js"
import { Input } from "#ui/input/input/Input.jsx"
import { Label } from "#ui/input/label/Label.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationBrandingTheme } from "../public/organizationBrandingThemeSchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

type ThemeKey = "dark" | "light"
type ThemeColorKey = "backgroundColor" | "fontColor" | "primaryColor" | "warnColor"

const themeColorFields: readonly { key: ThemeColorKey; labelKey: MessageKey }[] = [
  { key: "primaryColor", labelKey: "admin.organizations.branding.primary" },
  { key: "backgroundColor", labelKey: "admin.organizations.branding.background" },
  { key: "fontColor", labelKey: "admin.organizations.branding.font" },
  { key: "warnColor", labelKey: "admin.organizations.branding.warn" },
]
const themeLabelKeys = {
  dark: "admin.organizations.branding.dark",
  light: "admin.organizations.branding.light",
} as const satisfies Readonly<Record<ThemeKey, MessageKey>>

export function OrganizationAdminBrandingView(props: {
  readonly branding: OrganizationBranding
  readonly error?: string
  readonly notice?: string
  readonly onLegalUrlInput: (key: "privacyUrl" | "termsUrl", value: string) => void
  readonly onRetry: () => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly onThemeAssetInput: (theme: ThemeKey, key: "iconUrl" | "logoUrl", value: string) => void
  readonly onThemeColorInput: (theme: ThemeKey, key: ThemeColorKey, value: string) => void
  readonly onThemeModeInput: (value: "dark" | "light" | "system") => void
  readonly onWatermarkToggle: () => void
  readonly pendingId?: string
  readonly status: OrganizationAdminStatus
  readonly validationMessage?: string
}) {
  const theme = (key: ThemeKey) => props.branding[key] as OrganizationBrandingTheme
  return (
    <section
      aria-label={messageTranslate("admin.organizations.branding.title")}
      class="grid min-w-0 gap-3 [&>*]:min-w-0"
    >
      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.branding.description")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <form class="grid min-w-0 gap-3 [&>*]:min-w-0" onSubmit={props.onSubmit}>
          <div class="grid min-w-0 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            <For each={["light", "dark"] as const}>
              {(key) => (
                <AuthenticatedSection padded title={messageTranslate(themeLabelKeys[key])}>
                  <div class="grid gap-2.5">
                    <div class="grid gap-2.5 sm:grid-cols-2">
                      <For each={themeColorFields}>
                        {(field) => {
                          const id = `branding-${key}-${field.key}`
                          const value = () => theme(key)[field.key]
                          return (
                            <div class="grid min-w-0 gap-1">
                              <Label for={id}>{messageTranslate(field.labelKey)}</Label>
                              <div class="flex items-center gap-2">
                                <input
                                  aria-label={messageTranslate(field.labelKey)}
                                  class="size-9 shrink-0 cursor-pointer rounded-control border border-line bg-transparent"
                                  onInput={(event) =>
                                    props.onThemeColorInput(key, field.key, event.currentTarget.value)
                                  }
                                  type="color"
                                  value={value()}
                                />
                                <Input
                                  class="min-w-0 font-mono text-xs"
                                  id={id}
                                  onInput={(event) =>
                                    props.onThemeColorInput(key, field.key, event.currentTarget.value)
                                  }
                                  value={value()}
                                />
                              </div>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                    <div class="grid gap-2.5 sm:grid-cols-2">
                      <div class="grid min-w-0 gap-1">
                        <Label for={`branding-${key}-logoUrl`}>
                          {messageTranslate("admin.organizations.branding.logoUrl")}
                        </Label>
                        <Input
                          id={`branding-${key}-logoUrl`}
                          onInput={(event) => props.onThemeAssetInput(key, "logoUrl", event.currentTarget.value)}
                          placeholder={messageTranslate("common.urlPlaceholder")}
                          value={theme(key).logoUrl ?? ""}
                        />
                      </div>
                      <div class="grid min-w-0 gap-1">
                        <Label for={`branding-${key}-iconUrl`}>
                          {messageTranslate("admin.organizations.branding.iconUrl")}
                        </Label>
                        <Input
                          id={`branding-${key}-iconUrl`}
                          onInput={(event) => props.onThemeAssetInput(key, "iconUrl", event.currentTarget.value)}
                          placeholder={messageTranslate("common.urlPlaceholder")}
                          value={theme(key).iconUrl ?? ""}
                        />
                      </div>
                    </div>
                    <div
                      class="rounded-control border border-line px-3 py-3"
                      style={{ background: theme(key).backgroundColor, color: theme(key).fontColor }}
                    >
                      <p class="text-2xs font-semibold tracking-[0.12em] uppercase opacity-80">
                        {messageTranslate("admin.organizations.branding.preview")}
                      </p>
                      <p class="mt-1 text-sm font-semibold">{messageTranslate("app.name")}</p>
                      <span
                        class="mt-2 inline-block rounded-control px-3 py-1.5 text-xs font-medium"
                        style={{
                          background: theme(key).primaryColor,
                          // Mirror the hosted sign-in button: light primaries take white text,
                          // dark-theme defaults are lighter and need dark ink to stay readable.
                          color: key === "light" ? "#ffffff" : "#1f2937",
                        }}
                      >
                        {messageTranslate("common.signIn")}
                      </span>
                    </div>
                  </div>
                </AuthenticatedSection>
              )}
            </For>
          </div>

          <AuthenticatedSection
            actions={
              <Button disabled={props.pendingId === "branding"} size="sm" type="submit">
                {messageTranslate("common.save")}
              </Button>
            }
            description={messageTranslate("admin.organizations.branding.description")}
            padded
            title={messageTranslate("admin.organizations.branding.title")}
          >
            <div class="grid gap-2.5 sm:grid-cols-3">
              <div class="grid min-w-0 gap-1">
                <Label for="branding-theme-mode">{messageTranslate("admin.organizations.branding.themeMode")}</Label>
                <select
                  class="h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-foreground"
                  id="branding-theme-mode"
                  onChange={(event) => props.onThemeModeInput(event.currentTarget.value as "dark" | "light" | "system")}
                  value={props.branding.themeMode}
                >
                  <option value="system">{messageTranslate("common.theme.system")}</option>
                  <option value="light">{messageTranslate("common.theme.light")}</option>
                  <option value="dark">{messageTranslate("common.theme.dark")}</option>
                </select>
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="branding-terms">{messageTranslate("admin.organizations.branding.termsUrl")}</Label>
                <Input
                  id="branding-terms"
                  onInput={(event) => props.onLegalUrlInput("termsUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={props.branding.legal?.termsUrl ?? ""}
                />
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="branding-privacy">{messageTranslate("admin.organizations.branding.privacyUrl")}</Label>
                <Input
                  id="branding-privacy"
                  onInput={(event) => props.onLegalUrlInput("privacyUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={props.branding.legal?.privacyUrl ?? ""}
                />
              </div>
            </div>
            <label class="mt-2.5 flex items-center gap-2 text-xs font-medium" for="branding-watermark">
              <input
                checked={props.branding.disableWatermark}
                class="size-4 rounded border-line"
                id="branding-watermark"
                onChange={props.onWatermarkToggle}
                type="checkbox"
              />
              {messageTranslate("admin.organizations.branding.watermark")}
            </label>
            <Show when={props.validationMessage}>
              {(message) => <AuthenticatedNotice class="mt-2.5" message={message()} tone="danger" />}
            </Show>
          </AuthenticatedSection>
        </form>
      </OrganizationAdminState>
    </section>
  )
}

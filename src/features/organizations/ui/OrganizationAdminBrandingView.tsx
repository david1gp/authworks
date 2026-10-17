import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
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
    <AuthenticatedPageBody>
      <OrganizationAdminNotice notice={props.notice} />

      <OrganizationAdminState
        emptyDetail={messageTranslate("admin.organizations.branding.description")}
        error={props.error}
        onRetry={props.onRetry}
        status={props.status}
      >
        <form class="grid min-w-0 max-w-3xl gap-4 [&>*]:min-w-0 [&_label]:text-[0.8125rem]" onSubmit={props.onSubmit}>
          <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
            <For each={["light", "dark"] as const}>
              {(key) => (
                <AuthenticatedSection padded title={messageTranslate(themeLabelKeys[key])}>
                  <div class="grid gap-4">
                    <div class="grid gap-4 sm:grid-cols-2">
                      <For each={themeColorFields}>
                        {(field) => {
                          const id = `branding-${key}-${field.key}`
                          const value = () => theme(key)[field.key]
                          return (
                            <div class="grid min-w-0 gap-1.5">
                              <Label for={id}>{messageTranslate(field.labelKey)}</Label>
                              <div class="flex items-center gap-2">
                                <input
                                  aria-label={messageTranslate(field.labelKey)}
                                  class={`${authenticatedControlClasses.input} max-w-9 shrink-0 cursor-pointer`}
                                  onInput={(event) =>
                                    props.onThemeColorInput(key, field.key, event.currentTarget.value)
                                  }
                                  type="color"
                                  style={{ padding: "4px" }}
                                  value={value()}
                                />
                                <AuthenticatedInput
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
                    <div class="grid gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2">
                      <div class="grid min-w-0 gap-1">
                        <Label for={`branding-${key}-logoUrl`}>
                          {messageTranslate("admin.organizations.branding.logoUrl")}
                        </Label>
                        <AuthenticatedInput
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
                        <AuthenticatedInput
                          id={`branding-${key}-iconUrl`}
                          onInput={(event) => props.onThemeAssetInput(key, "iconUrl", event.currentTarget.value)}
                          placeholder={messageTranslate("common.urlPlaceholder")}
                          value={theme(key).iconUrl ?? ""}
                        />
                      </div>
                    </div>
                    <div
                      class="rounded-control border border-line px-4 py-4"
                      style={{ background: theme(key).backgroundColor, color: theme(key).fontColor }}
                    >
                      <p class="text-xs font-medium opacity-80">
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

          <AuthenticatedSection description={messageTranslate("admin.organizations.branding.description")} padded>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="grid min-w-0 gap-1">
                <Label for="branding-theme-mode">{messageTranslate("admin.organizations.branding.themeMode")}</Label>
                <div class="relative w-full min-w-0">
                  <select
                    class={`${authenticatedControlClasses.select} appearance-none pe-9`}
                    id="branding-theme-mode"
                    onChange={(event) =>
                      props.onThemeModeInput(event.currentTarget.value as "dark" | "light" | "system")
                    }
                    value={props.branding.themeMode}
                  >
                    <option value="system">{messageTranslate("common.theme.system")}</option>
                    <option value="light">{messageTranslate("common.theme.light")}</option>
                    <option value="dark">{messageTranslate("common.theme.dark")}</option>
                  </select>
                  <Icon
                    path={mdiChevronDown}
                    class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="branding-terms">{messageTranslate("admin.organizations.branding.termsUrl")}</Label>
                <AuthenticatedInput
                  id="branding-terms"
                  onInput={(event) => props.onLegalUrlInput("termsUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={props.branding.legal?.termsUrl ?? ""}
                />
              </div>
              <div class="grid min-w-0 gap-1">
                <Label for="branding-privacy">{messageTranslate("admin.organizations.branding.privacyUrl")}</Label>
                <AuthenticatedInput
                  id="branding-privacy"
                  onInput={(event) => props.onLegalUrlInput("privacyUrl", event.currentTarget.value)}
                  placeholder={messageTranslate("common.urlPlaceholder")}
                  value={props.branding.legal?.privacyUrl ?? ""}
                />
              </div>
            </div>
            <label
              class="mt-4 flex min-h-10 items-center gap-3 rounded-control border border-line-subtle px-3 py-2 text-[0.8125rem] font-medium"
              for="branding-watermark"
            >
              <input
                checked={props.branding.disableWatermark}
                class={authenticatedControlClasses.checkbox}
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
          <div class="flex justify-end">
            <AuthenticatedButton
              disabled={props.pendingId === "branding"}
              icon={mdiContentSave}
              type="submit"
              variant="filledBlue"
            >
              {messageTranslate("common.save")}
            </AuthenticatedButton>
          </div>
        </form>
      </OrganizationAdminState>
    </AuthenticatedPageBody>
  )
}

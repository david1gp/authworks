import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationBranding } from "../public/organizationBrandingSchema.js"
import type { OrganizationConfigurationThemeKey } from "./organizationConfigurationBrandingStateCreate.js"

/** Mini sign-in card rendered from the current branding form values, not the saved values. */
export function OrganizationConfigurationPreviewCard(props: {
  readonly branding: OrganizationBranding
  readonly organizationName: string
  readonly theme: OrganizationConfigurationThemeKey
}) {
  const active = () => props.branding[props.theme]
  return (
    <div
      class="overflow-hidden rounded-panel border border-line shadow-panel"
      style={{ background: active().backgroundColor, color: active().fontColor }}
    >
      <div class="grid gap-3 px-5 py-5">
        <div class="flex items-center gap-2.5">
          <Show
            when={active().logoUrl}
            fallback={
              <span
                aria-hidden="true"
                class="grid size-8 place-items-center rounded-control text-sm font-bold"
                style={{ background: active().primaryColor, color: "#ffffff" }}
              >
                {props.organizationName.slice(0, 1).toUpperCase()}
              </span>
            }
          >
            {(logoUrl) => (
              <img alt="" aria-hidden="true" class="size-8 rounded-control object-contain" src={logoUrl()} />
            )}
          </Show>
          <p class="truncate text-sm font-semibold">{props.organizationName}</p>
        </div>
        <div class="grid gap-1">
          <p class="text-base font-semibold tracking-tight">{messageTranslate("app.tagline")}</p>
          <p class="text-xs opacity-80">{messageTranslate("admin.configuration.previewDescription")}</p>
        </div>
        <div class="grid gap-2">
          <span
            aria-hidden="true"
            class="block h-9 w-full rounded-control border px-3 text-sm leading-9 opacity-70"
            style={{ "border-color": "currentColor" }}
          >
            {messageTranslate("admin.configuration.previewEmail")}
          </span>
          <span
            class="block h-9 w-full rounded-control text-center text-sm font-medium leading-9"
            style={{ background: active().primaryColor, color: "#ffffff" }}
          >
            {messageTranslate("common.signIn")}
          </span>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-80">
          <span>{messageTranslate("admin.configuration.privacyUrl")}</span>
          <span>{messageTranslate("admin.configuration.termsUrl")}</span>
        </div>
      </div>
    </div>
  )
}

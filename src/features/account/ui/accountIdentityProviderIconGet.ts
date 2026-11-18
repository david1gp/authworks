import { mdiGithub } from "@adaptive-ds/mdi/mdiGithub.js"
import { mdiGoogle } from "@adaptive-ds/mdi/mdiGoogle.js"
import { mdiLinkVariant } from "@adaptive-ds/mdi/mdiLinkVariant.js"
import { mdiMicrosoft } from "@adaptive-ds/mdi/mdiMicrosoft.js"
import { iconApple } from "#ui/static/icons/iconApple.js"

/** Returns the brand icon path of an external identity provider type, or a neutral link glyph. */
export function accountIdentityProviderIconGet(providerType: string): string {
  if (providerType === "google") return mdiGoogle
  if (providerType === "github") return mdiGithub
  if (providerType === "microsoft") return mdiMicrosoft
  if (providerType === "apple") return iconApple
  return mdiLinkVariant
}

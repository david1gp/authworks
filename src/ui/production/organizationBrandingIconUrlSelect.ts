import type { OrganizationBranding } from "../../features/organizations/public/organizationBrandingSchema.js"

/**
 * Picks the square organization mark for sidebar tiles: the light-theme icon first, then the
 * dark-theme icon, then either theme's logo as a last resort. Membership branding is the only
 * source; the realm-administrator list carries no branding.
 */
export function organizationBrandingIconUrlSelect(branding: OrganizationBranding | undefined): string | undefined {
  return (
    branding?.light.icon?.url ??
    branding?.light.iconUrl ??
    branding?.dark.icon?.url ??
    branding?.dark.iconUrl ??
    branding?.light.logo?.url ??
    branding?.light.logoUrl ??
    branding?.dark.logo?.url ??
    branding?.dark.logoUrl
  )
}

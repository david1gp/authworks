import type { OrganizationBranding } from "../../organizations/public/organizationBrandingSchema.js"

type OrganizationBrandingTheme = OrganizationBranding["light"]

const organizationBrandingThemeLogoUrlGet = (theme: OrganizationBrandingTheme) =>
  theme.logo?.url ?? theme.logoUrl ?? theme.icon?.url ?? theme.iconUrl

export function accountOrganizationBrandMarkStateCreate(branding: () => OrganizationBranding | undefined) {
  const lightUrl = () => {
    const value = branding()
    if (value === undefined) return undefined
    return organizationBrandingThemeLogoUrlGet(value.light) ?? organizationBrandingThemeLogoUrlGet(value.dark)
  }
  const darkUrl = () => {
    const value = branding()
    if (value === undefined) return undefined
    return organizationBrandingThemeLogoUrlGet(value.dark) ?? organizationBrandingThemeLogoUrlGet(value.light)
  }

  return { darkUrl, lightUrl }
}

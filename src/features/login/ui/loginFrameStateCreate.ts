import type { OrganizationDiscoveryResponse } from "../../organizations/public/organizationDiscoveryResponseSchema.js"

export function loginFrameStateCreate(bootstrap: () => Extract<OrganizationDiscoveryResponse, { found: true }>) {
  return {
    bootstrap,
    legal: () => bootstrap().branding.legal ?? bootstrap().branding.legalUrls,
    theme: () => bootstrap().branding.light,
  }
}

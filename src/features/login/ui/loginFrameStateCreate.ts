import type { LoginDiscovery } from "./loginAdapter.js"

export function loginFrameStateCreate(bootstrap: () => LoginDiscovery) {
  return {
    bootstrap,
    legal: () => bootstrap().branding.legal ?? bootstrap().branding.legalUrls,
    theme: () => bootstrap().branding.light,
  }
}

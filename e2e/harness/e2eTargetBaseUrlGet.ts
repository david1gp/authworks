import { e2eTargetRequire } from "./e2eTargetResolve.js"

/**
 * Fail-closed base-URL reader. Delegates to the single target resolver, so an
 * unset, empty, or unknown AUTHWORKS_E2E_TARGET throws before any request.
 */
export function e2eTargetBaseUrlGet(environment: Readonly<Record<string, string | undefined>> = process.env): string {
  return e2eTargetRequire(environment).baseUrl
}

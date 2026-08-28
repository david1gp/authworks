import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

/**
 * Resolves the catalog key that titles or describes a demo administration scenario, so demo page
 * headers stay translated instead of echoing the untranslated fixture group metadata.
 */
export function demoAdminScenarioMessageKeyGet(
  scenarioKey: string,
  kind: "description" | "title",
): MessageKey | undefined {
  const candidate = `demo.admin.scenario.${scenarioKey.replaceAll("-", "_")}.${kind}` as MessageKey
  return candidate in englishCatalog ? candidate : undefined
}

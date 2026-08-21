import { productionSessionContextGet } from "./productionSessionContextGet.js"

export function productionFocusShellStateCreate() {
  const session = productionSessionContextGet()
  return {
    realmLabel: () => {
      const realmId = typeof session.guard.realm === "object" ? session.guard.realm.realmId : ""
      return session.realms.find((realm) => realm.id === realmId)?.label ?? "Authworks"
    },
  }
}

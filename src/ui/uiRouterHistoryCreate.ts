import { browserHistory, type RouterHistory } from "@solidjs/router"

/** Keep router location reactive when the debounced UI search writer replaces the current URL. */
export function uiRouterHistoryCreate(): RouterHistory {
  const history = browserHistory()
  return {
    ...history,
    init(notify) {
      const historyDispose = history.init?.(notify)
      const searchReplaced = () => notify(history.get())
      window.addEventListener("authworks:url-search-replaced", searchReplaced)
      return () => {
        historyDispose?.()
        window.removeEventListener("authworks:url-search-replaced", searchReplaced)
      }
    },
  }
}

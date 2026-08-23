import { render } from "solid-js/web"
import { languageInitialize } from "./i18n/model/languageInitialize.js"
import { productionApplicationContextsCreate } from "./production/productionApplicationContextsCreate.js"
import { productionShellContextDefault } from "./production/productionShellContextDefault.js"
import { UiRouter } from "./UiRouter.js"
import "./styles.css"

const root = document.getElementById("app")

if (root) {
  const contexts =
    window.location.pathname === "/" || window.location.pathname.startsWith("/demo")
      ? Promise.resolve(productionShellContextDefault)
      : productionApplicationContextsCreate()
  void Promise.all([languageInitialize(window), contexts]).then(([, resolvedContexts]) => {
    render(() => <UiRouter api={resolvedContexts.api} session={resolvedContexts.session} />, root)
  })
}

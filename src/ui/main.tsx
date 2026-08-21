import { render } from "solid-js/web"
import { languageInitialize } from "./i18n/model/languageInitialize.js"
import { UiRouter } from "./UiRouter.js"
import "./styles.css"

const root = document.getElementById("app")

if (root) {
  void languageInitialize(window).then(() => {
    render(() => <UiRouter />, root)
  })
}

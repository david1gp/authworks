import { render } from "solid-js/web"
import { UiRouter } from "./UiRouter.js"
import "./styles.css"

const root = document.getElementById("app")

if (root) {
  render(() => <UiRouter />, root)
}

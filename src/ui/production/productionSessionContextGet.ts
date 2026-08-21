import { useContext } from "solid-js"
import { productionSessionContext } from "./productionSessionContext.js"

export function productionSessionContextGet() {
  return useContext(productionSessionContext)
}

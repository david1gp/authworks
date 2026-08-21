import { createContext } from "solid-js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"
import { productionShellContextDefault } from "./productionShellContextDefault.js"

export const productionSessionContext = createContext<ProductionSessionContextValue>(
  productionShellContextDefault.session,
)

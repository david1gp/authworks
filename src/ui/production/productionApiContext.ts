import { createContext } from "solid-js"
import type { ProductionApiContextValue } from "./productionApiContextValue.js"
import { productionShellContextDefault } from "./productionShellContextDefault.js"

export const productionApiContext = createContext<ProductionApiContextValue>(productionShellContextDefault.api)

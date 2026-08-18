import * as v from "valibot"
import { listPageSizeMax } from "./listPageSizeMax.js"

export const listPageSizeSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(listPageSizeMax))

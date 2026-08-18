import { expect, test } from "bun:test"
import * as v from "valibot"
import { listCursorDecode } from "../../src/platform/http/listCursorDecode.js"
import { listCursorEncode } from "../../src/platform/http/listCursorEncode.js"
import { listPageFromRows } from "../../src/platform/http/listPageFromRows.js"
import { listPageSizeDefault } from "../../src/platform/http/listPageSizeDefault.js"
import { listPageSizeMax } from "../../src/platform/http/listPageSizeMax.js"
import { listPageSizeResolve } from "../../src/platform/http/listPageSizeResolve.js"
import { listQueryParse } from "../../src/platform/http/listQueryParse.js"
import { listResponseSchemaCreate } from "../../src/platform/http/listResponseSchemaCreate.js"

test("list page sizes use the default and hard maximum", () => {
  expect(listPageSizeResolve(undefined)).toBe(listPageSizeDefault)
  expect(listPageSizeResolve(listPageSizeMax + 1)).toBe(listPageSizeMax)
})

test("list cursors round trip through opaque base64url encoding", () => {
  const encoded = listCursorEncode({ id: "01912345-0000-7000-8000-000000000000", k: "Ada/One" })
  const decoded = listCursorDecode(encoded)

  expect(decoded).toEqual({
    data: { id: "01912345-0000-7000-8000-000000000000", k: "Ada/One" },
    success: true,
  })
  expect(encoded).not.toContain("{")
})

test("list cursor decoding rejects garbage", () => {
  expect(listCursorDecode("not-a-cursor").success).toBe(false)
})

test("list pages emit a token only when another row exists", () => {
  const rows = [
    { id: "1", name: "one" },
    { id: "2", name: "two" },
    { id: "3", name: "three" },
  ]

  const firstPage = listPageFromRows({ rows, pageSize: 2, idGet: (row) => row.id, sortValueGet: (row) => row.name })
  const finalPage = listPageFromRows({
    rows: rows.slice(0, 2),
    pageSize: 2,
    idGet: (row) => row.id,
    sortValueGet: (row) => row.name,
  })

  expect(firstPage.items).toEqual(rows.slice(0, 2))
  expect(firstPage.nextPageToken).toBeString()
  expect(finalPage).toEqual({ items: rows.slice(0, 2) })
})

test("list query parsing rejects page sizes outside the validated range", () => {
  expect(listQueryParse({ pageSize: 0 }).success).toBe(false)
  expect(listQueryParse({ pageSize: listPageSizeMax + 1 }).success).toBe(false)
  expect(listQueryParse({}).success).toBe(true)
})

test("list response schemas require the common items envelope", () => {
  const schema = listResponseSchemaCreate(v.object({ id: v.string() }))

  expect(v.safeParse(schema, { items: [] }).success).toBe(true)
  expect(v.safeParse(schema, { items: [], nextPageToken: "next" }).success).toBe(true)
  expect(v.safeParse(schema, { users: [] }).success).toBe(false)
})

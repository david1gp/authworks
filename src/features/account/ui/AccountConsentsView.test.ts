import { expect, test } from "bun:test"
import ts from "typescript"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import { languagesSupported } from "../../../ui/i18n/model/languagesSupported.js"
import { translationCsvParse } from "../../../ui/i18n/model/translationCsvParse.js"

test("application consents are an independent compact card with expanded help and labelled detail rows; only the dialog can revoke", async () => {
  const source = await Bun.file(new URL("./AccountConsentsView.tsx", import.meta.url)).text()
  const tree = ts.createSourceFile("AccountConsentsView.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const elements: ts.JsxElement[] = []
  const actions: ts.JsxAttribute[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) elements.push(node)
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onClick") actions.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  const name = (element: ts.JsxElement) => element.openingElement.tagName.getText(tree)
  const ancestor = (node: ts.Node, tag: string): ts.JsxElement | undefined => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) && name(parent) === tag) return parent
    }
    return undefined
  }
  const cards = elements.filter((element) => name(element) === "AccountDisclosure")
  expect(cards).toHaveLength(1)
  const card = cards[0]!
  expect(card.openingElement.getText(tree)).toContain("icon={mdiApplicationOutline}")
  expect(card.openingElement.getText(tree)).toContain('summary={messageTranslate("account.access.consentTitle")}')
  expect(card.openingElement.getText(tree)).toContain("value={state.summaryValue()}")
  expect(card.openingElement.getText(tree)).not.toContain("consentDescription")
  expect(card.getText(tree)).toContain("account.access.consentDescription")
  const boundary = elements.find((element) => name(element) === "AccountStateBoundary")!
  expect(ancestor(boundary, "AccountDisclosure")).toBe(card)
  expect(boundary.openingElement.getText(tree)).toContain("onRetry={props.onRetry}")
  const dialog = elements.find((element) => name(element) === "AuthenticatedDialog")!
  expect(ancestor(dialog, "For")?.openingElement.getText(tree)).toContain("each={props.consents}")
  expect(dialog.openingElement.getText(tree)).toContain("triggerLabel={")
  expect(dialog.openingElement.getText(tree)).toContain(
    'title={messageTranslate("account.access.consentManage", { clientId: consent.clientId })}',
  )
  expect(dialog.openingElement.getText(tree)).toContain("open={state.dialogOpen(consent.clientId)}")
  expect(dialog.getText(tree)).toContain("consent.createdAt")
  expect(dialog.getText(tree)).toContain("consent.updatedAt")
  expect(dialog.getText(tree)).toContain(
    'messageTranslate("account.access.scopes", { scopes: consent.scope.join(", ") })',
  )
  expect(dialog.getText(tree)).toContain("<AccountRoleList values={consent.scope} />")
  expect(actions).toHaveLength(1)
  expect(actions[0]?.initializer?.getText(tree)).toBe("{() => state.consentRevoke(consent.clientId)}")
  expect(ancestor(actions[0]!, "AuthenticatedDialog")).toBe(dialog)
  const content = dialog.children.find((node) => ts.isJsxElement(node)) as ts.JsxElement
  const rows = content.children.filter((node) => ts.isJsxElement(node))
  expect(rows.at(-1)?.getText(tree)).toContain("state.consentRevoke(consent.clientId)")
  expect(rows.at(-1)?.getText(tree)).toContain("disabled={state.revokeDisabled(consent.clientId)}")
})

test("new consent labels exist in every supported locale with intact count, client and date placeholders", async () => {
  const keys = [
    "account.access.consentCount",
    "account.access.consentCountOne",
    "account.access.consentManage",
    "account.access.consentTitle",
    "account.access.consentUpdated",
  ] as const
  for (const language of languagesSupported.filter((language) => language.code !== "en")) {
    const csv = await Bun.file(new URL(`../../../../public/i18n/${language.code}.csv`, import.meta.url)).text()
    const parsed = translationCsvParse(csv)
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue
    for (const key of keys) {
      expect(parsed.data[key]).toBeTruthy()
      expect((parsed.data[key]?.match(/\{\w+\}/g) ?? []).sort()).toEqual(
        (englishCatalog[key].match(/\{\w+\}/g) ?? []).sort(),
      )
      expect(csv.split("\n").filter((line) => line.startsWith(`${key},`))).toHaveLength(1)
    }
  }
})

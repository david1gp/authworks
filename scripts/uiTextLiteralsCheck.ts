import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

type UiTextLiteralDiagnostic = {
  readonly file: string
  readonly line: number
  readonly column: number
  readonly text: string
  readonly reason: string
}

// These attributes carry DOM, styling, route, schema, or component-state values rather than visible prose.
const technicalAttributeNames = new Set([
  "accept",
  "acceptCharset",
  "action",
  "autoComplete",
  "capture",
  "cellPadding",
  "cellSpacing",
  "charSet",
  "class",
  "className",
  "cols",
  "crossOrigin",
  "data-testid",
  "dir",
  "disabled",
  "draggable",
  "encType",
  "for",
  "form",
  "height",
  "href",
  "httpEquiv",
  "id",
  "idPrefix",
  "innerClass",
  "inputMode",
  "kind",
  "lang",
  "max",
  "maxLength",
  "method",
  "min",
  "minLength",
  "name",
  "pattern",
  "referrerPolicy",
  "rel",
  "required",
  "role",
  "rows",
  "size",
  "state",
  "screen",
  "src",
  "step",
  "tabIndex",
  "target",
  "type",
  "value",
  "variant",
  "width",
  "autocomplete",
  "inputmode",
])

// These attributes are user-visible or assistive text and must use messageTranslate (or ttc for compatibility).
const textAttributeNames = new Set([
  "alt",
  "aria-label",
  "description",
  "eyebrow",
  "label",
  "linkLabel",
  "placeholder",
  "title",
])

// UI state modules assign visible prose to these signal/field names, so their literals must be typed keys.
const stateMessageTargets = new Set([
  "discoveryMessage",
  "error",
  "errorMessage",
  "formError",
  "statusMessage",
  "validationMessage",
])

function fileIsUiState(path: string): boolean {
  return path.endsWith(".ts") && !path.endsWith(".test.ts") && /(^|\/)ui\//.test(path.replaceAll("\\", "/"))
}

function filesGet(root: string): readonly string[] {
  const roots = [join(root, "src", "ui"), join(root, "src", "features")]
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) visit(path)
      else if (path.endsWith(".tsx") || fileIsUiState(path)) files.push(path)
    }
  }
  for (const directory of roots) visit(directory)
  return files.sort()
}

type LiteralReport = (node: ts.Node, text: string, reason: string) => void

/**
 * State literals are only prose when they read like a sentence. Identifiers, enum values,
 * URLs, and single tokens never contain whitespace, so they stay exempt.
 */
function stateTextIsProse(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim()
  return /\s/.test(normalized) && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)
}

/** Reports literal prose written into a user-visible message signal such as `formError.set("...")`. */
function stateMessageVisit(node: ts.Node, report: LiteralReport): void {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
  const setter = node.expression
  if (setter.name.text !== "set") return
  const owner = setter.expression
  const target = ts.isIdentifier(owner)
    ? owner.text
    : ts.isPropertyAccessExpression(owner)
      ? owner.name.text
      : undefined
  if (target === undefined) return
  if (!stateMessageTargets.has(target)) return
  const [argument] = node.arguments
  if (argument === undefined) return
  const text = literalValueGet(argument)
  if (text !== undefined && stateTextIsProse(text)) report(argument, text, `${target} message`)
}

/** Reports literal prose returned from a user-visible message accessor such as `error: () => "..."`. */
function stateAccessorVisit(node: ts.Node, report: LiteralReport): void {
  if (!ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name)) return
  const target = node.name.text
  if (!stateMessageTargets.has(target) || !ts.isArrowFunction(node.initializer)) return
  const visit = (child: ts.Node) => {
    // Comparison operands carry fixture-state and enum values rather than visible prose.
    const isComparisonOperand = child.parent !== undefined && ts.isBinaryExpression(child.parent)
    const text = ts.isExpression(child) && !isComparisonOperand ? literalValueGet(child) : undefined
    if (text !== undefined && stateTextIsProse(text)) report(child, text, `${target} message`)
    ts.forEachChild(child, visit)
  }
  visit(node.initializer.body)
}

function textIsUiProse(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized || /^[A-Z]$/.test(normalized)) return false
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)
}

function attributeIsTechnical(name: string): boolean {
  return (
    technicalAttributeNames.has(name) || name.startsWith("data-") || (name.startsWith("aria-") && name !== "aria-label")
  )
}

function literalValueGet(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  return undefined
}

function callIsTtc(expression: ts.Expression): boolean {
  return (
    ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === "ttc"
  )
}

/** Finds visible TSX UI prose that bypasses the typed i18n catalog. */
export function uiTextLiteralsCheck(root: string): readonly UiTextLiteralDiagnostic[] {
  const diagnostics: UiTextLiteralDiagnostic[] = []
  for (const file of filesGet(root)) {
    const source = readFileSync(file, "utf8")
    const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
    const relativeFile = relative(root, file)
    const report = (node: ts.Node, text: string, reason: string) => {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      diagnostics.push({
        column: position.character + 1,
        file: relativeFile,
        line: position.line + 1,
        reason,
        text,
      })
    }
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = node.getText(sourceFile)
        if (textIsUiProse(text)) report(node, text.replace(/\s+/g, " ").trim(), "JSX text")
      }
      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile)
        if (node.initializer && ts.isStringLiteral(node.initializer) && !attributeIsTechnical(name)) {
          if (textAttributeNames.has(name)) report(node.initializer, node.initializer.text, `${name} attribute`)
        }
        if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expression = node.initializer.expression
          if (!callIsTtc(expression) && !attributeIsTechnical(name)) {
            const text = literalValueGet(expression)
            if (text !== undefined && textAttributeNames.has(name)) {
              report(expression, text, `${name} attribute`)
            }
          }
        }
      }
      stateMessageVisit(node, report)
      stateAccessorVisit(node, report)
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return diagnostics.sort((left, right) => {
    const leftKey = `${left.file}:${left.line}:${left.column}:${left.text}`
    const rightKey = `${right.file}:${right.line}:${right.column}:${right.text}`
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
  })
}

if (import.meta.main) {
  const diagnostics = uiTextLiteralsCheck(process.cwd())
  for (const diagnostic of diagnostics) {
    process.stdout.write(
      `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.reason}: ${diagnostic.text}\n`,
    )
  }
  if (diagnostics.length > 0) process.exitCode = 1
}

import * as acorn from "acorn"
import * as walk from "acorn-walk"

export interface AnalysisResult {
  approved: boolean
  failReason?: string
}

// Identifiers and member access patterns that are blocked in AI-generated components.
// Prevents: eval, dynamic code generation, DOM manipulation, env var access,
// network calls, and prototype pollution.
const BLOCKED_IDENTIFIERS = new Set([
  "eval",
  "Function",
  "XMLHttpRequest",
  "WebSocket",
  "fetch",
])

const BLOCKED_MEMBER_ROOTS = new Set([
  "document",
  "window",
  "process",
  "global",
  "globalThis",
])

const BLOCKED_PROPERTIES = new Set([
  "__proto__",
  "prototype",
  "constructor",
])

export function analyzeComponent(code: string): AnalysisResult {
  let ast: acorn.Node

  try {
    ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: "module",
    }) as acorn.Node
  } catch (err) {
    return {
      approved: false,
      failReason: `Syntax error: ${err instanceof Error ? err.message : "could not parse component"}`,
    }
  }

  let failReason: string | undefined

  walk.simple(ast, {
    ImportExpression() {
      failReason ??= "Dynamic import() is not allowed"
    },
    CallExpression(node) {
      const callee = node.callee as acorn.Node & { type: string; name?: string }
      if (callee.type === "Identifier" && callee.name && BLOCKED_IDENTIFIERS.has(callee.name)) {
        failReason ??= `Blocked identifier: ${callee.name}()`
      }
    },
    NewExpression(node) {
      const callee = node.callee as acorn.Node & { type: string; name?: string }
      if (callee.type === "Identifier" && callee.name === "Function") {
        failReason ??= "new Function() is not allowed"
      }
      if (callee.type === "Identifier" && callee.name === "XMLHttpRequest") {
        failReason ??= "new XMLHttpRequest() is not allowed"
      }
    },
    MemberExpression(node) {
      const obj = node.object as acorn.Node & { type: string; name?: string }
      const prop = node.property as acorn.Node & { type: string; name?: string }

      if (obj.type === "Identifier" && obj.name && BLOCKED_MEMBER_ROOTS.has(obj.name)) {
        failReason ??= `Access to ${obj.name} is not allowed`
      }
      if (prop.type === "Identifier" && prop.name && BLOCKED_PROPERTIES.has(prop.name)) {
        failReason ??= `Access to .${prop.name} is not allowed`
      }
    },
    Identifier(node) {
      const id = node as acorn.Node & { name: string }
      if (BLOCKED_IDENTIFIERS.has(id.name)) {
        failReason ??= `Blocked identifier: ${id.name}`
      }
    },
  })

  if (failReason) {
    return { approved: false, failReason }
  }

  return { approved: true }
}

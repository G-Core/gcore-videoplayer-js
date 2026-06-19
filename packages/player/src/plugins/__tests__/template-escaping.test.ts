import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Regression guard for template XSS (VP-6570).
 *
 * Clappr's templater offers two interpolation delimiters:
 *   <%= expr %>  — raw, NOT escaped (safe only for trusted/computed values)
 *   <%- expr %>  — HTML-escaped (safe for any value)
 *
 * Any value that can originate from a stream manifest, a remote API, or
 * plugin config MUST be rendered with <%- ... %>. This test fails if a
 * template uses the raw <%= ... %> delimiter for anything other than the
 * allowlisted, provably-safe cases below, forcing new dynamic data through
 * the escaping delimiter.
 *
 * Allowed raw <%= %> cases:
 *  - SVG icon identifiers (bundled constants), e.g. `icon`, `checkIcon`, `pipIcon`
 *  - localized strings, i.e. `i18n.t(...)`
 *  - pure boolean / numeric / comparison / ternary expressions (computed,
 *    not free text), detected by the presence of an operator
 *  - the media-control layout token interpolated as an attribute *name*
 *    (`data-<%= name %>`), which is a trusted internal enum, not a value
 */

const assetsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../assets',
)

function listEjsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listEjsFiles(full))
    } else if (entry.name.endsWith('.ejs')) {
      out.push(full)
    }
  }
  return out
}

const ICON_RE = /^[\w$]*[Ii]con$/
const OPERATOR_RE = /===|==|!==|!=|[?]|&&|\|\||[<>]/

function isAllowedRawInterpolation(expr: string, prefix: string): boolean {
  // Attribute-*name* interpolation of the trusted layout token, e.g. data-<%= name %>
  if (prefix.endsWith('data-')) {
    return true
  }
  const e = expr.trim()
  if (ICON_RE.test(e)) {
    return true
  }
  if (e.startsWith('i18n.t(')) {
    return true
  }
  // boolean / numeric / comparison / ternary expression — a computed value
  if (OPERATOR_RE.test(e)) {
    return true
  }
  return false
}

describe('template escaping (XSS regression guard)', () => {
  const files = listEjsFiles(assetsDir)

  it('finds template files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('uses the escaping delimiter for all non-allowlisted interpolations', () => {
    const violations: string[] = []
    const re = /<%=([\s\S]+?)%>/g
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        const prefix = text.slice(Math.max(0, m.index - 5), m.index)
        if (!isAllowedRawInterpolation(m[1], prefix)) {
          const rel = path.relative(assetsDir, file)
          violations.push(`${rel}: <%=${m[1]}%>`)
        }
      }
    }
    expect(violations, `Raw <%= %> used for potentially unsafe values:\n${violations.join('\n')}`).toEqual([])
  })
})

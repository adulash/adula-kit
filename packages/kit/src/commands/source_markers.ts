/**
 * Append to a marked literal array and rewrite it in the multi-line form Prettier keeps stable:
 * one item per line with a trailing comma and the marker last. Single-line arrays written by
 * earlier generators (`[a, /* marker *\/]`, `[a /* marker *\/]`) are normalized the same way.
 */
export function appendMarkedItem(source: string, marker: string, expression: string) {
  const offset = source.indexOf(marker)
  if (offset < 0 || source.indexOf(marker, offset + marker.length) >= 0)
    throw new Error(`Expected one registration marker: ${marker}`)
  const open = source.lastIndexOf('[', offset)
  const close = source.indexOf(']', offset + marker.length)
  if (open < 0 || close < 0)
    throw new Error(`Registration marker ${marker} must be inside an array`)
  const listed = source.slice(open + 1, offset)
  if (/[()[\]{}'"`]|\/\/|\/\*/.test(listed) || source.slice(offset + marker.length, close).trim())
    throw new Error(
      `Registration list around ${marker} is not a plain list; add ${expression} by hand`
    )
  const items = listed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const lineStart = source.lastIndexOf('\n', open) + 1
  const indent = /^[ \t]*/.exec(source.slice(lineStart, open))![0]
  const inner = `${indent}  `
  const lines = [...items, expression].map((item) => `${inner}${item},\n`).join('')
  return `${source.slice(0, open)}[\n${lines}${inner}${marker}\n${indent}]${source.slice(close + 1)}`
}

/** A new module definition, already in the project's Prettier layout. */
export function moduleSource(name: string, options: { reference?: boolean; typed?: boolean } = {}) {
  return [
    ...(options.typed ? ["import type { Module } from '@adula/kit'"] : []),
    '// adula:imports',
    'export default {',
    `  name: '${name}',`,
    `  label: { ar: '${name}', en: '${name}' },`,
    ...(options.reference === undefined ? [] : [`  reference: ${options.reference},`]),
    '  dependsOn: [],',
    '  resources: [/* adula:resources */],',
    `}${options.typed ? ' satisfies Module' : ''}`,
    '',
  ].join('\n')
}

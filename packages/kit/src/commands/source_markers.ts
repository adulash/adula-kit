/** Append to a marked literal array, including when the last item has no trailing comma. */
export function appendMarkedItem(source: string, marker: string, expression: string) {
  const offset = source.indexOf(marker)
  if (offset < 0 || source.indexOf(marker, offset + marker.length) >= 0)
    throw new Error(`Expected one registration marker: ${marker}`)
  const before = source.slice(0, offset).trimEnd()
  const separator = /[\[,]$/.test(before) ? '' : ', '
  return source.replace(marker, `${separator}${expression}, ${marker}`)
}

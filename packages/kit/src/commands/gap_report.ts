/**
 * Prepares KIT_GAPS.md for sharing with the kit maintainers: e-mails, URLs and
 * IPv4 addresses are masked, and gap titles are listed for a quick review.
 */
export function gapReport(content: string) {
  const masked = content
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
  const titles = (masked.match(/^## GAP-\d+.*$/gm) ?? []).map((title) => title.replace(/^## /, ''))
  return { masked, titles }
}

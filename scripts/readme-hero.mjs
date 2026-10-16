// Generates docs/assets/adulajs-hero.svg, the README's looping motion banner (CSS keyframes only).
// Run: node scripts/readme-hero.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = process.argv[2] ?? fileURLToPath(new URL('../docs/assets/adulajs-hero.svg', import.meta.url))
const T = 12 // loop length in seconds
const pct = (s) => ((s / T) * 100).toFixed(2)
const OUT_START = 10.9
const OUT_END = 11.6
let css = ''
let n = 0

// An element that rises in at `at` seconds and fades with everything else at the loop end.
function appear(at) {
  const name = `a${n++}`
  css += `@keyframes ${name}{0%,${pct(at)}%{opacity:0;transform:translateY(8px)}${pct(at + 0.45)}%,${pct(OUT_START)}%{opacity:1;transform:none}${pct(OUT_END)}%,100%{opacity:0;transform:none}}.${name}{animation:${name} ${T}s cubic-bezier(.2,.7,.2,1) infinite both}\n`
  return name
}
// A property that switches from `from` to `to` at `at` seconds.
function lightUp(at, prop, from, to) {
  const name = `l${n++}`
  css += `@keyframes ${name}{0%,${pct(at)}%{${prop}:${from}}${pct(at + 0.3)}%,${pct(OUT_START)}%{${prop}:${to}}${pct(OUT_END)}%,100%{${prop}:${from}}}.${name}{animation:${name} ${T}s ease infinite both}\n`
  return name
}
function draw(at, length) {
  const name = `d${n++}`
  css += `@keyframes ${name}{0%,${pct(at)}%{stroke-dashoffset:${length}}${pct(at + 0.6)}%,${pct(OUT_START)}%{stroke-dashoffset:0}${pct(OUT_END)}%,100%{stroke-dashoffset:${length}}}.${name}{stroke-dasharray:${length};animation:${name} ${T}s ease-in-out infinite both}\n`
  return name
}

// Moves an element by dx in `steps` jumps between at and at + dur (a typing effect).
function slide(at, dur, dx, steps) {
  const name = `s${n++}`
  css += `@keyframes ${name}{0%,${pct(at)}%{transform:translateX(0)}${pct(at + dur)}%,${pct(OUT_START)}%{transform:translateX(${dx}px)}${pct(OUT_END)}%,100%{transform:translateX(0)}}.${name}{animation:${name} ${T}s steps(${steps},end) infinite both}
`
  return name
}

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const C = { kw: '#93c5fd', str: '#86efac', key: '#e5e5e5', pun: '#737373', fn: '#fcd34d', bool: '#f9a8d4' }
const tok = (t, c) => `<tspan fill="${c}">${esc(t)}</tspan>`

// Code window
const code = [
  [tok('export default ', C.kw), tok('defineResource', C.fn), tok('({', C.pun)],
  ['  ', tok('name', C.key), tok(': ', C.pun), tok("'customers'", C.str), tok(',', C.pun)],
  ['  ', tok('label', C.key), tok(': { ', C.pun), tok('ar', C.key), tok(': ', C.pun), tok("'العملاء'", C.str), tok(' },', C.pun)],
  ['  ', tok('fields', C.key), tok(': { ', C.pun), tok('name', C.key), tok(': { ', C.pun), tok('type', C.key), tok(': ', C.pun), tok("'string'", C.str), tok(', ', C.pun), tok('required', C.key), tok(': ', C.pun), tok('true', C.bool), tok(' } },', C.pun)],
  ['  ', tok('list', C.key), tok(': [', C.pun), tok("'name'", C.str), tok(', ', C.pun), tok("'email'", C.str), tok('],', C.pun)],
  ['  ', tok('actions', C.key), tok(': [', C.pun), tok("'view'", C.str), tok(', ', C.pun), tok("'create'", C.str), tok(', ', C.pun), tok("'update'", C.str), tok('],', C.pun)],
  [tok('})', C.pun)],
]
const codeLines = code
  .map((parts, i) => `<text class="${appear(1.6 + i * 0.32)}" x="628" y="${136 + i * 25}" xml:space="preserve">${parts.join('')}</text>`)
  .join('\n    ')

// Generated outputs
const chips = ['Database table', 'Permissions', 'Screens', 'REST API', 'Tests']
let cx = 600
const chipSvg = chips
  .map((label, j) => {
    const w = label.length * 7.4 + 26
    const at = 4.4 + j * 0.32
    const g = `<g class="${appear(at - 0.15)}"><rect class="${lightUp(at, 'fill', '#171717', '#fafafa')}" x="${cx}" y="338" width="${w}" height="32" rx="16" stroke="#262626"/><text class="${lightUp(at, 'fill', '#a3a3a3', '#0a0a0a')}" x="${cx + w / 2}" y="359" text-anchor="middle" font-size="13" font-weight="600">${label}</text></g>`
    cx += w + 8
    return g
  })
  .join('\n    ')

// Generated RTL screen
const rows = [
  ['شركة الأفق للتجارة', 'info@ufuq.sa', 'نشط', true],
  ['مؤسسة النخبة', 'sales@nukhba.sa', 'نشط', true],
  ['مجموعة الرواد', 'hello@rowad.sa', 'معلّق', false],
]
const rowSvg = rows
  .map(([name, email, status, active], k) => {
    const y = 478 + k * 26
    return `<g class="${appear(6.6 + k * 0.28)}"><line x1="616" x2="1120" y1="${y - 17}" y2="${y - 17}" stroke="#e5e5e5"/><text x="1110" y="${y}" text-anchor="end" font-size="13" fill="#0a0a0a">${name}</text><text x="880" y="${y}" text-anchor="middle" font-size="12.5" fill="#737373" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${email}</text><rect x="${active ? 640 : 634}" y="${y - 13}" width="${active ? 40 : 52}" height="18" rx="9" fill="${active ? '#171717' : '#f5f5f5'}"/><text x="${active ? 660 : 660}" y="${y}" text-anchor="middle" font-size="11" font-weight="600" fill="${active ? '#fafafa' : '#171717'}">${status}</text></g>`
  })
  .join('\n    ')

const features = [
  'One declaration: table, screens, API and tests',
  'Permissions enforced in the UI, services and SQL',
  'Arabic-first RTL interface you own',
  'Built to be extended by AI coding agents',
]
const featureSvg = features
  .map(
    (f, i) =>
      `<g class="${appear(3.0 + i * 0.3)}"><g transform="translate(64 ${410 + i * 30})"><circle cx="9" cy="-5" r="9" fill="#171717" stroke="#333"/><path class="${draw(3.2 + i * 0.3, 14)}" d="M5 -5 l3 3 l5 -6" fill="none" stroke="#fafafa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="28" y="0" font-size="15.5" fill="#d4d4d4">${f}</text></g></g>`
  )
  .join('\n  ')

const winA = appear(1.1)
const arrow = draw(3.9, 60)
const appWin = appear(5.9)
const headA = appear(6.2)

const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="580" viewBox="0 0 1200 580" role="img" aria-labelledby="t d">
<title id="t">AdulaJS</title>
<desc id="d">AdulaJS, the TypeScript framework for business applications: one resource declaration becomes a database table, permissions, screens, a REST API and tests.</desc>
<style>
text{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}
.mono text,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace}
g,text,rect{transform-box:fill-box}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}.cursor{animation:blink 1.1s steps(1) infinite}
@keyframes glow{0%,100%{opacity:.55}50%{opacity:.9}}.glow{animation:glow 6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
__KEYFRAMES__</style>
<defs>
  <clipPath id="cmd"><rect x="1" y="1" width="438" height="52" rx="11"/></clipPath>
  <radialGradient id="g1" cx="0.78" cy="0.35" r="0.6"><stop offset="0" stop-color="#3f3f46" stop-opacity="0.55"/><stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="0.1" cy="0.1" r="0.5"><stop offset="0" stop-color="#27272a" stop-opacity="0.6"/><stop offset="1" stop-color="#0a0a0a" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" stroke-opacity="0.035"/></pattern>
  <marker id="tip" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#737373"/></marker>
  <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.5"/></filter>
</defs>
<rect width="1200" height="580" rx="20" fill="#0a0a0a"/>
<rect width="1200" height="580" rx="20" fill="url(#grid)"/>
<rect class="glow" width="1200" height="580" rx="20" fill="url(#g1)"/>
<rect width="1200" height="580" rx="20" fill="url(#g2)"/>
<rect x="0.5" y="0.5" width="1199" height="579" rx="19.5" fill="none" stroke="#262626"/>

<g class="${appear(0.1)}"><g transform="translate(64 70)"><rect width="246" height="30" rx="15" fill="#171717" stroke="#2e2e2e"/><circle cx="18" cy="15" r="4" fill="#4ade80"/><text x="32" y="20" font-size="13" fill="#a3a3a3">v2.0 · open source · MIT</text></g></g>
<text class="${appear(0.35)}" x="62" y="178" font-size="76" font-weight="800" fill="#fafafa" letter-spacing="-2.5">AdulaJS</text>
<text class="${appear(0.65)}" x="64" y="226" font-size="25" fill="#e5e5e5" font-weight="600" letter-spacing="-0.3">The TypeScript framework</text>
<text class="${appear(0.85)}" x="64" y="258" font-size="25" fill="#a3a3a3" font-weight="600" letter-spacing="-0.3">for business applications.</text>
<g class="${appear(1.1)}"><g class="mono" transform="translate(64 296)"><rect width="440" height="54" rx="12" fill="#171717" stroke="#2e2e2e"/><text x="20" y="33" font-size="16.5" fill="#737373">$</text><g clip-path="url(#cmd)"><text x="40" y="33" font-size="16.5" fill="#fafafa">npx create-adula-app@latest my-app</text><rect class="${slide(1.3, 1.6, 322, 34)}" x="38" y="12" width="330" height="30" fill="#171717"/><g class="${slide(1.3, 1.6, 320, 34)}"><rect class="cursor" x="40" y="18" width="9" height="20" fill="#fafafa"/></g></g></g></g>
${featureSvg}

<g class="${winA}" filter="url(#shadow)">
  <rect x="600" y="64" width="536" height="236" rx="14" fill="#111111" stroke="#2a2a2a"/>
  <path d="M600 78a14 14 0 0 1 14-14h508a14 14 0 0 1 14 14v18H600z" fill="#171717"/>
  <circle cx="622" cy="82" r="5" fill="#3f3f46"/><circle cx="640" cy="82" r="5" fill="#3f3f46"/><circle cx="658" cy="82" r="5" fill="#3f3f46"/>
  <text x="868" y="87" text-anchor="middle" font-size="12.5" fill="#737373" class="mono">modules/sales/resources/customers.ts</text>
  <g class="mono" font-size="14.5">
    ${codeLines}
  </g>
</g>
<path class="${arrow}" d="M868 304 V 330" stroke="#737373" stroke-width="1.6" fill="none" marker-end="url(#tip)" stroke-dashoffset="60"/>
<g>
    ${chipSvg}
</g>
<g class="${appWin}" filter="url(#shadow)">
  <rect x="600" y="388" width="536" height="160" rx="14" fill="#ffffff"/>
  <g class="${headA}">
    <text x="1110" y="420" text-anchor="end" font-size="17" font-weight="700" fill="#0a0a0a">العملاء</text>
    <rect x="616" y="402" width="92" height="28" rx="7" fill="#171717"/><text x="662" y="421" text-anchor="middle" font-size="12.5" font-weight="600" fill="#fafafa">إضافة عميل</text>
    <rect x="720" y="402" width="150" height="28" rx="7" fill="#ffffff" stroke="#e5e5e5"/><text x="858" y="421" text-anchor="end" font-size="12" fill="#a3a3a3">بحث…</text>
  </g>
  ${rowSvg}
</g>
</svg>
`
const svg = markup.replace('__KEYFRAMES__', css)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, svg)
console.log(`wrote ${out} (${svg.length} bytes, ${n} animations)`)

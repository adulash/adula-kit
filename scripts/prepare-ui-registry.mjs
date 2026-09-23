import { readFile, writeFile, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
const exec = promisify(execFile)
const root = new URL('../packages/ui/', import.meta.url)
const registry = JSON.parse(await readFile(new URL('registry.json', root), 'utf8'))
for (const filename of await readdir(new URL('registry/ui/', root))) {
  const path = new URL(`registry/ui/${filename}`, root)
  let code = await readFile(path, 'utf8')
  code = code.replaceAll('@/registry/new-york-v4/ui/', '~/components/ui/')
    .replace(/\bml-/g, 'ms-').replace(/\bmr-/g, 'me-').replace(/\bpl-/g, 'ps-').replace(/\bpr-/g, 'pe-')
    .replaceAll('text-left', 'text-start').replaceAll('text-right', 'text-end')
    .replaceAll('absolute top-4 right-4', 'absolute top-4 end-4')
    .replaceAll('absolute right-2', 'absolute end-2').replaceAll('absolute left-2', 'absolute start-2')
    .replaceAll('after:-right-1', 'after:-end-1').replaceAll('>Close<', '>إغلاق<')
  code = code.replace(/<(SelectPrimitive|DropdownMenuPrimitive|RadioGroupPrimitive|TabsPrimitive)\.Root(?! dir=)/g, '<$1.Root dir="rtl"')
  if (filename === 'pagination.tsx') code = code.replaceAll('"pagination"', '"التنقل بين الصفحات"')
    .replaceAll('Go to previous page', 'الصفحة السابقة').replaceAll('Go to next page', 'الصفحة التالية')
    .replaceAll('>Previous<', '>السابق<').replaceAll('>Next<', '>التالي<').replaceAll('>More pages<', '>صفحات أخرى<')
    .replaceAll('<ChevronLeftIcon />', '<ChevronLeftIcon className="rtl:rotate-180" />')
    .replaceAll('<ChevronRightIcon />', '<ChevronRightIcon className="rtl:rotate-180" />')
  if (filename === 'dropdown-menu.tsx') code = code.replace('className="ms-auto size-4"', 'className="ms-auto size-4 rtl:rotate-180"')
  if (filename === 'command.tsx') code = code.replace('"Command Palette"', '"قائمة الأوامر"').replace('"Search for a command to run..."', '"ابحث عن أمر لتنفيذه"')
  if (filename === 'calendar.tsx' && !code.includes('react-day-picker/locale')) code =
    code.replace('import * as React', "import { ar } from 'react-day-picker/locale'\nimport * as React").replace('<DayPicker\n', '<DayPicker\n      dir="rtl"\n      locale={ar}\n').replace('toLocaleString("default"', 'toLocaleString("ar"')
  if (filename === 'sonner.tsx') code = code.replace('import { useTheme } from "next-themes"\n', '')
    .replace('  const { theme = "system" } = useTheme()\n', '').replace('theme={theme as ToasterProps["theme"]}', 'theme="light"\n      dir="rtl"')
  if (filename === 'switch.tsx' && !code.includes('rtl:data-')) code = code.replace('data-[state=checked]:translate-x-[calc(100%-2px)]', 'data-[state=checked]:translate-x-[calc(100%-2px)] rtl:data-[state=checked]:-translate-x-[calc(100%-2px)]')
  await writeFile(path, code)
}
// Refresh exactly the packages already pinned; adding one is a reviewed edit to dependencies.json.
const packages = Object.keys(JSON.parse(await readFile(new URL('dependencies.json', root), 'utf8')))
const metadata = {}
const nodeDirectory = dirname(process.execPath)
const npm =
  process.env.NPM_CLI_PATH ??
  [
    join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'),
    join(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js'),
  ].find((candidate) => existsSync(candidate))
if (!npm) throw new Error('npm CLI not found next to Node.js; set NPM_CLI_PATH')
for (let offset = 0; offset < packages.length; offset += 4) {
  await Promise.all(packages.slice(offset, offset + 4).map(async (name) => {
    const { stdout } = await exec(process.execPath, [npm, 'view', name, 'version', 'time.modified', 'peerDependencies', '--json'])
    metadata[name] = JSON.parse(stdout)
  }))
}
const pins = Object.fromEntries(Object.entries(metadata).map(([name, value]) => [name, value.version]))
await writeFile(new URL('dependencies.json', root), JSON.stringify(pins, null, 2) + '\n')
await writeFile(new URL('../.work/ui-dependency-metadata.json', import.meta.url), JSON.stringify(metadata, null, 2) + '\n')
for (const item of registry.items) {
  item.dependencies = (item.dependencies ?? []).filter((name) => name !== 'next-themes').map((spec) => {
    const name = spec.replace(/@[^/@]+$/, '')
    if (!pins[name]) throw new Error(`Missing version: ${name}`)
    return `${name}@${pins[name]}`
  })
  if (['button', 'badge', 'tabs', 'alert'].includes(item.name)) item.dependencies.push(`class-variance-authority@${pins['class-variance-authority']}`)
  if (item.files.some((file) => file.path.endsWith('.tsx'))) item.dependencies.push(`lucide-react@${pins['lucide-react']}`)
  item.dependencies = [...new Set(item.dependencies)]
}
await writeFile(new URL('registry.json', root), JSON.stringify(registry, null, 2) + '\n')
console.log(JSON.stringify(pins, null, 2))

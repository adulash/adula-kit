// Public API contract of @adula/kit: every export of the built entry points and its
// declared type. Removing or changing an entry is a breaking change (major); adding
// one is a minor change. Run with --update after an intentional, reviewed change.
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const kit = join(root, 'packages/kit')
const require = createRequire(join(kit, 'package.json'))
const ts = require('typescript')
const report = join(kit, 'api/kit-api.json')
const entries = {
  '.': 'build/index.d.ts',
  './auth': 'build/src/auth/ability.d.ts',
  './types': 'build/src/resource/types.d.ts',
}

export function snapshot() {
  const files = Object.values(entries).map((file) => join(kit, file))
  const program = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
  })
  const checker = program.getTypeChecker()
  const api = {}
  for (const [entry, file] of Object.entries(entries)) {
    const source = program.getSourceFile(join(kit, file))
    if (!source) throw new Error(`Missing ${file}; build the kit first`)
    const symbol = checker.getSymbolAtLocation(source)
    const exports = {}
    for (const exported of checker.getExportsOfModule(symbol)) {
      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const declaration = target.declarations?.[0]
      const kind = declaration ? ts.SyntaxKind[declaration.kind] : 'Unknown'
      const type =
        target.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)
          ? checker.typeToString(checker.getDeclaredTypeOfSymbol(target), undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias)
          : checker.typeToString(checker.getTypeOfSymbolAtLocation(target, declaration ?? source), undefined, ts.TypeFormatFlags.NoTruncation)
      exports[exported.name] = { kind, type }
    }
    api[entry] = Object.fromEntries(Object.entries(exports).sort(([a], [b]) => a.localeCompare(b)))
  }
  return api
}

export function compare(previous, current) {
  const breaking = []
  const added = []
  for (const [entry, exports] of Object.entries(previous)) {
    for (const [name, value] of Object.entries(exports)) {
      const next = current[entry]?.[name]
      if (!next) breaking.push(`${entry} ${name}: removed`)
      else if (next.type !== value.type || next.kind !== value.kind) breaking.push(`${entry} ${name}: changed`)
    }
  }
  for (const [entry, exports] of Object.entries(current))
    for (const name of Object.keys(exports)) if (!previous[entry]?.[name]) added.push(`${entry} ${name}`)
  return { breaking, added }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = snapshot()
  if (process.argv.includes('--update')) {
    await writeFile(report, JSON.stringify(current, null, 2) + '\n')
    console.log(`Updated ${report}`)
  } else {
    const previous = JSON.parse(await readFile(report, 'utf8'))
    const { breaking, added } = compare(previous, current)
    if (breaking.length || added.length) {
      for (const line of breaking) console.error(`BREAKING ${line}`)
      for (const line of added) console.error(`ADDED ${line}`)
      console.error('The public API differs from packages/kit/api/kit-api.json. Review semver, then run pnpm check:api --update.')
      process.exit(1)
    }
    console.log(`Public API matches (${Object.values(current).reduce((sum, e) => sum + Object.keys(e).length, 0)} exports)`)
  }
}

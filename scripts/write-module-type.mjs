// `lib/esm` and `lib/cjs` both hold `.js` files. Node decides how to parse them
// from the nearest package.json, so each build gets its own marker.
import { writeFileSync } from 'node:fs'

const target = process.argv[2]

if (target !== 'esm' && target !== 'cjs') {
  console.error('usage: write-module-type.mjs <esm|cjs>')
  process.exit(1)
}

const type = target === 'esm' ? 'module' : 'commonjs'

writeFileSync(
  new URL(`../lib/${target}/package.json`, import.meta.url),
  `${JSON.stringify({ type }, null, 2)}\n`
)

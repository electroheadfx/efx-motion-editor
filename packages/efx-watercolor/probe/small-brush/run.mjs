#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the small-brush dab-density readout.
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage:
//    node probe/small-brush/run.mjs --gate <name> --out <path>
//    node probe/small-brush/run.mjs --gate <name> --out <path> \
//         --compare <beforePath>
//
//  The capture writes the report JSON to <path>; --compare additionally
//  checks the AFTER report against a frozen BEFORE capture and exits
//  non-zero on any failing row. The probe source is the instrument —
//  editing it between the two captures voids the comparison.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/small-brush'
const bundlePath = join(outDir, 'probe.bundle.js')
const pagePath = join(outDir, 'page.html')

function fail(message) {
  console.error(`[small-brush] ${message}`)
  process.exit(1)
}

// --- CLI ---------------------------------------------------------------------

const opts = { gate: null, out: null, compare: null }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  const flag = argv[i]
  const next = () => {
    i += 1
    if (i >= argv.length) fail(`${flag} needs a value`)
    return argv[i]
  }
  if (flag === '--gate') opts.gate = next()
  else if (flag === '--out') opts.out = next()
  else if (flag === '--compare') opts.compare = next()
  else fail(`unknown flag: ${flag}`)
}
if (!opts.gate) fail('--gate <name> is required')
if (!opts.out) fail('--out <path> is required')
const outPath = resolve(process.cwd(), opts.out)
const comparePath = opts.compare ? resolve(process.cwd(), opts.compare) : null
if (comparePath !== null && !existsSync(comparePath)) fail(`--compare target not found: ${comparePath}`)

// --- tool resolution (nothing is installed) ---------------------------------

function findEsbuild() {
  const candidates = [
    join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
    join(repoRoot, 'node_modules/.bin/esbuild'),
  ]
  const direct = candidates.find((path) => existsSync(path))
  if (direct) return direct
  // Search the pnpm store: any esbuild version's bin. Never install anything.
  const pnpmDir = join(repoRoot, 'node_modules/.pnpm')
  if (existsSync(pnpmDir)) {
    const found = readdirSync(pnpmDir)
      .filter((name) => /^esbuild@/.test(name))
      .sort()
      .map((name) => join(pnpmDir, name, 'node_modules/esbuild/bin/esbuild'))
      .find((path) => existsSync(path))
    if (found) return found
  }
  fail('esbuild not found; candidates:\n  ' + candidates.join('\n  '))
}
const esbuild = findEsbuild()

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter((path) => typeof path === 'string' && path.length > 0)
  const found = candidates.find((path) => existsSync(path))
  if (!found) fail('Chrome/Chromium not found; candidates:\n  ' + candidates.join('\n  '))
  return found
}
const chrome = findChrome()

// --- capture -----------------------------------------------------------------

function capture() {
  mkdirSync(outDir, { recursive: true })
  console.log('[small-brush] bundling probe.ts ...')
  const bundle = spawnSync(
    esbuild,
    [
      join(here, 'probe.ts'),
      '--bundle',
      '--format=iife',
      '--platform=browser',
      '--target=es2020',
      '--define:process.env.NODE_ENV="production"',
      '--outfile=' + bundlePath,
    ],
    { encoding: 'utf8' },
  )
  if (bundle.status !== 0) {
    console.error(bundle.stderr)
    fail('esbuild failed')
  }

  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' })
  if (head.status !== 0) fail('git rev-parse HEAD failed')
  const engineHead = (head.stdout ?? '').trim()
  if (!engineHead) fail('git rev-parse HEAD returned nothing')

  const metaScript =
    '<script>window.__GSD_PROBE_META__ = ' +
    JSON.stringify({ gate: opts.gate, engineHead }) +
    ';</script>'
  const html = readFileSync(join(here, 'index.html'), 'utf8').replace(
    '<!--LS-BUNDLE-->',
    metaScript + `<script>${readFileSync(bundlePath, 'utf8')}</script>`,
  )
  writeFileSync(pagePath, html)

  console.log('[small-brush] running headless Chrome (WebGL2) ...')
  const run = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files',
      '--dump-dom',
      'file://' + pagePath,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 },
  )
  if (run.status !== 0) {
    console.error(run.stderr)
    fail(`headless Chrome exited ${run.status}`)
  }
  const dom = run.stdout ?? ''
  const match = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/)
  if (!match) {
    writeFileSync(join(outDir, 'dom.html'), dom)
    fail(`no result block in the DOM (saved to ${join(outDir, 'dom.html')})`)
  }
  const unescapeHtml = (text) =>
    text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
  let result
  try {
    result = JSON.parse(unescapeHtml(match[1]))
  } catch (error) {
    writeFileSync(join(outDir, 'dom.html'), dom)
    fail(`result JSON parse failed: ${error.message}`)
  }
  if (!result || result.quick !== '261121-w5n') fail('result does not carry the 261121-w5n marker')
  return result
}

function printTable(report) {
  console.log('')
  console.log('================== small brush ==================')
  console.log(`quick ${report.quick} | gate ${report.gate} | head ${report.engineHead}`)
  console.log(`sheet ${report.sheet.join('x')} | brush ${report.brush} | pressure ${report.pressure} | travel ${report.travelPx} px | settle ${report.settleTicks} ticks`)
  console.log('')
  console.log('size | spacingPx | floorBinds | dabs')
  for (const c of report.cases) {
    console.log(
      `${String(c.size).padStart(4)} | ${String(c.spacingPx).padStart(9)} | ` +
        `${String(c.floorBinds).padEnd(10)} | ${String(c.dabs).padStart(5)}`,
    )
  }
  console.log('')
  console.log('feed: the stamped spacing (scripted pressure floored at its clamp) and the engine travel')
  for (const c of report.cases) {
    console.log(
      `size ${String(c.size).padStart(3)}: stamped ${String(c.spacingPxStamped).padStart(9)} px ` +
        `at pressure ${c.stampedPressure} | travelled ${c.travelledPx} px of ${report.travelPx} sampled`,
    )
  }
  console.log('')
  console.log(
    `parity size 10: ${report.paritySize10.equal ? 'EQUAL' : 'DIFFERS'} ` +
      `(${report.paritySize10.firstDigest} vs ${report.paritySize10.rebakeDigest})`,
  )
  console.log('=================================================')
}

// --- comparison --------------------------------------------------------------

function compareReports(before, after) {
  const lines = []
  let pass = true
  const check = (ok, label) => {
    lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`)
    if (!ok) pass = false
  }

  // (a) the scene constants: a moved scene invalidates every later row.
  const sceneKeys = ['sheet', 'brush', 'pressure', 'travelPx', 'settleTicks']
  for (const key of sceneKeys) {
    const same = JSON.stringify(before[key]) === JSON.stringify(after[key])
    check(same, `scene ${key}: ${JSON.stringify(before[key])} (BEFORE) vs ${JSON.stringify(after[key])} (AFTER)`)
  }

  // (b) every case present, in order, with non-empty digests.
  const wantSizes = [1, 10, 30, 100]
  const beforeCases = Array.isArray(before.cases) ? before.cases : []
  const afterCases = Array.isArray(after.cases) ? after.cases : []
  const layoutOk =
    beforeCases.length === wantSizes.length &&
    afterCases.length === wantSizes.length &&
    wantSizes.every((size, index) => beforeCases[index]?.size === size && afterCases[index]?.size === size)
  check(layoutOk, `four cases in order ${wantSizes.join(', ')}`)
  const digestsOk =
    afterCases.length === wantSizes.length &&
    afterCases.every(
      (c) =>
        typeof c.digestTransparent === 'string' &&
        c.digestTransparent.length > 0 &&
        typeof c.digestPigment === 'string' &&
        c.digestPigment.length > 0,
    )
  check(digestsOk, 'every AFTER case carries both digests')
  const spacingOk =
    beforeCases.length === afterCases.length &&
    beforeCases.every((c, index) => c.spacingPx === afterCases[index]?.spacingPx)
  check(spacingOk, 'spacingPx identical per size (the reported spacing law did not move)')

  if (layoutOk) {
    for (let index = 0; index < beforeCases.length; index += 1) {
      const b = beforeCases[index]
      const a = afterCases[index]
      if (b.floorBinds) {
        // (c) binding rows: the dab count strictly decreases.
        check(a.dabs < b.dabs, `size ${b.size} floor binds: dabs ${b.dabs} -> ${a.dabs} (strictly fewer)`)
      } else {
        // (d) inert rows: the BYTE-IDENTITY rows — dab count and both
        // paint-bearing exports must be exactly HEAD's, byte for byte.
        check(a.dabs === b.dabs, `size ${b.size} floor inert: dabs ${b.dabs} -> ${a.dabs} (unchanged)`)
        check(
          a.digestTransparent === b.digestTransparent,
          `size ${b.size} floor inert: transparent ${b.digestTransparent} -> ${a.digestTransparent} (identical)`,
        )
        check(
          a.digestPigment === b.digestPigment,
          `size ${b.size} floor inert: pigment ${b.digestPigment} -> ${a.digestPigment} (identical)`,
        )
        check(
          a.byteLength === b.byteLength,
          `size ${b.size} floor inert: byteLength ${b.byteLength} -> ${a.byteLength} (unchanged)`,
        )
      }
    }
  }

  // (e) first paint vs re-bake parity, in both captures.
  check(
    before?.paritySize10?.equal === true,
    `BEFORE parity size 10: ${before?.paritySize10?.equal === true ? 'equal' : 'differs'}`,
  )
  check(
    after?.paritySize10?.equal === true,
    `AFTER parity size 10: ${after?.paritySize10?.equal === true ? 'equal' : 'differs'}`,
  )

  return { pass, lines }
}

// --- main --------------------------------------------------------------------

const report = capture()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n')
printTable(report)
console.log(`result JSON: ${outPath}`)

if (comparePath !== null) {
  const before = JSON.parse(readFileSync(comparePath, 'utf8'))
  const comparison = compareReports(before, report)
  console.log('')
  console.log('=================== compare ===================')
  for (const line of comparison.lines) console.log(line)
  console.log(`RESULT: ${comparison.pass ? 'PASS' : 'FAIL'}`)
  console.log('===============================================')
  if (!comparison.pass) process.exit(1)
}

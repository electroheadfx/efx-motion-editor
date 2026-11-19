#!/usr/bin/env node
// ============================================================
//  compose.mjs — build the one committed comparison image.
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage: node probe/port-comparison/compose.mjs [--out <png>]
//         [--preview]
//
//  Generates /tmp/port-comparison/compose.html (no committed HTML) from the
//  panel PNGs the two drivers wrote under /tmp/port-comparison/, then
//  screenshots it with headless Chrome.
//
//  Three labelled rows on the committed image:
//    1  the wet crossing at Pickup 100 / Refill 0 / Feather 0 —
//       reference LEFT, Studio RIGHT;
//    2  the blank-sheet stroke at Feather 100 — reference LEFT (softness
//       0.34 only), Studio RIGHT (softness 0.34 plus the four-side ramp);
//    3  the same wet crossing BEFORE (corrected gate) and AFTER (final
//       engine) in Studio.
//  In --preview mode (Task 1) the AFTER panels do not exist yet: the Studio
//  column shows the BEFORE capture and row 3 is omitted, so the compositor
//  can be proven before the port lands. The default --out is
//  /tmp/port-comparison/preview.png; Task 3 writes the phase PNG explicitly.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = '/tmp/port-comparison'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outPath = outFlag >= 0 ? args[outFlag + 1] : join(outDir, 'preview.png')
const preview = args.includes('--preview')

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) {
  console.error('[port-comparison:compose] Chrome/Chromium not found')
  process.exit(1)
}

function panel(label, scene) {
  const path = join(outDir, label, `${scene}-paper.png`)
  if (!existsSync(path)) return null
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function figure(src, caption, sub) {
  if (!src) {
    return `<figure class="missing"><div class="empty">panel unavailable</div><figcaption>${caption}${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>`
  }
  return `<figure><img src="${src}" alt="${caption}"><figcaption>${caption}${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>`
}

const referenceCrossing = panel('reference', 'band-p100')
const referenceFeather = panel('reference', 'blank-f100')
// RULING 2026-11-19: row 1 shows the drag at the shipped Dry default (50),
// like the reference's own depletion. Row 3 keeps the Dry-0 census pair so
// BEFORE -> AFTER isolates the port, not the calibration.
const afterCrossing = panel('after', 'band-p100-dry50')
const afterCensus = panel('after', 'band-p100')
const afterFeather = panel('after', 'blank-f100')
const beforeCrossing = panel('before', 'band-p100')
const beforeFeather = panel('before', 'blank-f100')

const studioCrossing = afterCrossing ?? beforeCrossing
const studioFeather = afterFeather ?? beforeFeather
const studioTag = afterCrossing ? 'STUDIO — final engine' : 'STUDIO — corrected gate (preview)'
const studioFeatherTag = afterFeather ? 'STUDIO — final engine' : 'STUDIO — corrected gate (preview)'

const rows = [
  `<section>
    <h2>1 · Wet crossing — Pickup 100 / Refill 0 / Feather 0 · cornflower #5994e4 over wet yellow #e8c21a · bristle-flat · Body 0</h2>
    <div class="pair">
      ${figure(referenceCrossing, 'REFERENCE — craft-brushes lab', 'pickup 1.0 · smear 1.0 · softness 0.09 · default depletion')}
      ${figure(studioCrossing, studioTag, 'pickup 100 · refill 0 · feather 0 · body 0 · dry 50')}
    </div>
  </section>`,
  `<section>
    <h2>2 · Blank sheet — Feather 100 · cornflower #5994e4 · bristle-flat · Body 0</h2>
    <div class="pair">
      ${figure(referenceFeather, 'REFERENCE — craft-brushes lab', 'softness 0.34 only (no feather control)')}
      ${figure(studioFeather, studioFeatherTag, 'pickup 100 · feather 100 · softness 0.34 + four-side ramp')}
    </div>
  </section>`,
]

if (afterCensus && beforeCrossing) {
  rows.push(`<section>
    <h2>3 · The same wet crossing in Studio (Dry 0 census) — BEFORE (corrected §3.4 gate, pre-port) → AFTER (final engine)</h2>
    <div class="pair">
      ${figure(beforeCrossing, 'STUDIO — BEFORE', 'pickup 100 · refill 0 · feather 0 · body 0')}
      ${figure(afterCensus, 'STUDIO — AFTER', 'pickup 100 · refill 0 · feather 0 · body 0')}
    </div>
  </section>`)
} else if (!preview) {
  console.error('[port-comparison:compose] row 3 needs both before/ and after/ band-p100 panels')
  process.exit(1)
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>261119-pod — reference vs Studio</title>
<style>
  :root { --ink: #1b1a17; --muted: #6b6257; --line: #d9d2c5; --paper: #f6f3ec; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--paper); color: var(--ink);
    font: 13px/1.4 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; }
  main { padding: 22px 26px 26px; }
  header { display: flex; align-items: baseline; gap: 14px; border-bottom: 2px solid var(--ink); padding-bottom: 10px; margin-bottom: 16px; }
  header h1 { font-size: 19px; margin: 0; letter-spacing: 0.01em; }
  header p { margin: 0; color: var(--muted); font-size: 12px; }
  section { margin-bottom: 18px; break-inside: avoid; }
  h2 { font-size: 12.5px; font-weight: 600; margin: 0 0 8px; letter-spacing: 0.02em; text-transform: uppercase; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  figure { margin: 0; background: #fff; border: 1px solid var(--line); border-radius: 3px; overflow: hidden; }
  figure img { display: block; width: 100%; height: auto; }
  figcaption { padding: 7px 10px 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.03em;
    display: flex; justify-content: space-between; gap: 10px; border-top: 1px solid var(--line); }
  figcaption span { font-weight: 400; color: var(--muted); letter-spacing: 0; }
  .empty { display: flex; align-items: center; justify-content: center; height: 300px; color: var(--muted); background: #efeae0; }
</style>
</head>
<body>
<main>
  <header>
    <h1>Reference brush vs Studio engine — 261119-pod</h1>
    <p>800×600 · cold sheet #f6f3ec · same colour, brush, Pickup and Feather on both sides</p>
  </header>
  ${rows.join('\n')}
</main>
</body>
</html>
`

mkdirSync(outDir, { recursive: true })
const pagePath = join(outDir, 'compose.html')
writeFileSync(pagePath, html)

mkdirSync(dirname(outPath), { recursive: true })
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1240,1620',
    `--screenshot=${outPath}`,
    `file://${pagePath}`,
  ],
  { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 },
)
if (run.error) {
  console.error(`[port-comparison:compose] Chrome failed: ${run.error.message}`)
  process.exit(1)
}
if (!existsSync(outPath)) {
  console.error('[port-comparison:compose] Chrome wrote no screenshot')
  console.error(run.stderr?.slice(0, 4000) ?? '')
  process.exit(1)
}
console.log(`[port-comparison:compose] page: ${pagePath}`)
console.log(`[port-comparison:compose] image: ${outPath}`)

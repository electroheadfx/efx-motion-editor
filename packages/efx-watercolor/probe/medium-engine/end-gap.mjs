#!/usr/bin/env node
// ============================================================
// end-gap.mjs — quick 261126-n20's issue-1 bar, as code.
//
// The claim it judges: a committed acrylic stroke carries NO enclosed pale band
// between its body and its terminal band ("white pre-gap before the ragged end
// cap"). The detector walks the capture's own along-x visible-darkness profile
// (endMetrics.endPreGap.profile, sampled every `stationPx` document px over the
// stroke's CENTRAL HALF, from the body zone's outer edge to the census-anchored
// window hi) and keeps only runs that dip at least PRE_GAP_MARGIN below the
// body level AND are bracketed by body-level stations within PRE_GAP_BRACKET_PX
// on BOTH sides. A run touching either profile edge, or one whose outer side
// never returns (the stroke simply ending), is not an enclosed band.
//
// The constants below are FROZEN from the RED set, declared before any post
// capture exists. They may never be tuned after seeing a post value; a law that
// cannot pass is revised, never the bar.
//
// Measured RED state (2026-11-26, 1080 sheet unless noted):
//   - s400-d00-stop reads an 8 px run, depth 0.0373, atPx 638 (mid-body);
//   - s300-d70-stop reads 22 px, depth 0.0398, atPx 778 (mid-body);
//   - s450-d70-stop reads 4 px, depth 0.0328 — BELOW PRE_GAP_MIN_PX;
//   - every s600 cell (stop/mouse/bake, dry 0/70, mut 1/2, release 0.1/0.5/
//     0.9), every s200 cell, and the 2K/4K size-600 captures read NO run at
//     all: at Size 600 the terminal cap lies outside the raster (last tap ~918
//     + 1.05r = 1233 > dw-1 on 1080; the engine clamps the document to 2048 so
//     no sheet makes room: 0.15 x 2048 = 307 px against a 315 px cap reach).
//   - No terminal (pre-cap) band reproduces on the probe's end lane; the task
//     STOPPED with this measured negative result and shipped NO end law.
//
// usage:
//   node end-gap.mjs --pre <dir>                  report + capture integrity
//   node end-gap.mjs --pre <dir> --post <dir> --assert
//                                                 the full pre/post bar
//
//   --pre <dir>   where the rtc-gap-pre-* captures live (default /tmp/medium-engine)
//   --post <dir>  where the rtc-gap-post-* captures live (default: the --pre dir)
//   --assert      pair every pre cell with its post twin by suffix and enforce
//                 the constants below; without it the tool is report-only over
//                 the PRE set and exits 1 only on capture integrity.
//
// The cell set is Task 1's 22 cells: the 18-cell matrix (sizes 200/400/600 x
// drys 00/70 x drives stop/mouse/bake), the three onset cells (s300 stop, s300
// bake, s450 stop) and the seeded pair cell (s600 dry 70 stop, mut 2).
//
// The capture shape it reads (probe.ts `bristleEndReport`):
//   brush, endCensus { drive, taps, ... },
//   endMetrics.endPreGap { largestRunPx, maxDepth, atPx, bracketed, bodyLevel,
//   stationCount, stationPx, x0Px, windowHi, profile[] }
// A capture whose brush is not 'bristle-round', whose census is empty, whose
// drive is crossed, or whose profile is absent fails capture integrity: a
// stale, crossed or hand-edited capture can never stand in for the lane it
// claims. This tool never writes a capture and never moves a baseline.
// ============================================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// --- the declared bar -------------------------------------------------------
// Declared 2026-11-26 from the RED set, BEFORE any post capture. Do not tune.

/** A run counts as pale when it sits at least this far below the body level,
 *  in image units. Never lowered: a shallower dip is body noise. */
const PRE_GAP_MARGIN = 0.03
/** The narrowest run that counts as a band, document px (3 stations). */
const PRE_GAP_MIN_PX = 6
/** Each pale run must be bracketed by body-level stations within this many
 *  document px on BOTH sides. Mirrors probe.ts's END_PRE_GAP_BRACKET_PX. */
const PRE_GAP_BRACKET_PX = 48

const PRE_PREFIX = 'rtc-gap-pre-'
const POST_PREFIX = 'rtc-gap-post-'

// --- the cell set -----------------------------------------------------------

/** Every expected cell: its suffix, its own drive (asserted so a crossed
 *  capture cannot stand in for the lane it claims), and the bar class. */
const GAP_CELLS = []
for (const size of ['200', '400', '600']) {
  for (const dry of ['00', '70']) {
    for (const drive of ['stop', 'mouse', 'bake']) {
      GAP_CELLS.push({ suffix: `s${size}-d${dry}-${drive}`, drive, size })
    }
  }
}
GAP_CELLS.push({ suffix: 's300-d70-stop', drive: 'stop', size: '300' })
GAP_CELLS.push({ suffix: 's300-d70-bake', drive: 'bake', size: '300' })
GAP_CELLS.push({ suffix: 's450-d70-stop', drive: 'stop', size: '450' })
GAP_CELLS.push({ suffix: 's600-d70-stop-mut2', drive: 'stop', size: '600' })

// --- helpers ---------------------------------------------------------------

const args = process.argv.slice(2)
const readFlag = (name, fallback) => {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error(`missing value for ${name}`)
    process.exit(2)
  }
  return value
}
const preDir = readFlag('--pre', '/tmp/medium-engine')
const postDir = readFlag('--post', preDir)
const assertMode = args.includes('--assert')

const failures = []
const fail = (message) => failures.push(message)
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const fixed = (value, digits = 4) => (num(value) === null ? 'n/a' : num(value).toFixed(digits))
const round4 = (value) => Math.round(value * 10000) / 10000

/** The frozen detector, self-contained on the emitted profile. Identical walk
 *  to probe.ts's `enclosedPaleRun` (endGap.ts): a bracketed pale run only. */
function detectGap(preGap) {
  const profile = Array.isArray(preGap.profile) ? preGap.profile : null
  const bodyLevel = num(preGap.bodyLevel)
  const stationPx = num(preGap.stationPx)
  const x0Px = num(preGap.x0Px) ?? 0
  if (profile === null || bodyLevel === null || stationPx === null || stationPx <= 0) {
    return null
  }
  const n = profile.length
  const bracketStations = Math.max(1, Math.round(PRE_GAP_BRACKET_PX / stationPx))
  const pale = (value) => value <= bodyLevel - PRE_GAP_MARGIN
  const atBody = (value) => value >= bodyLevel - PRE_GAP_MARGIN * 0.5
  let largestRunPx = 0
  let maxDepth = 0
  let atPx = 0
  let i = 0
  while (i < n) {
    if (!pale(profile[i])) {
      i += 1
      continue
    }
    let j = i
    while (j + 1 < n && pale(profile[j + 1])) j += 1
    let leftBracket = false
    for (let k = i - 1; k >= 0 && k >= i - bracketStations; k -= 1) {
      if (atBody(profile[k])) {
        leftBracket = true
        break
      }
    }
    let rightBracket = false
    for (let k = j + 1; k < n && k <= j + bracketStations; k += 1) {
      if (atBody(profile[k])) {
        rightBracket = true
        break
      }
    }
    if (leftBracket && rightBracket) {
      const runPx = (j - i + 1) * stationPx
      let minimum = profile[i]
      for (let k = i + 1; k <= j; k += 1) minimum = Math.min(minimum, profile[k])
      if (runPx > largestRunPx) {
        largestRunPx = runPx
        maxDepth = bodyLevel - minimum
        atPx = x0Px + i * stationPx
      }
    }
    i = j + 1
  }
  return {
    largestRunPx,
    maxDepth: round4(maxDepth),
    atPx,
    detected: largestRunPx >= PRE_GAP_MIN_PX,
  }
}

function readCapture(dir, prefix, cell) {
  const path = join(dir, `${prefix}${cell.suffix}.json`)
  if (!existsSync(path)) {
    fail(`missing capture: ${path}`)
    return null
  }
  let data
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${prefix}${cell.suffix}: unreadable JSON (${error.message})`)
    return null
  }
  if (data.brush !== 'bristle-round') {
    fail(`${prefix}${cell.suffix}: brush is "${data.brush}", expected "bristle-round"`)
    return null
  }
  const census = data.endCensus
  if (!census || !(num(census.taps) > 0) || !Array.isArray(census.last40) || census.last40.length === 0) {
    fail(`${prefix}${cell.suffix}: empty end census (taps ${JSON.stringify(census?.taps)})`)
    return null
  }
  if (census.drive !== cell.drive) {
    fail(`${prefix}${cell.suffix}: drive is "${census.drive}", expected "${cell.drive}"`)
    return null
  }
  const metrics = data.endMetrics
  if (!metrics || !metrics.endPreGap) {
    fail(`${prefix}${cell.suffix}: no endMetrics.endPreGap readout`)
    return null
  }
  const gap = detectGap(metrics.endPreGap)
  if (gap === null) {
    fail(`${prefix}${cell.suffix}: endPreGap profile/bodyLevel/stationPx missing`)
    return null
  }
  return {
    ...gap,
    brush: data.brush,
    drive: census.drive,
    bodyLevel: metrics.endPreGap.bodyLevel,
    stationCount: metrics.endPreGap.stationCount,
    windowHi: metrics.endPreGap.windowHi,
    emittedLargestRunPx: metrics.endPreGap.largestRunPx,
    emittedMaxDepth: metrics.endPreGap.maxDepth,
  }
}

// --- the pre set ------------------------------------------------------------

const preRows = []
for (const cell of GAP_CELLS) {
  const row = readCapture(preDir, PRE_PREFIX, cell)
  if (row !== null) preRows.push({ cell, row })
}

const header = [
  'cell'.padEnd(28),
  'drive'.padEnd(6),
  'runPx'.padStart(5),
  'depth'.padStart(7),
  'atPx'.padStart(6),
  'band'.padStart(5),
  'body'.padStart(6),
  'n'.padStart(4),
  'winHi'.padStart(6),
]
console.log('=== PRE gap table (' + PRE_PREFIX + '*) ===')
console.log(header.join(' '))
for (const { cell, row } of preRows) {
  console.log(
    [
      (`${cell.suffix}`).padEnd(28),
      String(row.drive).padEnd(6),
      String(row.largestRunPx).padStart(5),
      fixed(row.maxDepth).padStart(7),
      String(row.atPx).padStart(6),
      (row.detected ? 'YES' : '-').padStart(5),
      fixed(row.bodyLevel).padStart(6),
      String(row.stationCount).padStart(4),
      fixed(row.windowHi, 0).padStart(6),
    ].join(' '),
  )
}
console.log(
  `pre: ${GAP_CELLS.length} cells expected, ${preRows.length} read; ` +
    `detected bands: ${preRows.filter(({ row }) => row.detected).map(({ cell }) => cell.suffix).join(', ') || 'none'}`,
)

if (!assertMode) {
  if (failures.length > 0) {
    for (const failure of failures) console.error('FAIL: ' + failure)
    console.log(`RESULT: FAIL (${failures.length} capture-integrity failures)`)
    process.exit(1)
  }
  console.log('RESULT: PASS (pre report only; capture integrity holds)')
  process.exit(0)
}

// --- the post set (--assert) ------------------------------------------------

const postRows = []
for (const cell of GAP_CELLS) {
  const row = readCapture(postDir, POST_PREFIX, cell)
  if (row !== null) postRows.push({ cell, row })
}

console.log()
console.log('=== POST gap table (' + POST_PREFIX + '*) ===')
console.log(header.join(' '))
for (const { cell, row } of postRows) {
  console.log(
    [
      (`${cell.suffix}`).padEnd(28),
      String(row.drive).padEnd(6),
      String(row.largestRunPx).padStart(5),
      fixed(row.maxDepth).padStart(7),
      String(row.atPx).padStart(6),
      (row.detected ? 'YES' : '-').padStart(5),
      fixed(row.bodyLevel).padStart(6),
      String(row.stationCount).padStart(4),
      fixed(row.windowHi, 0).padStart(6),
    ].join(' '),
  )
}

// The detector must be proven ALIVE on the pre set at the artist's sizes.
const alive = preRows.some(
  ({ cell, row }) => (cell.size === '400' || cell.size === '600') && row.detected,
)
if (!alive) {
  fail('no detected pre band at 400 or 600 — the detector is dead on the RED set')
}
// Every post cell must read no band anywhere.
for (const { cell, row } of postRows) {
  if (row.detected) {
    fail(
      `post ${cell.suffix}: enclosed pale band ${row.largestRunPx} px deep ${fixed(row.maxDepth)} at ${row.atPx} px`,
    )
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error('FAIL: ' + failure)
  console.log(`RESULT: FAIL (${failures.length} failures)`)
  process.exit(1)
}
console.log(
  `RESULT: PASS (${preRows.length} pre cells with a live detector; ${postRows.length} post cells with no enclosed band)`,
)
process.exit(0)

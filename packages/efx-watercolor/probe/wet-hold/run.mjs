#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the wet-hold readout (quick 261123-pee).
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage:
//    node probe/wet-hold/run.mjs --scene hold --label hold-hold
//    node probe/wet-hold/run.mjs --scene hold --dry --label hold-dry
//
//  Bundles probe.ts with esbuild, inlines it into a /tmp copy of index.html
//  and renders ONE page load through the real vendored WebGL2 engine in
//  headless Chrome. Writes the full readout to /tmp/wet-hold/<label>.json,
//  prints the compact report and asserts the scene's laws:
//
//    held (`--scene hold`): the idle reaches sleep; the sheet is still wet;
//      `exportSettledCanvas()` differs from the raw export in BOTH windows
//      and restores the sheet exactly (gate, wetPeak, undo depth); the second
//      acrylic stroke carries the SAME canvas colour the pre-idle control
//      carried (the pickup-retained law).
//    dry (`--dry`): the explicit fix closes the gate, zeroes wetPeak, lifts the
//      hold and pushes exactly ONE undo step (the positive control for the
//      depth read). The pickup does NOT vanish: the carrier's gate is the
//      last-touch field and the stroke's own touch pass re-stamps the texels it
//      crosses with `uNow`, so a different colour always lifts (measured;
//      see probe.ts's header). The cross check reads the held run's JSON and
//      proves the depth relation and the shared carried canvas colour.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/wet-hold'
const bundlePath = join(outDir, 'probe.bundle.js')
const pagePath = join(outDir, 'page.html')

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function fail(message) {
  console.error(`[wet-hold] ${message}`)
  process.exit(1)
}

const esbuildCandidates = [
  join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
  join(repoRoot, 'node_modules/.bin/esbuild'),
]
const esbuild = esbuildCandidates.find((path) => existsSync(path))
if (!esbuild) fail('esbuild not found; candidates:\n  ' + esbuildCandidates.join('\n  '))

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) fail('Chrome/Chromium not found; candidates:\n  ' + chromeCandidates.join('\n  '))

const label = flag('--label')
if (!label) {
  fail('usage: node run.mjs --scene hold [--dry] --label <name> [--size <px>]')
}
const sceneRaw = flag('--scene') ?? 'hold'
if (sceneRaw !== 'hold') fail(`invalid --scene "${sceneRaw}" (this build implements "hold" only)`)
const dry = args.includes('--dry')
const sizeRaw = flag('--size')
const blueSize = sizeRaw === undefined ? 17 : Number(sizeRaw)
if (!Number.isInteger(blueSize) || blueSize < 1 || blueSize > 800) {
  fail(`invalid --size "${sizeRaw}"`)
}
/** The held run a `--dry` control compares its undo depth against. */
const compareLabel = flag('--compare') ?? 'hold-hold'

// ---------------------------------------------------------------------------
//  Scene laws. Calibrated from the measured readouts (the numbers in the
//  report), never from a claim that the measurement did not show.
// ---------------------------------------------------------------------------

/**
 * The held run's post-idle stroke must carry the SAME canvas colour the
 * pre-idle control carried, within this many degrees. Comparing carried hues
 * (canvas-to-canvas) is colour-agnostic: a drag measured against each
 * stroke's own pigment cannot be compared across two different pigments
 * (the second stroke's yellow sits only ~22 deg from the canvas, so a FULL
 * pickup reads 22 deg while the blue control's full pickup reads 142 deg).
 */
const HELD_PICKUP_MAX_DELTA_DEG = 5
/** The held run's carried hue must also clear this many degrees from the stroke's OWN hue (a pickup happened at all). */
const HELD_PICKUP_MIN_DEG = 5

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function buildBundle() {
  mkdirSync(outDir, { recursive: true })
  const build = spawnSync(
    esbuild,
    [
      join(here, 'probe.ts'),
      '--bundle',
      '--format=iife',
      '--platform=browser',
      '--target=es2022',
      '--log-level=warning',
      `--outfile=${bundlePath}`,
    ],
    { encoding: 'utf8' },
  )
  if (build.status !== 0) fail(build.stderr || build.stdout || 'esbuild failed')
  if (build.stderr.trim()) console.error(build.stderr.trim())
  const template = readFileSync(join(here, 'index.html'), 'utf8')
  const bundle = readFileSync(bundlePath, 'utf8')
  if (!template.includes('<!--WH-BUNDLE-->')) fail('index.html lost its <!--WH-BUNDLE--> placeholder')
  writeFileSync(pagePath, template.replace('<!--WH-BUNDLE-->', `<script>\n${bundle}\n</script>`))
}

function runPage() {
  const query = `scene=${sceneRaw}&dry=${dry ? 1 : 0}&size=${blueSize}`
  const run = spawnSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--window-size=900,700',
      '--allow-file-access-from-files',
      '--dump-dom',
      `file://${pagePath}?${query}`,
    ],
    { encoding: 'utf8', timeout: 600000, maxBuffer: 256 * 1024 * 1024 },
  )
  if (run.error) fail(`Chrome failed: ${run.error.message}`)
  const dom = run.stdout ?? ''
  const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
  if (!match || match[1].trim().length === 0) {
    writeFileSync(join(outDir, `dom-${label}.html`), dom)
    fail(`no result element (DOM saved to ${join(outDir, `dom-${label}.html`)})`)
  }
  let result
  try {
    result = JSON.parse(unescapeHtml(match[1]))
  } catch (error) {
    writeFileSync(join(outDir, `dom-${label}.html`), dom)
    fail(`result JSON parse failed: ${error.message}`)
  }
  if (result.verdict !== 'WET-HOLD CAPTURED') {
    fail(`page failed: ${result.verdict ?? '(no verdict)'}${result.error ? ` — ${result.error}` : ''}`)
  }
  return result
}

// ---------------------------------------------------------------------------
//  Assertions
// ---------------------------------------------------------------------------

const failures = []
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failures.push(`${name}${detail === undefined ? '' : ` — ${detail}`}`)
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Shortest circular distance between two hue angles, degrees. */
function hueDelta(a, b) {
  if (num(a) === null || num(b) === null) return null
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function assertSettledProof(where, p, wetBefore, peakBefore, depthBefore) {
  check(`${where}.differ`, p.differ === true, `raw ${p.rawDigest} vs settled ${p.settledDigest}`)
  check(`${where}.restoredExactly`, p.restoredExactly === true, `raw ${p.rawDigest} vs rawAfter ${p.rawAfterDigest}`)
  check(
    `${where}.hasStandingWater unchanged`,
    p.hasStandingWaterBefore === wetBefore && p.hasStandingWaterAfter === wetBefore,
    `before ${p.hasStandingWaterBefore} after ${p.hasStandingWaterAfter} (expected ${wetBefore})`,
  )
  check(
    `${where}.wetPeak unchanged`,
    p.wetPeakAfter === p.wetPeakBefore && (peakBefore === undefined || p.wetPeakBefore === peakBefore),
    `before ${p.wetPeakBefore} after ${p.wetPeakAfter}`,
  )
  check(
    `${where}.depth unchanged`,
    p.depthAfter === p.depthBefore && (depthBefore === undefined || p.depthBefore === depthBefore),
    `before ${p.depthBefore} after ${p.depthAfter}`,
  )
}

function assertCaptureSettle(result) {
  const c = result.captureSettle
  check('captureSettle.called', c.called === true)
  check('captureSettle.depth unchanged', c.depthAfter === c.depthBefore, `${c.depthBefore} -> ${c.depthAfter}`)
  check('captureSettle.gate closed', c.hasStandingWater === false)
  check('captureSettle.wetPeak zero', c.wetPeak === 0, String(c.wetPeak))
  check(
    'captureSettle.tick bound',
    c.ticks > 0 && c.ticks <= result.config.maxFixTicks,
    `${c.ticks} ticks (bound ${result.config.maxFixTicks})`,
  )
}

// ---------------------------------------------------------------------------
//  Report
// ---------------------------------------------------------------------------

const f = (v, digits = 3) => (num(v) === null ? 'n/a' : v.toFixed(digits))
const pf = (v) => (num(v) === null ? 'n/a' : (v * 100).toFixed(1) + '%')

function reportHeld(result) {
  const c = result.control
  const s = result.second
  console.log(`\n[wet-hold] ${label}: scene hold, arm held, blue ${result.config.blueSize} / band ${result.config.bandSize}, ` +
    `${result.config.sheetW}x${result.config.sheetH}, renderer ${result.renderer}`)
  console.log(
    `control  | depth ${c.depth}, wet ${c.hasStandingWater}, peak ${f(c.wetPeak, 4)} | ` +
      `blue hue ${f(c.ownHueDeg, 1)} | pickup ${f(c.carried.loadedHueDeg, 1)} drag ${f(c.pickupDragDeg, 1)} | ` +
      `centre ${f(c.carried.centreHueDeg, 1)} drag ${f(c.centreDragDeg, 1)} | film ${f(c.filmHueDeg, 1)} over ${c.filmTexels} texels`,
  )
  console.log(
    `idle     | ${result.idle.ticks} ticks (${f(result.idle.engineMs, 1)} ms engine), ` +
      `awake ${result.idle.startedAwake} -> asleep ${result.idle.asleep}`,
  )
  const p = result.postSleep
  console.log(
    `post     | awake ${p.isAwake}, wet ${p.hasStandingWater}, peak ${f(p.wetPeak, 4)}, ` +
      `stroke null ${p.strokeNull}, active null ${p.activeNull}`,
  )
  const a = result.settledAsleep
  console.log(
    `settled1 | raw ${a.rawDigest} settled ${a.settledDigest} rawAfter ${a.rawAfterDigest} | ` +
      `differ ${a.differ} restored ${a.restoredExactly} | wet ${a.hasStandingWaterBefore} -> ${a.hasStandingWaterAfter} ` +
      `peak ${f(a.wetPeakBefore, 5)} -> ${f(a.wetPeakAfter, 5)} depth ${a.depthBefore} -> ${a.depthAfter}`,
  )
  console.log(
    `second   | yellow depth ${s.depthBefore} -> ${s.depthAfter}, wet ${s.hasStandingWaterBefore} -> ${s.hasStandingWaterAfter}, ` +
      `stroke null ${s.strokeNull}, active ${s.activeNonNull} | hue ${f(s.ownHueDeg, 1)} | ` +
      `pickup ${f(s.carried.loadedHueDeg, 1)} drag ${f(s.pickupDragDeg, 1)} | centre ${f(s.carried.centreHueDeg, 1)} drag ${f(s.centreDragDeg, 1)} | ` +
      `film ${f(s.filmHueDeg, 1)}`,
  )
  const b = result.settledAwake
  console.log(
    `settled2 | raw ${b.rawDigest} settled ${b.settledDigest} rawAfter ${b.rawAfterDigest} | ` +
      `differ ${b.differ} restored ${b.restoredExactly} | wet ${b.hasStandingWaterBefore} -> ${b.hasStandingWaterAfter} ` +
      `peak ${f(b.wetPeakBefore, 5)} -> ${f(b.wetPeakAfter, 5)} depth ${b.depthBefore} -> ${b.depthAfter}`,
  )
  const cs = result.captureSettle
  console.log(
    `capture  | settleForCapture ${cs.called}, ${cs.ticks} ticks, depth ${cs.depthBefore} -> ${cs.depthAfter}, ` +
      `wet ${cs.hasStandingWater}, peak ${f(cs.wetPeak, 5)}`,
  )
}

function reportDry(result) {
  const c = result.control
  const s = result.second
  console.log(`\n[wet-hold] ${label}: scene hold, arm dry (the explicit fix control), blue ${result.config.blueSize}, ` +
    `renderer ${result.renderer}, evictions ${result.evictions}`)
  console.log(
    `control  | depth ${c.depth}, wet ${c.hasStandingWater}, peak ${f(c.wetPeak, 4)} | ` +
      `pickup drag ${f(c.pickupDragDeg, 1)} | centre drag ${f(c.centreDragDeg, 1)}`,
  )
  const x = result.fix
  console.log(
    `fix      | applied ${x.applied}, ${x.fixTicks} ticks, depth ${x.depthBeforeFix} -> ${x.depthAfterFix}, ` +
      `wet ${x.hasStandingWaterAfterFix}, peak ${f(x.wetPeakAfterFix, 5)}, hold after ${x.holdAfterFix}`,
  )
  console.log(
    `second   | yellow depth ${s.depthBefore} -> ${s.depthAfter}, wet ${s.hasStandingWaterBefore} -> ${s.hasStandingWaterAfter} | ` +
      `hue ${f(s.ownHueDeg, 1)} | pickup ${f(s.carried.loadedHueDeg, 1)} drag ${f(s.pickupDragDeg, 1)} | ` +
      `centre ${f(s.carried.centreHueDeg, 1)} drag ${f(s.centreDragDeg, 1)} | film ${f(s.filmHueDeg, 1)}`,
  )
  const cs = result.captureSettle
  console.log(
    `capture  | settleForCapture ${cs.called}, ${cs.ticks} ticks, depth ${cs.depthBefore} -> ${cs.depthAfter}, ` +
      `wet ${cs.hasStandingWater}, peak ${f(cs.wetPeak, 5)}`,
  )
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

buildBundle()
const result = runPage()
const outPath = join(outDir, `${label}.json`)
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')

console.log(`\n[wet-hold] ${label}: assertions`)
if (result.arm === 'held') {
  reportHeld(result)
  check('evictions 0 (the depth reads are meaningful)', result.evictions === 0, String(result.evictions))
  check('stepRecording on', result.stepRecording === true)
  const idle = result.idle
  check('idle.startedAwake', idle.startedAwake === true)
  check('idle.asleep (the awake -> asleep transition)', idle.awakeToAsleep === true && idle.asleep === true)
  const post = result.postSleep
  check('postSleep.strokeNull', post.strokeNull === true)
  check('postSleep.hasStandingWater (held past sleep)', post.hasStandingWater === true)
  check(
    'postSleep.wetPeak > WET_THRESHOLD',
    num(post.wetPeak) !== null && post.wetPeak > result.config.wetThreshold,
    `${post.wetPeak} vs ${result.config.wetThreshold}`,
  )
  assertSettledProof('settledAsleep', result.settledAsleep, true, post.wetPeak, result.control.depth)
  const s = result.second
  check('second.strokeNull', s.strokeNull === true)
  check('second.activeNonNull (the awake window)', s.activeNonNull === true)
  check('second.hasStandingWaterBefore', s.hasStandingWaterBefore === true)
  check('second.hasStandingWaterAfter', s.hasStandingWaterAfter === true)
  check('second.depth +1 (a stroke is a step)', s.depthAfter === s.depthBefore + 1, `${s.depthBefore} -> ${s.depthAfter}`)
  assertSettledProof('settledAwake', result.settledAwake, true, result.settledAsleep.wetPeakAfter, s.depthAfter)
  const retainedDelta = hueDelta(s.carried.loadedHueDeg, result.control.carried.loadedHueDeg)
  check(
    'second pickup retained at the control level (same carried canvas colour)',
    retainedDelta !== null && retainedDelta <= HELD_PICKUP_MAX_DELTA_DEG,
    `carried ${s.carried.loadedHueDeg} vs control ${result.control.carried.loadedHueDeg} (delta ${retainedDelta}, max ${HELD_PICKUP_MAX_DELTA_DEG})`,
  )
  check(
    'second pickup moved off its own hue',
    num(s.pickupDragDeg) !== null && s.pickupDragDeg >= HELD_PICKUP_MIN_DEG,
    `${s.pickupDragDeg} deg (min ${HELD_PICKUP_MIN_DEG})`,
  )
  assertCaptureSettle(result)
} else {
  reportDry(result)
  // No eviction gate here: the Dry is the FOURTH step and its tile set exceeds
  // pool 0's two document budget, so the oldest step is evicted during the
  // second stroke (measured evictions 1, depth 3 -> 3). Every depth this arm
  // asserts is read BEFORE that stroke, and the cross-run check below holds
  // them to the held run's values, so an early eviction cannot pass silently.
  check('stepRecording on', result.stepRecording === true)
  const x = result.fix
  check('fix.applied', x.applied === true)
  check('fix.depth +1 (the explicit Dry is a real step)', x.depthAfterFix === x.depthBeforeFix + 1, `${x.depthBeforeFix} -> ${x.depthAfterFix}`)
  check('fix.gate closed', x.hasStandingWaterAfterFix === false)
  check('fix.wetPeak zero', x.wetPeakAfterFix === 0, String(x.wetPeakAfterFix))
  check('fix.lifted the hold', x.holdAfterFix === false)
  const s = result.second
  check('second.gate closed before the stroke', s.hasStandingWaterBefore === false)
  // MEASURED LAW, not the plan's assumption: the Dry does NOT kill the pickup.
  // The carrier's gate reads the last-touch field, and the stroke's own touch
  // pass re-stamps the texels it crosses with `uNow`, so any different colour
  // lifts — held or dried, identically (22.27 vs 22.73 deg measured).
  const dryRetainedDelta = hueDelta(s.carried.loadedHueDeg, result.control.carried.loadedHueDeg)
  check(
    'second carries the canvas colour (measured: the Dry does not kill a different-colour lift)',
    dryRetainedDelta !== null && dryRetainedDelta <= HELD_PICKUP_MAX_DELTA_DEG,
    `carried ${s.carried.loadedHueDeg} vs control ${result.control.carried.loadedHueDeg} (delta ${dryRetainedDelta}, max ${HELD_PICKUP_MAX_DELTA_DEG})`,
  )
  assertCaptureSettle(result)
  // The positive control proves the depth read detects a real step: the dry
  // run's post-fix depth is ONE greater than the held run's before-fix depth.
  const heldPath = join(outDir, `${compareLabel}.json`)
  if (!existsSync(heldPath)) {
    failures.push(`cross-run: held run JSON missing at ${heldPath} (run --scene hold --label ${compareLabel} first)`)
    console.log(`  FAIL cross-run — no ${heldPath}`)
  } else {
    const held = JSON.parse(readFileSync(heldPath, 'utf8'))
    const heldBeforeFix = held.control?.depth
    check(
      'cross-run: held control depth matches',
      heldBeforeFix === x.depthBeforeFix,
      `held ${heldBeforeFix} vs dry ${x.depthBeforeFix}`,
    )
    check(
      'cross-run: dry depthAfterFix === held before-fix depth + 1',
      x.depthAfterFix === heldBeforeFix + 1,
      `held ${heldBeforeFix} + 1 vs dry ${x.depthAfterFix}`,
    )
    // Measured law (refutes the plan's "an explicit fix kills that pickup"):
    // the carrier's lift is COLOUR-gated, not age-gated — its own touch pass
    // re-stamps the texels the stroke crosses. Both arms carry the same canvas.
    const heldVsDry = hueDelta(held.second?.carried?.loadedHueDeg, s.carried.loadedHueDeg)
    check(
      'cross-run: held and dry carry the same canvas colour (pickup is colour-gated, not age-gated)',
      heldVsDry !== null && heldVsDry <= HELD_PICKUP_MAX_DELTA_DEG,
      `held ${held.second?.carried?.loadedHueDeg} vs dry ${s.carried.loadedHueDeg} (delta ${heldVsDry}, max ${HELD_PICKUP_MAX_DELTA_DEG})`,
    )
  }
}

console.log(`\n[wet-hold] wrote ${outPath}`)
if (failures.length > 0) {
  console.error(`\n[wet-hold] ${failures.length} assertion(s) failed:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('[wet-hold] all assertions passed')

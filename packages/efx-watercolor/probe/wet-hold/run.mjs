#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the wet-hold readout (quick 261123-pee).
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage:
//    node probe/wet-hold/run.mjs --scene hold --label hold-hold
//    node probe/wet-hold/run.mjs --scene hold --holdoff --label hold-nohold
//    node probe/wet-hold/run.mjs --scene hold --dry --label hold-dry
//    node probe/wet-hold/run.mjs --scene bake --label bake --compare hold-hold
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
//      261123-vkb cap + freeze: the awake window after the last wet input is
//      bounded at the visible settle cap — `idle.windowTicks ===
//      config.capTicks === 30` at dry 100, measured to the LAST AWAKE
//      observation (never the loop-exit clock, which the sleep-detection tick
//      would push one high). `frozen` / `frozenAfter` bracket a +30 s clock
//      advance on the asleep sheet: the same raw canvas digest and the same
//      SEVEN paint-layer digests (`lastTouch` excluded — it stores ages, so it
//      cannot be stable), gate open, peak unchanged, `active` null.
//    hold-off (`--holdoff`): `setHoldWet(false)` before the walk, never
//      re-armed — the UNHELD sim, which keeps decaying the wet field and
//      therefore sleeps at its own trim/sleep window: 211 ticks measured
//      (deterministic, repeated), NOT the 237-tick HELD pre-change baseline
//      the plan expected (the hold bypasses decay; a different setup).
//      `idle.windowTicks` equals `idle.ticks` under the same last-awake
//      measure, and the unheld sleep zeroes `wetPeak` and closes the gate.
//    dry (`--dry`): the explicit fix closes the gate, zeroes wetPeak, lifts the
//      hold and pushes exactly ONE undo step (the positive control for the
//      depth read). The pickup does NOT vanish: the carrier's gate is the
//      last-touch field and the stroke's own touch pass re-stamps the texels it
//      crosses with `uNow`, so a different colour always lifts (measured;
//      see probe.ts's header). The cross check reads the held run's JSON and
//      proves the depth relation and the shared carried canvas colour.
//    bake (`--scene bake`): ONE recorded session baked twice through the real
//      `createAquarelleBake` with `frameCount: 1` — `settle: 'wet'` on a
//      hold-adapter (recorded Dry filtered out) vs `settle: 'dry'` on the
//      default adapter. The wet sheet keeps `wetPeak > WET_THRESHOLD` with
//      ZERO settle ticks; the dry sheet force-dried to zero after exactly 72
//      settle ticks; the ink-layer digests differ. A third `wetSession` arm
//      bakes the SAME two strokes the held scene applied (`settle: 'wet'`,
//      hold adapter): its `settleTicks` 0 and `wetPeak > WET_THRESHOLD` are
//      GATED, while its paint-layer digests and resolved begin ticks are
//      printed as a `parity: reported` line against the held run's `frozen`
//      sheet — REPORTED, never asserted (the adapter's per-sample tick law and
//      `buildRecordedTimeline`'s `previousEnd` clamp make exact equality
//      unprovable; a mismatch is a readout finding).
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
  fail('usage: node run.mjs --scene hold [--dry|--holdoff] --label <name> [--size <px>]')
}
const sceneRaw = flag('--scene') ?? 'hold'
if (sceneRaw !== 'hold' && sceneRaw !== 'bake') {
  fail(`invalid --scene "${sceneRaw}" (this build implements "hold" and "bake")`)
}
const dry = args.includes('--dry')
/** 261123-vkb: the hold-off control — the natural awake window. */
const holdoff = args.includes('--holdoff')
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
/**
 * 261123-vkb: the UNHELD sim's natural awake window at this scene's lens, walk
 * count under the last-awake measure. MEASURED, deterministic (two repeat
 * runs), and a documented DEVIATION from the plan's 237: 237 is the HELD
 * pre-change baseline (/tmp/wet-hold/hold-hold.pre-vkb.json) — the hold
 * bypasses decay, while the unheld sim keeps decaying the wet FIELD and its
 * trim/sleep path fires early at 211 ticks. The entry natural `wetUntil` bound
 * (≈ 4255.5 ms) is reported beside it, un-reached. A drift is a measurement
 * finding, never a range to widen silently.
 */
const NATURAL_HOLDOFF_WINDOW_TICKS = 211
/** The freeze proof's digest set — the same seven paint layers probe.ts reads. */
const PAINT_LAYER_IDS = ['inkA', 'inkB', 'fixedA', 'fixedB', 'wet', 'relief', 'cover']

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
  const query = `scene=${sceneRaw}&dry=${dry ? 1 : 0}&holdoff=${holdoff ? 1 : 0}&size=${blueSize}`
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
  console.log(
    `window   | ${result.idle.windowTicks} ticks from lastWet ${f(result.idle.lastWetMs, 1)} ms ` +
      `(cap ${result.config.capTicks}) | natural wetUntil ${f(result.idle.wetUntilMs, 1)} ms`,
  )
  const p = result.postSleep
  console.log(
    `post     | awake ${p.isAwake}, wet ${p.hasStandingWater}, peak ${f(p.wetPeak, 4)}, ` +
      `stroke null ${p.strokeNull}, active null ${p.activeNull}`,
  )
  const fr = result.frozen
  const fa = result.frozenAfter
  console.log(
    `freeze   | raw ${fr.rawDigest} -> ${fa.rawDigest} | layers ${Object.keys(fr.layers).length} ` +
      `identical ${JSON.stringify(fr.layers) === JSON.stringify(fa.layers)} | ` +
      `peak ${f(fr.wetPeak, 5)} -> ${f(fa.wetPeak, 5)}, wet ${fa.hasStandingWater}, awake ${fa.isAwake}, active null ${fa.activeNull}`,
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

function reportHeldoff(result) {
  const c = result.control
  const idle = result.idle
  const p = result.postSleep
  console.log(`\n[wet-hold] ${label}: scene hold, arm hold-off (the natural-window control), blue ${result.config.blueSize}, ` +
    `renderer ${result.renderer}, evictions ${result.evictions}`)
  console.log(
    `control  | depth ${c.depth}, wet ${c.hasStandingWater}, peak ${f(c.wetPeak, 4)} | ` +
      `pickup drag ${f(c.pickupDragDeg, 1)} | centre drag ${f(c.centreDragDeg, 1)}`,
  )
  console.log(
    `idle     | ${idle.ticks} ticks (${f(idle.engineMs, 1)} ms engine), window ${idle.windowTicks} ticks ` +
      `from lastWet ${f(idle.lastWetMs, 1)} ms to wetUntil ${f(idle.wetUntilMs, 1)} ms | ` +
      `awake ${idle.startedAwake} -> asleep ${idle.asleep}`,
  )
  console.log(
    `post     | awake ${p.isAwake}, wet ${p.hasStandingWater}, peak ${f(p.wetPeak, 4)}, ` +
      `stroke null ${p.strokeNull}, active null ${p.activeNull}`,
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

function layerText(layers, id) {
  const layer = layers?.[id]
  return layer === undefined ? 'n/a' : `${f(layer.sum, 3)}/${layer.nonZero}`
}

function reportBake(result) {
  console.log(`\n[wet-hold] ${label}: scene bake, ${result.config.sheetW}x${result.config.sheetH}, renderer ${result.renderer}`)
  for (const arm of [result.wet, result.dry]) {
    console.log(
      `bake ${arm.settle.padEnd(3)} | ${arm.ok} path ${arm.path} settleTicks ${arm.settleTicks} | ` +
        `events ${arm.eventCount} (strokes ${arm.strokeCount}) frames ${arm.frames} bytes ${arm.byteLength} | ` +
        `wetPeak ${f(arm.wetPeak, 5)} wetAgo ${arm.wetAgo === null ? 'null' : f(arm.wetAgo, 4)} bristle ${arm.bristleContent}`,
    )
    console.log(
      `           | inkA ${layerText(arm.layers, 'inkA')} inkB ${layerText(arm.layers, 'inkB')} ` +
        `fixedA ${layerText(arm.layers, 'fixedA')} wet ${layerText(arm.layers, 'wet')} ` +
        `cover ${layerText(arm.layers, 'cover')} lastTouch ${layerText(arm.layers, 'lastTouch')}`,
    )
  }
  const w = result.wetSession
  if (w !== undefined && w !== null) {
    console.log(
      `bake wetS | ${w.ok} path ${w.path} settleTicks ${w.settleTicks} | events ${w.eventCount} frames ${w.frames} ` +
        `bytes ${w.byteLength} | wetPeak ${f(w.wetPeak, 5)} bristle ${w.bristleContent} | ` +
        `recordedOrder ${JSON.stringify(w.recordedOrder)} ticks ${JSON.stringify(w.ticks)} ` +
        `begin ${JSON.stringify(w.beginTicks)} end ${JSON.stringify(w.endTicks)}`,
    )
  }
}

/**
 * 261123-vkb: the NON-GATING live-versus-bake diagnostic. Reads the held run's
 * `frozen` sheet (the same `lastTouch`-free paint-layer read) and prints it
 * beside `wetSession`'s digests and both sides' resolved begin ticks. This
 * NEVER asserts: the adapter burns one clock tick per sample plus one trailing
 * tick and `buildRecordedTimeline` clamps `beginTick` to `previousEnd`, so exact
 * equality is unprovable. A divergence is a readout finding, not a failure.
 */
function reportParity(result) {
  const session = result.wetSession
  const heldPath = join(outDir, `${compareLabel}.json`)
  const bakeBegins = JSON.stringify(session?.beginTicks ?? null)
  if (!existsSync(heldPath)) {
    console.log(`parity: reported (no held run at ${heldPath}) — begin ticks live n/a vs bake ${bakeBegins}`)
    return
  }
  let held = null
  try {
    held = JSON.parse(readFileSync(heldPath, 'utf8'))
  } catch {
    held = null
  }
  const live = held?.frozen?.layers ?? null
  const bake = session?.layers ?? null
  console.log('parity: reported (never gated — a mismatch is a readout finding, not a failure)')
  console.log(
    `         | begin ticks live ${JSON.stringify(held?.liveBegins ?? null)} vs bake ${bakeBegins} | ` +
      `recordedOrder bake ${JSON.stringify(session?.recordedOrder ?? null)} ticks ${JSON.stringify(session?.ticks ?? null)}`,
  )
  if (!live || !bake) {
    console.log('         | paint-layer digests n/a (missing the frozen/layers read on one side)')
    return
  }
  console.log(`         | paint-layer digests equal ${JSON.stringify(live) === JSON.stringify(bake)}`)
  for (const id of Object.keys(live)) {
    console.log(`         | ${id} live ${layerText(live, id)} bake ${layerText(bake, id)}`)
  }
}

function assertBake(result) {
  check('bake scene recorded the timed path (wet)', result.wet.path === 'timed', String(result.wet.path))
  check('bake scene recorded the timed path (dry)', result.dry.path === 'timed', String(result.dry.path))
  check('wet strokeCount 3 (the Dry is filtered)', result.wet.strokeCount === 3 && result.wet.eventCount === 3,
    `strokes ${result.wet.strokeCount}, events ${result.wet.eventCount}`)
  check('dry strokeCount 3 + the recorded Dry', result.dry.strokeCount === 3 && result.dry.eventCount === 4,
    `strokes ${result.dry.strokeCount}, events ${result.dry.eventCount}`)
  check('wet one frame', result.wet.frames === 1 && result.wet.byteLength > 0, `${result.wet.frames} frames, ${result.wet.byteLength} bytes`)
  check('dry one frame', result.dry.frames === 1 && result.dry.byteLength > 0, `${result.dry.frames} frames, ${result.dry.byteLength} bytes`)
  check(
    'wet.wetPeak > WET_THRESHOLD (the baked sheet keeps mobile water)',
    num(result.wet.wetPeak) !== null && result.wet.wetPeak > result.config.wetThreshold,
    `${result.wet.wetPeak} vs ${result.config.wetThreshold}`,
  )
  check('wet.settleTicks 0 (no end settle)', result.wet.settleTicks === 0, String(result.wet.settleTicks))
  check('dry.wetPeak 0 (the bake force-dried)', result.dry.wetPeak === 0, String(result.dry.wetPeak))
  check(
    'dry.settleTicks 72 (the forced-fix window)',
    result.dry.settleTicks === result.config.settleTicks,
    `${result.dry.settleTicks} vs ${result.config.settleTicks}`,
  )
  for (const id of ['inkA', 'inkB']) {
    const wet = result.wet.layers?.[id]
    const dry = result.dry.layers?.[id]
    check(
      `${id} digest differs between the arms`,
      wet !== undefined && dry !== undefined && (wet.sum !== dry.sum || wet.nonZero !== dry.nonZero),
      `wet ${layerText(result.wet.layers, id)} vs dry ${layerText(result.dry.layers, id)}`,
    )
  }
  check('wet.bristleContent (the acrylic stroke reached the carrier)', result.wet.bristleContent === true)
  check('dry.bristleContent (the acrylic stroke reached the carrier)', result.dry.bristleContent === true)
  // 261123-vkb: the same-session wet arm's GATED laws — only the settle law.
  // The live-versus-bake digests and begin ticks are reportParity's, never here.
  const w = result.wetSession
  check('wetSession.settleTicks 0 (no end settle)', w.settleTicks === 0, String(w.settleTicks))
  check(
    'wetSession.wetPeak > WET_THRESHOLD (the baked sheet keeps mobile water)',
    num(w.wetPeak) !== null && w.wetPeak > result.config.wetThreshold,
    `${w.wetPeak} vs ${result.config.wetThreshold}`,
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
if (result.arm === 'bake') {
  reportBake(result)
  assertBake(result)
  reportParity(result)
} else if (result.arm === 'heldoff') {
  reportHeldoff(result)
  check('stepRecording on', result.stepRecording === true)
  const idle = result.idle
  check('holdoff idle.startedAwake', idle.startedAwake === true)
  check('holdoff idle.asleep (the natural window ends)', idle.awakeToAsleep === true && idle.asleep === true)
  // DEVIATION (measured, documented): the plan expected 237 — the HELD
  // pre-change baseline. The unheld sim decays the wet field and sleeps at its
  // own trim window: 211 ticks, deterministic across two runs.
  check(
    'holdoff idle.ticks 211 (the measured unheld window — the plan\'s 237 was the held baseline)',
    idle.ticks === NATURAL_HOLDOFF_WINDOW_TICKS,
    `${idle.ticks} vs ${NATURAL_HOLDOFF_WINDOW_TICKS}`,
  )
  check(
    'holdoff idle.windowTicks === idle.ticks (the same last-awake measure)',
    idle.windowTicks === idle.ticks && idle.windowTicks === NATURAL_HOLDOFF_WINDOW_TICKS,
    `window ${idle.windowTicks} vs ticks ${idle.ticks} (expected ${NATURAL_HOLDOFF_WINDOW_TICKS})`,
  )
  const post = result.postSleep
  check('holdoff postSleep.gate closed (the unheld sleep zeroes the peak)', post.hasStandingWater === false)
  check('holdoff postSleep.wetPeak 0', post.wetPeak === 0, String(post.wetPeak))
  check('holdoff postSleep.activeNull', post.activeNull === true)
} else if (result.arm === 'held') {
  reportHeld(result)
  check('evictions 0 (the depth reads are meaningful)', result.evictions === 0, String(result.evictions))
  check('stepRecording on', result.stepRecording === true)
  const idle = result.idle
  check('idle.startedAwake', idle.startedAwake === true)
  check('idle.asleep (the awake -> asleep transition)', idle.awakeToAsleep === true && idle.asleep === true)
  // 261123-vkb cap + freeze.
  check(
    'cap window: idle.windowTicks === config.capTicks (the last-awake measure)',
    idle.windowTicks === result.config.capTicks,
    `window ${idle.windowTicks} vs cap ${result.config.capTicks}`,
  )
  check('cap window: capTicks 30 at dry 100', result.config.capTicks === 30, String(result.config.capTicks))
  const frozen = result.frozen
  const frozenAfter = result.frozenAfter
  check('frozen.isAwake false (the sim sleeps at the cap)', frozen.isAwake === false)
  check('frozen.activeNull (the cap sleep dropped the region)', frozen.activeNull === true)
  check('frozenAfter.isAwake false (still asleep after +30 s)', frozenAfter.isAwake === false)
  check('frozenAfter.hasStandingWater (held past the advance)', frozenAfter.hasStandingWater === true)
  check(
    'frozenAfter.wetPeak unchanged (no decay while frozen)',
    frozenAfter.wetPeak === frozen.wetPeak,
    `${frozen.wetPeak} vs ${frozenAfter.wetPeak}`,
  )
  check('frozenAfter.activeNull', frozenAfter.activeNull === true)
  check(
    'freeze: raw canvas digest identical after +30 s',
    frozen.rawDigest === frozenAfter.rawDigest,
    `${frozen.rawDigest} vs ${frozenAfter.rawDigest}`,
  )
  const frozenIds = Object.keys(frozen.layers).sort()
  const expectedIds = [...PAINT_LAYER_IDS].sort()
  check(
    'freeze: exactly the seven paint layers (lastTouch excluded — it stores ages)',
    frozenIds.length === expectedIds.length &&
      frozenIds.every((id, index) => id === expectedIds[index]) &&
      !('lastTouch' in frozen.layers),
    frozenIds.join(','),
  )
  const frozenLayersSame = JSON.stringify(frozen.layers) === JSON.stringify(frozenAfter.layers)
  check(
    'freeze: paint-layer digests identical after +30 s',
    frozenLayersSame,
    frozenLayersSame ? undefined : `frozen ${JSON.stringify(frozen.layers)} after ${JSON.stringify(frozenAfter.layers)}`,
  )
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

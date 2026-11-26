#!/usr/bin/env node
// Frozen acceptance bar for quick 261126-n20 (follow-up), ISSUE 2 — the hard
// dark line down the middle of a large Gouache bristle stroke ("one stroke in
// six" at the artist's sizes; the seeded dark fibre's centre run).
//
// FROZEN 2026-11-26 from the PRE-law capture matrix, BEFORE the law existed.
// DO NOT TUNE THIS BAR AFTER SEEING POST CAPTURES. The `--pre` mode makes that
// hard to do by accident: it re-reads the pre captures, asserts every number
// below matches them, re-derives the envelope from the Size 150 cells and
// asserts it equals ENVELOPE, and asserts the baseline FAILS the bar. Editing
// PRE to let a failing post cell pass would break both the provenance check
// and the derived-envelope check.
//
// THE BAR
// -------
// Size 150 is the largest footprint the artist accepts; its centre-ridge
// readings are the envelope the gated sizes (200/300/400/600) must not exceed.
// A larger stroke may read like the largest accepted one, never worse. The
// envelope is the MAXIMUM over the six seeds on the same instrument, per edge
// amount (ridge.ts: centre band 2 px vs the 4..20 px shoulder median):
//
//   Edge   0: peak 7.01/255, width  8 px   (Size 150, seed 5)
//   Edge  50: peak 10.51/255, width 16 px  (Size 150, seed 5 / seeds 4,6)
//   Edge 100: peak 15.99/255, width 24 px  (Size 150, seed 5)
//
// Evaluated on the seeded-dark cells: seeds 2 and 6 of 6. At the gated sizes
// the bristle count clamps to 256, so both seeds share one set across sizes;
// their centre-most fibre reads valueJitter 0.8530 / 0.8906 on the 1080 dumps
// (`n20c-ridge-line-s400-e0-m2/m6.json`), and the centre cluster is a 13- and
// a 21-bristle run. Seeds 1/3/4/5 read 1.0127 / 1.0234 / 1.0635 / 0.9565 —
// base runs, not dark ones.
//
// WHY THIS BAR: the measured pre matrix fails it at 14 seeded-dark cells
// (the seven groups below, each in both drive lanes), so the baseline does
// not already meet it:
//   Edge  0: s200 m2 7.01/16  (width 16 > 8)
//            s300 m2 7.50/21  (peak and width)
//            s400 m2 stop 8.49/6, bake 7.50/3  (peak)
//   Edge 50: s200 m6 8.49/24  (width)
//            s300 m2 stop 10.99/21, bake 11.50/21  (peak and width)
//            s400 m2 stop 11.50/21, bake 10.00/18  (peak and width)
//   Edge 100: s200 m6 14.00/25 (width 25 > 24)
// Every other seeded-dark cell passes; every gated non-seeded cell is also
// held to NO REGRESSION against PRE (peak + 0.5/255, width + 1 px), and every
// Size 150 cell is held to EXACT identity (the law gates below its 130.5 px
// half-width; the bristle data must be byte-identical there).
//
// The regression tolerance exists because the law darkens the far rim slightly
// while lifting the centre; the ridge shoulders (4..20 px) sit well inside the
// rim band, so the tolerance only absorbs the detector's rounding, not a real
// texture change. Size 150 must be exact, not merely within tolerance.
//
// WHY THE OLD 1/255 + share-0 BAR IS UNUSABLE HERE
// ------------------------------------------------
// compare.mjs's bristle-line bar (RIDGE_EXCESS_MAX = 1/255,
// RIDGE_ALONG_SHARE_MAX = 0, from 76e845ec3) rejects the ACCEPTED Size 150
// baseline itself: the line scene at Size 150 measures peak 0.0275 (7.01/255)
// with share 0.5417, and the art scene at Size 150 measures up to 10.51/255
// (Edge 50) and 15.99/255 (Edge 100) with 16 / 24 px widths. That bar asks
// "is there any ridge at all"; this defect is the size-dependent EXCESS over
// the accepted footprint, which is why the envelope is anchored at Size 150.
//
// MODES
//   node ridgeEnvelope.mjs --pre
//     Provenance + discrimination check over the pre captures in
//     /tmp/medium-engine (`n20c-ridge-art-*`). Exits 0 only when the captures
//     match PRE exactly, the derived envelope equals ENVELOPE, and PRE fails
//     the bar.
//   node ridgeEnvelope.mjs --post <prefix>
//     Evaluates `<prefix>*.json` (default dir /tmp/medium-engine). Requires
//     the complete 180-cell set: 144 gated (4 sizes x 3 edges x 2 lanes x 6
//     seeds) + 36 Size 150 identity cells. Exits 0 only when the seeded-dark
//     cells meet the envelope, no gated cell regresses, and every Size 150
//     cell is identical to PRE.
//
// The capture recipe is validated per file: scenario `bristle-end`, brush
// `bristle-round`, Dry 0, Feather 100, layer amount = the parsed edge, layer
// falloff 50, and the parsed drive lane. A mislabelled capture cannot pass.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_DIR = '/tmp/medium-engine'
const PRE_PREFIX = 'n20c-ridge-art-'
const LOCALE = 'en-US'

const EDGES = [0, 50, 100]
const LANES = ['stop', 'bake']
const GATED_SIZES = [200, 300, 400, 600]
const IDENTITY_SIZE = 150
const SEEDED_DARK = [2, 6]

/** The frozen envelope: peakExcess over 255 and ridgeWidthPx, per edge. */
export const ENVELOPE = Object.freeze({
  0: Object.freeze({ peak: 7.01, width: 8 }),
  50: Object.freeze({ peak: 10.51, width: 16 }),
  100: Object.freeze({ peak: 15.99, width: 24 }),
})

/** No-regression tolerance on the gated non-envelope cells. */
const REGRESS_PEAK = 0.5 // over 255
const REGRESS_WIDTH = 1 // px

// The PRE-law matrix, frozen 2026-11-26. p/w are seed 1..6 values: peakExcess
// x 255 rounded to 2 dp (the ridge readout's own precision) and ridgeWidthPx.
export const PRE = {
  150: {
    0: {
      stop: { p: [1.99, 1.99, 3.49, 4.49, 7.01, 6.5], w: [0, 0, 0, 0, 8, 8] },
      bake: { p: [1.99, 1.99, 3.49, 4.49, 7.01, 6.5], w: [0, 0, 0, 0, 8, 8] },
    },
    50: {
      stop: { p: [5, 5, 8.01, 9, 10.51, 10], w: [7, 3, 14, 16, 14, 16] },
      bake: { p: [5, 5, 8.01, 9, 10.51, 10], w: [7, 3, 14, 16, 14, 16] },
    },
    100: {
      stop: { p: [10.51, 9.51, 12.01, 13.49, 15.99, 14.99], w: [23, 19, 22, 24, 24, 20] },
      bake: { p: [10.51, 9.51, 12.01, 13.49, 15.99, 14.99], w: [23, 19, 22, 24, 24, 20] },
    },
  },
  200: {
    0: {
      stop: { p: [5.51, 7.01, 4.49, 4, 4.49, 4.49], w: [3, 16, 0, 0, 0, 8] },
      bake: { p: [5.51, 7.01, 4.49, 4, 4.49, 4.49], w: [3, 16, 0, 0, 0, 8] },
    },
    50: {
      stop: { p: [8.49, 10.51, 8.01, 7.5, 8.01, 8.49], w: [17, 16, 17, 13, 20, 24] },
      bake: { p: [8.49, 10.51, 8.01, 7.5, 8.01, 8.49], w: [17, 16, 17, 13, 20, 24] },
    },
    100: {
      stop: { p: [12.01, 14.99, 12.01, 11.5, 12.01, 14], w: [19, 24, 18, 22, 23, 25] },
      bake: { p: [12.01, 14.99, 12.01, 11.5, 12.01, 14], w: [19, 24, 18, 22, 23, 25] },
    },
  },
  300: {
    0: {
      stop: { p: [7.01, 7.5, 5.51, 4.49, 4.49, 6.5], w: [3, 21, 0, 0, 3, 3] },
      bake: { p: [7.01, 7.5, 5.51, 4.49, 4.49, 6.5], w: [4, 21, 0, 0, 3, 3] },
    },
    50: {
      stop: { p: [10.51, 10.99, 8.49, 7.5, 8.49, 9], w: [22, 21, 9, 13, 9, 11] },
      bake: { p: [10.51, 11.5, 8.49, 7.5, 8.49, 9], w: [22, 21, 9, 12, 9, 11] },
    },
    100: {
      stop: { p: [13.01, 14.99, 12.01, 11.5, 10.99, 11.5], w: [23, 21, 17, 23, 23, 16] },
      bake: { p: [13.49, 14, 12.01, 11.5, 10.99, 11.5], w: [22, 21, 17, 23, 23, 16] },
    },
  },
  400: {
    0: {
      stop: { p: [7.01, 8.49, 8.01, 8.01, 6.5, 5.99], w: [5, 6, 6, 0, 4, 3] },
      bake: { p: [6.5, 7.5, 6.5, 5.51, 5.51, 5.99], w: [3, 3, 0, 0, 3, 0] },
    },
    50: {
      stop: { p: [12.01, 11.5, 10.51, 9.51, 9.51, 9.51], w: [11, 21, 12, 11, 9, 11] },
      bake: { p: [9.51, 10, 8.49, 7.5, 8.49, 8.01], w: [9, 18, 10, 11, 8, 9] },
    },
    100: {
      stop: { p: [14, 13.01, 13.49, 12.5, 11.5, 13.49], w: [25, 21, 18, 21, 11, 11] },
      bake: { p: [12.01, 13.01, 10.99, 10, 10, 9.51], w: [24, 20, 15, 21, 10, 21] },
    },
  },
  600: {
    0: {
      stop: { p: [7.5, 6.5, 5.51, 5, 6.5, 5.51], w: [4, 0, 0, 0, 3, 0] },
      bake: { p: [7.5, 6.5, 5.51, 5, 6.5, 5.51], w: [4, 0, 0, 0, 3, 0] },
    },
    50: {
      stop: { p: [8.01, 7.01, 7.5, 7.01, 7.5, 6.5], w: [6, 4, 7, 0, 8, 6] },
      bake: { p: [8.01, 7.01, 7.5, 7.01, 7.5, 6.5], w: [6, 4, 7, 0, 8, 6] },
    },
    100: {
      stop: { p: [9, 9, 8.49, 8.01, 8.49, 8.49], w: [11, 9, 9, 13, 10, 12] },
      bake: { p: [9, 9, 8.49, 8.01, 8.49, 8.49], w: [11, 9, 9, 13, 10, 11] },
    },
  },
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function readCapture(dir, name) {
  const path = join(dir, name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`ridgeEnvelope: ${path} is not valid JSON (${error.message})`)
    process.exit(1)
  }
}

/** The ridge readout in the frozen table's units, or null when absent. */
function ridgeOf(capture) {
  const ridge = capture && capture.endMetrics && capture.endMetrics.ridge
  if (!ridge || typeof ridge.peakExcess !== 'number' || typeof ridge.ridgeWidthPx !== 'number') return null
  return { peak: round2(ridge.peakExcess * 255), width: ridge.ridgeWidthPx }
}

/** Parse `...-s<size>-e<edge>-<lane>-m<seed>.json`; null for any other name. */
function parseName(name) {
  const m = /-s(\d+)-e(0|50|100)-(stop|bake)-m([1-6])\.json$/.exec(name)
  if (!m) return null
  return { size: Number(m[1]), edge: Number(m[2]), lane: m[3], seed: Number(m[4]) }
}

/** The capture recipe this bar is frozen for. */
function recipeFailures(label, capture, cell) {
  const setup = capture.endSetup
  const failures = []
  const layer = setup && setup.layer
  if (capture.scenario !== 'bristle-end') failures.push(`${label}: scenario ${capture.scenario} != bristle-end`)
  if (capture.brush !== 'bristle-round') failures.push(`${label}: brush ${capture.brush} != bristle-round`)
  if (!setup) {
    failures.push(`${label}: endSetup missing`)
    return failures
  }
  if (setup.strokeSize !== cell.size) failures.push(`${label}: strokeSize ${setup.strokeSize} != ${cell.size}`)
  if (setup.dry !== 0) failures.push(`${label}: dry ${setup.dry} != 0`)
  if (setup.feather !== 100) failures.push(`${label}: feather ${setup.feather} != 100`)
  if (!layer) failures.push(`${label}: layer bag missing`)
  else {
    if (layer.amount !== cell.edge) failures.push(`${label}: layer.amount ${layer.amount} != ${cell.edge}`)
    if (layer.falloff !== 50) failures.push(`${label}: layer.falloff ${layer.falloff} != 50`)
  }
  if (capture.endDrive !== cell.lane) failures.push(`${label}: endDrive ${capture.endDrive} != ${cell.lane}`)
  return failures
}

/** Envelope failures over the seeded-dark cells of a PRE-shaped table. */
function seededFailures(table) {
  const failures = []
  for (const size of GATED_SIZES) {
    for (const edge of EDGES) {
      for (const lane of LANES) {
        const cell = table[size][edge][lane]
        for (const seed of SEEDED_DARK) {
          const peak = cell.p[seed - 1]
          const width = cell.w[seed - 1]
          const env = ENVELOPE[edge]
          if (peak > env.peak + 1e-9 || width > env.width) {
            failures.push({
              size,
              edge,
              lane,
              seed,
              peak,
              width,
              why: [
                peak > env.peak + 1e-9 ? `peak ${peak} > ${env.peak}` : null,
                width > env.width ? `width ${width} > ${env.width}` : null,
              ].filter(Boolean).join(', '),
            })
          }
        }
      }
    }
  }
  return failures
}

/** The Size 150 envelope implied by PRE, per edge. */
function derivedEnvelope() {
  const env = {}
  for (const edge of EDGES) {
    let peak = 0
    let width = 0
    for (const lane of LANES) {
      const cell = PRE[IDENTITY_SIZE][edge][lane]
      for (let seed = 0; seed < 6; seed += 1) {
        peak = Math.max(peak, cell.p[seed])
        width = Math.max(width, cell.w[seed])
      }
    }
    env[edge] = { peak, width }
  }
  return env
}

/** Build the PRE-shaped table from one capture directory + prefix. */
function scanCaptures(dir, prefix) {
  if (!existsSync(dir)) {
    console.error(`ridgeEnvelope: capture directory not found at ${dir}`)
    process.exit(2)
  }
  const names = readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort()
  const table = {}
  const failures = []
  const seen = new Set()
  for (const name of names) {
    const cell = parseName(name)
    if (cell === null) continue
    if (!(cell.size in PRE)) continue // a different scene/control, out of scope
    const key = `${cell.size}-${cell.edge}-${cell.lane}-${cell.seed}`
    if (seen.has(key)) {
      failures.push(`${name}: duplicate cell ${key}`)
      continue
    }
    seen.add(key)
    const capture = readCapture(dir, name)
    if (capture === null) {
      failures.push(`${name}: missing`)
      continue
    }
    failures.push(...recipeFailures(name, capture, cell))
    const ridge = ridgeOf(capture)
    if (ridge === null) {
      failures.push(`${name}: endMetrics.ridge missing or malformed`)
      continue
    }
    if (!table[cell.size]) table[cell.size] = {}
    if (!table[cell.size][cell.edge]) table[cell.size][cell.edge] = {}
    if (!table[cell.size][cell.edge][cell.lane]) {
      table[cell.size][cell.edge][cell.lane] = { p: [], w: [] }
    }
    const slot = table[cell.size][cell.edge][cell.lane]
    slot.p[cell.seed - 1] = ridge.peak
    slot.w[cell.seed - 1] = ridge.width
  }
  return { table, failures, names }
}

/** Cells present in a scanned table that PRE also has. */
function validateCompleteness(table, sizes, failures) {
  for (const size of sizes) {
    for (const edge of EDGES) {
      for (const lane of LANES) {
        const cell = table[size] && table[size][edge] && table[size][edge][lane]
        if (!cell) {
          failures.push(`missing cell s${size} e${edge} ${lane}`)
          continue
        }
        for (let seed = 0; seed < 6; seed += 1) {
          if (typeof cell.p[seed] !== 'number' || typeof cell.w[seed] !== 'number') {
            failures.push(`missing cell s${size} e${edge} ${lane} m${seed + 1}`)
          }
        }
      }
    }
  }
}

function fmtCell(cell, seed) {
  return `${cell.p[seed - 1].toFixed(2)}/${cell.w[seed - 1]}`
}

function runPre(dir) {
  const { table, failures, names } = scanCaptures(dir, PRE_PREFIX)
  validateCompleteness(table, [IDENTITY_SIZE, ...GATED_SIZES], failures)
  // Provenance: every measured cell must equal the frozen table exactly.
  let compared = 0
  for (const size of [IDENTITY_SIZE, ...GATED_SIZES]) {
    for (const edge of EDGES) {
      for (const lane of LANES) {
        const mine = table[size] && table[size][edge] && table[size][edge][lane]
        const frozen = PRE[size][edge][lane]
        if (!mine) continue
        for (let seed = 0; seed < 6; seed += 1) {
          compared += 1
          if (mine.p[seed] !== frozen.p[seed]) {
            failures.push(`provenance: s${size} e${edge} ${lane} m${seed + 1}: capture ${mine.p[seed]} != PRE ${frozen.p[seed]}`)
          }
          if (mine.w[seed] !== frozen.w[seed]) {
            failures.push(`provenance: s${size} e${edge} ${lane} m${seed + 1}: width ${mine.w[seed]} != PRE ${frozen.w[seed]}`)
          }
        }
      }
    }
  }
  // The envelope must equal the one derived from PRE's Size 150 cells.
  const derived = derivedEnvelope()
  for (const edge of EDGES) {
    if (derived[edge].peak !== ENVELOPE[edge].peak) {
      failures.push(`envelope: edge ${edge} peak ${ENVELOPE[edge].peak} != derived ${derived[edge].peak}`)
    }
    if (derived[edge].width !== ENVELOPE[edge].width) {
      failures.push(`envelope: edge ${edge} width ${ENVELOPE[edge].width} != derived ${derived[edge].width}`)
    }
  }
  // Discrimination: the frozen bar MUST fail the pre-law baseline.
  const preFails = seededFailures(PRE)
  console.log(`pre captures : ${names.length} file(s) under ${dir}, ${compared} cell(s) compared`)
  console.log('')
  console.log('the baseline fails the frozen bar at these seeded-dark cells:')
  for (const f of preFails) {
    console.log(`  s${f.size} e${f.edge} ${f.lane} m${f.seed}: ${f.peak.toFixed(2)}/${f.width} — ${f.why}`)
  }
  console.log('')
  if (preFails.length === 0) failures.push('discrimination: the pre-law baseline already meets the bar')
  if (failures.length > 0) {
    for (const line of failures) console.log(`FAIL ${line}`)
    console.log('')
    console.log('RESULT: FAIL — the frozen bar is not provenance-clean or not discriminating')
    return 1
  }
  console.log(
    `RESULT: PASS — PRE matches the captures, the envelope derives from Size 150, and the baseline fails at ${preFails.length} cells`,
  )
  return 0
}

function runPost(dir, prefix) {
  const { table, failures, names } = scanCaptures(dir, prefix)
  validateCompleteness(table, [IDENTITY_SIZE, ...GATED_SIZES], failures)
  // Size 150 below the 133..151 px gate: exact identity to PRE, not tolerance.
  let identity = 0
  for (const edge of EDGES) {
    for (const lane of LANES) {
      const mine = table[IDENTITY_SIZE] && table[IDENTITY_SIZE][edge] && table[IDENTITY_SIZE][edge][lane]
      const frozen = PRE[IDENTITY_SIZE][edge][lane]
      if (!mine) continue
      for (let seed = 0; seed < 6; seed += 1) {
        identity += 1
        if (mine.p[seed] !== frozen.p[seed] || mine.w[seed] !== frozen.w[seed]) {
          failures.push(
            `identity: s150 e${edge} ${lane} m${seed + 1} moved ${mine.p[seed]}/${mine.w[seed]} vs ${frozen.p[seed]}/${frozen.w[seed]}`,
          )
        }
      }
    }
  }
  // Envelope at the seeded-dark cells.
  const barFails = seededFailures(table)
  for (const f of barFails) {
    failures.push(`bar: s${f.size} e${f.edge} ${f.lane} m${f.seed} ${f.peak.toFixed(2)}/${f.width} — ${f.why}`)
  }
  // No regression against PRE on every gated cell.
  let regressions = 0
  for (const size of GATED_SIZES) {
    for (const edge of EDGES) {
      for (const lane of LANES) {
        const mine = table[size] && table[size][edge] && table[size][edge][lane]
        const frozen = PRE[size][edge][lane]
        if (!mine) continue
        for (let seed = 0; seed < 6; seed += 1) {
          const dp = mine.p[seed] - frozen.p[seed]
          const dw = mine.w[seed] - frozen.w[seed]
          if (dp > REGRESS_PEAK || dw > REGRESS_WIDTH) {
            regressions += 1
            failures.push(
              `regression: s${size} e${edge} ${lane} m${seed + 1} peak ${frozen.p[seed]}->${mine.p[seed]} (+${dp.toFixed(2)}) width ${frozen.w[seed]}->${mine.w[seed]} (+${dw})`,
            )
          }
        }
      }
    }
  }
  console.log(`post captures: ${names.length} file(s) under ${dir}, prefix "${prefix}"`)
  console.log('')
  console.log('size edge lane seed | pre peak/width | post peak/width | verdict')
  for (const size of [...GATED_SIZES, IDENTITY_SIZE]) {
    for (const edge of EDGES) {
      for (const lane of LANES) {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          const mine = table[size] && table[size][edge] && table[size][edge][lane]
          const frozen = PRE[size][edge][lane]
          if (!mine || typeof mine.p[seed - 1] !== 'number') continue
          const seeded = size !== IDENTITY_SIZE && SEEDED_DARK.includes(seed)
          const env = ENVELOPE[edge]
          const bar = size === IDENTITY_SIZE
            ? mine.p[seed - 1] === frozen.p[seed - 1] && mine.w[seed - 1] === frozen.w[seed - 1] ? 'identity' : 'MOVED'
            : seeded
              ? mine.p[seed - 1] <= env.peak + 1e-9 && mine.w[seed - 1] <= env.width ? 'bar' : 'BAR FAIL'
              : mine.p[seed - 1] <= frozen.p[seed - 1] + REGRESS_PEAK && mine.w[seed - 1] <= frozen.w[seed - 1] + REGRESS_WIDTH ? 'ok' : 'REGRESS'
          console.log(
            `s${String(size).padStart(3)} e${String(edge).padStart(3)} ${lane.padEnd(4)} m${seed} | ` +
              `${fmtCell(frozen, seed).padStart(7)} | ${fmtCell(mine, seed).padStart(7)} | ${bar}`,
          )
        }
      }
    }
  }
  console.log('')
  console.log(`identity cells: ${identity} (Size 150 must be exact)`)
  console.log(`seeded-dark envelope failures: ${barFails.length}`)
  console.log(`gated regressions: ${regressions}`)
  console.log('')
  if (failures.length > 0) {
    for (const line of failures) console.log(`FAIL ${line}`)
    console.log('')
    console.log('RESULT: FAIL — the frozen bar is not met')
    return 1
  }
  console.log('RESULT: PASS — envelope met at every seeded-dark cell, no gated regression, Size 150 exact')
  return 0
}

const argv = process.argv.slice(2)
if (argv[0] === '--pre') {
  const dir = argv[1] && !argv[1].startsWith('--') ? argv[1] : DEFAULT_DIR
  process.exitCode = runPre(dir)
} else if (argv[0] === '--post') {
  const prefix = argv[1]
  if (!prefix || prefix.startsWith('--')) {
    console.error('ridgeEnvelope: --post needs a capture filename prefix')
    process.exit(2)
  }
  const dir = argv[2] && !argv[2].startsWith('--') ? argv[2] : DEFAULT_DIR
  process.exitCode = runPost(dir, prefix)
} else {
  console.error('usage: node ridgeEnvelope.mjs --pre [captureDir] | --post <prefix> [captureDir]')
  process.exit(2)
}

#!/usr/bin/env node
// ============================================================
//  bristle-records.mjs — re-run the SIX committed bristle
//  records through the untouched medium-engine gate and record
//  what the current tree renders.
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage: node probe/port-comparison/bristle-records.mjs before|after [--pair]
//
//  D-B: the six records are evidence in Task 1 (corrected gate)
//  and the mover decision in Task 3 (final engine). They are re-run
//  here so both tasks spell the operands ONCE:
//    bristle-wet-1080        --scenario bristle-wet        --size 1080
//    bristle-edge-1080       --scenario bristle-edge       --size 1080
//    bristle-body0-1080      --scenario cover-textured     --size 1080 --brush bristle-flat --body 0
//    bristle-body100-1080    --scenario cover-textured     --size 1080 --brush bristle-flat --body 100
//    bristle-round-body0-1080 --scenario cover-textured    --size 1080 --brush bristle-round
//    bristle-body100-2048    --scenario cover-textured     --size 2048 --brush bristle-flat --body 100
//
//  The `--body 0` on bristle-body0-1080 is the record's OWN operand, not a
//  calibration: the 64-22 origin baseline (1a3b99058) and the 64-23 baseline
//  (08fc85977) both recorded `body: 0`, and 64-23's SUMMARY deviation #3 fixed
//  this exact drift ("the committed baseline records body: 0; without the
//  operand the capture measures the default Body and drifts"). The 64-24
//  re-author (dfe46df10) dropped it again, leaving two byte-identical Body-100
//  captures; D-F's strict separation is unsatisfiable that way. The round
//  record keeps the plan's operand list (no `--body`, i.e. the script's Body
//  100 default): its required relation is `coverAlphaCoveredFraction` inside
//  [0.02, 0.80], and the corrected gate measures exactly 0 at Body 0 (the
//  cover channel tops out at BRISTLE_BODY_ALPHA_FLOOR 0.5, below the covered
//  threshold), so naming both dimensions Body 0 would make its relation
//  unenforceable. Recorded, never asserted: the body pair is evidence and the
//  D-C separation lives in the port-comparison harness's body0/body100 scenes.
//
//  With --pair each record is captured a second time as `<record>-repeat`
//  and `compare.mjs <record> --other <record>-repeat` must pass, so a mover
//  is only ever copied from a verified same-session pair (Task 3's rule).
//
//  Every D-B relation is asserted on the FIRST capture; a failing relation
//  throws — never a warning, and never a re-capture to hide it. The body
//  pair (body0/body100) is RECORDED, never asserted: the committed pair is
//  identical and the strict separation lives in the port-comparison
//  harness's body0/body100 scenes (D-C).
//
//  Writes probe/port-comparison/captures/<label>/bristle-records.json with,
//  per record, the committed baseline, the corrected-gate capture (read from
//  the before file on an after run) and this run's capture. NO baseline is
//  written here: Task 3 copies movers itself, one file per commit.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..', '..')
const mediumEngine = join(pkgRoot, 'probe', 'medium-engine')

const args = process.argv.slice(2)
const label = args.find((token) => !token.startsWith('--'))
if (label !== 'before' && label !== 'after') {
  console.error('usage: node bristle-records.mjs before|after [--pair]')
  process.exit(1)
}
const pair = args.includes('--pair')

const RECORDS = [
  { name: 'bristle-wet-1080', operands: ['--scenario', 'bristle-wet', '--size', '1080'] },
  { name: 'bristle-edge-1080', operands: ['--scenario', 'bristle-edge', '--size', '1080'] },
  {
    name: 'bristle-body0-1080',
    operands: ['--scenario', 'cover-textured', '--size', '1080', '--brush', 'bristle-flat', '--body', '0'],
  },
  {
    name: 'bristle-body100-1080',
    operands: ['--scenario', 'cover-textured', '--size', '1080', '--brush', 'bristle-flat', '--body', '100'],
  },
  {
    name: 'bristle-round-body0-1080',
    operands: ['--scenario', 'cover-textured', '--size', '1080', '--brush', 'bristle-round'],
  },
  {
    name: 'bristle-body100-2048',
    operands: ['--scenario', 'cover-textured', '--size', '2048', '--brush', 'bristle-flat', '--body', '100'],
  },
]

function fail(message) {
  console.error(`[bristle-records] ${message}`)
  process.exit(1)
}

function runGate(gate, operands) {
  const result = spawnSync(
    process.execPath,
    [join(mediumEngine, 'run.mjs'), '--gate', gate, ...operands],
    { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    fail(`gate "${gate}" failed (exit ${result.status}):\n${(result.stderr || result.stdout || '').slice(-4000)}`)
  }
  const path = `/tmp/medium-engine/${gate}.json`
  if (!existsSync(path)) fail(`gate "${gate}" wrote no ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function comparePair(gate, other) {
  const result = spawnSync(
    process.execPath,
    [join(mediumEngine, 'compare.mjs'), gate, '--other', other],
    { encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    fail(`same-session pair "${gate}" vs "${other}" differs:\n${(result.stdout || result.stderr || '').slice(-4000)}`)
  }
}

const n = (capture, key) => {
  const value = capture[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`missing or non-finite "${key}" (verdict=${capture.verdict ?? '(none)'})`)
  }
  return value
}

/** D-B's relations, asserted per record on the fresh capture. */
function assertRelations(name, capture, captures) {
  if (name === 'bristle-wet-1080') {
    const fresh = n(capture, 'pickupFreshMean')
    const aged = n(capture, 'pickupAgedWetMean')
    if (!(fresh > 0 && fresh <= 255)) throw new Error(`bristle-wet: pickupFreshMean ${fresh} outside (0,255]`)
    if (!(aged > 0 && aged <= 255)) throw new Error(`bristle-wet: pickupAgedWetMean ${aged} outside (0,255]`)
    if (!(Math.abs(fresh - aged) >= 1)) throw new Error(`bristle-wet: gap ${Math.abs(fresh - aged)} below 1`)
    return
  }
  if (name === 'bristle-edge-1080') {
    const f0 = n(capture, 'edgeSoftnessPxFeather0')
    const f100 = n(capture, 'edgeSoftnessPxFeather100')
    const v0 = n(capture, 'edgeVariationPxFeather0')
    const v100 = n(capture, 'edgeVariationPxFeather100')
    const half = n(capture, 'edgeHalfWidthPx')
    if (!(f0 > 0)) throw new Error(`bristle-edge: Feather-0 softness ${f0} is not positive`)
    if (!(f100 > f0)) throw new Error(`bristle-edge: Feather-100 softness ${f100} not wider than Feather-0 ${f0}`)
    if (!(v0 > 0 && v100 > 0)) throw new Error(`bristle-edge: variations ${v0}/${v100} not both positive`)
    if (!(f100 < half)) throw new Error(`bristle-edge: Feather-100 softness ${f100} not below edgeHalfWidthPx ${half}`)
    if (!Array.isArray(capture.edgeFailures) || capture.edgeFailures.length !== 0) {
      throw new Error(`bristle-edge: edgeFailures ${JSON.stringify(capture.edgeFailures)}`)
    }
    return
  }
  if (name === 'bristle-round-body0-1080') {
    const covered = n(capture, 'coverAlphaCoveredFraction')
    if (!(covered >= 0.02 && covered <= 0.8)) {
      throw new Error(`bristle-round: coverAlphaCoveredFraction ${covered} outside [0.02, 0.80]`)
    }
    return
  }
  if (name === 'bristle-body100-2048') {
    const reference = captures['bristle-body100-1080']
    if (!reference) throw new Error('bristle-body100-2048: the 1080 body100 capture is missing')
    for (const key of ['coverAlphaCoveredFraction', 'coverAlphaMean']) {
      const wide = n(capture, key)
      const base = n(reference, key)
      const tolerance = Math.abs(base) * 0.1
      if (Math.abs(wide - base) > tolerance) {
        throw new Error(`${key} ${wide} is not within 10% of the 1080 body100 ${base}`)
      }
    }
  }
  // The body pair is recorded, never asserted (D-B / D-C).
}

const beforePath = join(here, 'captures', 'before', 'bristle-records.json')
const records = {}
const captures = {}

for (const record of RECORDS) {
  const baselinePath = join(mediumEngine, 'baselines', `${record.name}.json`)
  if (!existsSync(baselinePath)) fail(`missing committed baseline ${baselinePath}`)
  const committed = JSON.parse(readFileSync(baselinePath, 'utf8'))

  console.log(`[bristle-records] capturing ${record.name} ...`)
  const capture = runGate(record.name, record.operands)
  captures[record.name] = capture
  assertRelations(record.name, capture, captures)

  let pairMatched = null
  if (pair) {
    const repeat = `${record.name}-repeat`
    console.log(`[bristle-records] pair check ${record.name} ...`)
    runGate(repeat, record.operands)
    comparePair(record.name, repeat)
    pairMatched = true
  }

  const entry = { operands: record.operands, committed, pairMatched }
  if (label === 'before') {
    entry.correctedGate = capture
  } else {
    if (!existsSync(beforePath)) fail(`missing ${beforePath} — Task 1's evidence is required for the after run`)
    const before = JSON.parse(readFileSync(beforePath, 'utf8'))
    const prior = before.records?.[record.name]?.correctedGate
    if (!prior) fail(`captures/before/bristle-records.json has no correctedGate for ${record.name}`)
    entry.correctedGate = prior
    entry.final = capture
  }
  records[record.name] = entry
}

const target = join(here, 'captures', label, 'bristle-records.json')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, JSON.stringify({ label, records }, null, 2) + '\n')
console.log(`[bristle-records] written: ${target}`)
for (const record of RECORDS) {
  const entry = records[record.name]
  const now = label === 'before' ? entry.correctedGate : entry.final
  console.log(`  ${record.name.padEnd(24)} ${now.digestPaper} ${now.digestTransparent} ${now.digestWhite} ${now.digestPigment}`)
}

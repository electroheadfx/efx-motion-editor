#!/usr/bin/env node
// ============================================================
//  compare.mjs — the medium-engine pixel-gate comparator.
//
//  Two modes, both used by this plan and every later gate:
//
//   1. Committed-baseline equality
//        node compare.mjs <gate>
//      Compares /tmp/medium-engine/<gate>.json against the committed
//      probe/medium-engine/baselines/<gate>.json on every recorded
//      digest, the byte length and the dimensions.
//
//   2. Same-session comparison
//        node compare.mjs <gate> --other <otherGate>
//      Compares two /tmp captures against each other and NEVER consults
//      baselines/.
//
//  Exit codes: 0 = equal, 1 = different or missing data, 2 = bad usage.
//  Unknown flags are rejected loudly: a later plan adds `--differs-from`
//  (64-04) and it must not be silently misparsed here.
// ============================================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tmpDir = '/tmp/medium-engine'

const FIELDS = [
  'digestPaper',
  'digestTransparent',
  'digestWhite',
  'byteLength',
  'width',
  'height',
]

function usage(message) {
  console.error(`compare: ${message}`)
  console.error('usage: node compare.mjs <gate> [--other <otherGate>]')
  process.exit(2)
}

const args = process.argv.slice(2)
const gate = args[0]
if (!gate || gate.startsWith('--')) usage('missing <gate> operand')

let other
if (args.length > 1) {
  if (args[1] !== '--other') usage(`unknown argument "${args[1]}"`)
  other = args[2]
  if (!other || other.startsWith('--')) usage('--other needs a gate name')
  if (args.length > 3) usage(`unexpected extra argument "${args[3]}"`)
}

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`compare: ${label} not found at ${path}`)
    process.exit(1)
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`compare: ${label} is not valid JSON (${error.message})`)
    process.exit(1)
  }
}

const actualPath = join(tmpDir, `${gate}.json`)
const actual = readJson(actualPath, `capture "${gate}"`)

const referenceLabel = other === undefined
  ? `baseline "${gate}"`
  : `same-session capture "${other}"`
const referencePath = other === undefined
  ? join(here, 'baselines', `${gate}.json`)
  : join(tmpDir, `${other}.json`)
const reference = readJson(referencePath, referenceLabel)

console.log('============ medium-engine pixel-gate compare ============')
console.log(`mode      : ${other === undefined ? 'committed baseline' : 'same session (--other)'}`)
console.log(`capture   : ${actualPath}`)
console.log(`reference : ${referencePath}`)
if (other === undefined && typeof reference.capturedFromCommit === 'string') {
  console.log(`baseline  : captured from commit ${reference.capturedFromCommit}`)
}
console.log('')

let differing = 0
let missing = 0
for (const field of FIELDS) {
  const a = actual[field]
  const b = reference[field]
  const aOk = a !== undefined && a !== null
  const bOk = b !== undefined && b !== null
  if (!aOk || !bOk) {
    missing += 1
    console.log(`MISSING   ${field.padEnd(18)} capture=${aOk ? a : '(missing)'} reference=${bOk ? b : '(missing)'}`)
    continue
  }
  if (a !== b) {
    differing += 1
    console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
  } else {
    console.log(`equal     ${field.padEnd(18)} ${a}`)
  }
}

console.log('')
if (missing > 0 || differing > 0) {
  console.log(
    `RESULT: FAIL — ${differing} differing field(s), ${missing} missing field(s) ` +
      `(${gate} vs ${other === undefined ? 'baseline' : other})`,
  )
  console.log('=========================================================')
  process.exit(1)
}

console.log(`RESULT: PASS — all ${FIELDS.length} fields equal (${gate} vs ${other === undefined ? 'baseline' : other})`)
console.log('=========================================================')

#!/usr/bin/env node
// Scratch harness: bundle apply.ts, run it in headless Chrome and read the
// result over CDP (the bake is async, so --dump-dom returns too early).
// Usage: node packages/efx-watercolor/probe/ink-parity/run-cdp.mjs

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/ink-parity-apply'
const bundlePath = join(here, 'probe.bundle.js')
const PORT = 9333

const esbuildCandidates = [
  join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
  join(repoRoot, 'node_modules/.bin/esbuild'),
]
const esbuild = esbuildCandidates.find((path) => existsSync(path))
if (!esbuild) { console.error('esbuild not found'); process.exit(1) }

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) { console.error('Chrome not found'); process.exit(1) }

mkdirSync(outDir, { recursive: true })

const build = spawnSync(esbuild, [
  join(here, 'apply.ts'),
  '--bundle', '--format=iife', '--platform=browser', '--target=es2022',
  '--log-level=warning', `--outfile=${bundlePath}`,
], { encoding: 'utf8' })
if (build.status !== 0) { console.error(build.stderr || build.stdout); process.exit(1) }
if (build.stderr.trim()) console.error(build.stderr.trim())

const child = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--window-size=1200,1200',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${PORT}`,
  `file://${join(here, 'index.html')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function targetUrl() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page' && target.url.includes('index.html'))
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    await sleep(200)
  }
  throw new Error('Chrome CDP target never appeared')
}

const wsUrl = await targetUrl()
const socket = new WebSocket(wsUrl)
await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })

let nextId = 1
const pending = new Map()
socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString())
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})
function send(method, params = {}) {
  const id = nextId++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, (message) => {
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }))
}

await send('Runtime.enable')
let output
const startedAt = Date.now()
for (let attempt = 0; attempt < 3600; attempt += 1) {
  const evaluated = await send('Runtime.evaluate', {
    expression: 'window.__PROBE_STATE === undefined ? "pending" : window.__PROBE_STATE',
    returnByValue: true,
  })
  const state = evaluated?.result?.value
  if (state !== 'pending') {
    output = state
    break
  }
  if (Date.now() - startedAt > 900_000) break
  await sleep(500)
}
if (!output) {
  console.error('[ink-parity-apply] timeout waiting for the probe result')
  child.kill('SIGKILL')
  process.exit(1)
}
socket.close()
child.kill('SIGKILL')

const result = JSON.parse(output)
writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2))
if (result.error) { console.error(result.error); process.exit(1) }
if (result.pngs) {
  const prefix = 'data:image/png;base64,'
  for (const [name, dataUrl] of Object.entries(result.pngs)) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith(prefix)) {
      writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.slice(prefix.length), 'base64'))
    }
  }
}
const { pngs, ...rest } = result
console.log(JSON.stringify(rest, null, 2))
console.log(`result: ${join(outDir, 'result.json')}`)

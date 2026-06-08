# @efxlab/efx-physic-paint

A TypeScript library for natural-media paint simulation with wet/dry physics. Renders watercolor, ink, and oil-like strokes with paper texture interaction, flow fields, and transparency support.

Built on a Stam stable fluids solver with Beer-Lambert transparency, per-pixel Porter-Duff compositing, and a dual wet/dry layer system.

## Features

- Dual-layer wet/dry paint physics with stable fluids solver
- Paper texture interaction (height-based adsorption model)
- Flow field transport with height equalization and edge darkening
- Per-pixel stroke opacity with Porter-Duff compositing
- Subtractive RYB color mixing
- 9 brush types: paint, erase, water, smear, blend, blow, wet, dry, pressure
- Tablet/pen pressure support via PointerEvent
- Stroke recording and replay (AnimationPlayer)
- Zero runtime dependencies — 68KB ESM bundle

## Install

```bash
npm install @efxlab/efx-physic-paint
```

## Quick Start

```ts
import { EfxPaintEngine } from '@efxlab/efx-physic-paint'

const container = document.querySelector('#paint') as HTMLElement
const engine = new EfxPaintEngine(container, {
  width: 1000,
  height: 650,
  papers: [{ name: 'canvas1', url: '/img/paper_1.jpg' }],
  defaultPaper: 'canvas1',
})

await engine.init()
console.log('Ready to paint')
```

## Preact Component

```tsx
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'

function App() {
  return (
    <EfxPaintCanvas
      width={1000}
      height={650}
      papers={[{ name: 'canvas1', url: '/img/paper_1.jpg' }]}
      defaultPaper="canvas1"
      onEngineReady={(engine) => {
        engine.setTool('paint')
      }}
    />
  )
}
```

## Animation Player

```ts
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation'

const player = new AnimationPlayer(engine, {
  strokes: savedStrokes,
  onFrame: (frameIndex) => console.log(`Frame ${frameIndex}`),
  onComplete: () => console.log('Done'),
})
player.play()
```

## API

### `EfxPaintEngine`

| Method | Description |
|--------|-------------|
| `setTool(tool)` | Set active tool (`'paint'`, `'erase'`, `'water'`, `'smear'`, `'blend'`, `'blow'`, `'wet'`, `'dry'`, `'pressure'`) |
| `setBrushSize(size)` | Set brush radius in pixels |
| `setOpacity(value)` | Set brush opacity (0–1) |
| `setColorRGB(r, g, b)` | Set paint color |
| `setWaterAmount(value)` | Set water amount for wet brushes |
| `setDryAmount(value)` | Set drying rate |
| `clearCanvas()` | Clear all paint layers |
| `getStrokes()` | Get recorded stroke data |
| `loadProject(data)` | Load a serialized project |
| `saveProject()` | Serialize current state |
| `onEngineReady(cb)` | Callback when engine is initialized |
| `destroy()` | Clean up resources |

## Development

Run package workflows with pnpm from the repository root.

```bash
pnpm install

# Standalone browser demo for packages/efx-physic-paint.
pnpm dev:paint

# Package-local equivalent of the root demo command.
pnpm --filter @efxlab/efx-physic-paint demo:dev

# Build-smoke the standalone Vite demo without starting a dev server.
pnpm --filter @efxlab/efx-physic-paint demo:build

# Build the library dist and type outputs.
pnpm --filter @efxlab/efx-physic-paint build

# Type-check the package source.
pnpm --filter @efxlab/efx-physic-paint check
```

`pnpm dev:paint` launches the standalone physics paint browser demo for `packages/efx-physic-paint`. The demo includes the original-style toolbar/settings controls and paper texture assets ported into the package demo, but it remains a package-local standalone demo.

Workflow boundaries:

- root `pnpm dev` runs the app Vite frontend.
- The app Tauri command runs the desktop app workflow from `app/`.
- root `pnpm dev:paint` runs the standalone physics paint browser demo.

The standalone demo uses the public package surface and is not an editor paint-layer integration. Vite demo/HMR is separate from the package `build`/`check` workflow and from library outputs; demo files are not package exports or `tsup` entries.

## License

GPL-2.0 — see [LICENSE](LICENSE)

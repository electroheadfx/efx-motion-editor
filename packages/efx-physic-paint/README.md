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

const canvas = document.querySelector('canvas')!
const engine = new EfxPaintEngine(canvas, {
  width: 1000,
  height: 650,
  paperPath: '/img/paper_1.jpg',
})

engine.onEngineReady(() => {
  console.log('Ready to paint')
})
```

## Preact Component

```tsx
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'

function App() {
  return (
    <EfxPaintCanvas
      width={1000}
      height={650}
      paperPath="/img/paper_1.jpg"
      onEngine={(engine) => {
        engine.setTool('paint')
        engine.setBrushSize(20)
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

```bash
pnpm install
pnpm dev        # Start demo app on localhost:5173
pnpm build      # Build library
pnpm check      # Type check
```

## License

GPL-2.0 — see [LICENSE](LICENSE)

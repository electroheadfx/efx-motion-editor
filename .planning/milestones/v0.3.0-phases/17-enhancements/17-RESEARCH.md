# Phase 17: Enhancements - Research

**Researched:** 2026-03-24
**Domain:** Preact UI enhancements, Preact Signals state, Canvas 2D rendering, CSS gradients, Tailwind v4 migration
**Confidence:** HIGH

## Summary

Phase 17 delivers four distinct feature areas: (1) collapsible key photo lists in the sidebar Sequences panel, (2) a global "solo" mode that strips overlay layers and FX from preview/export, (3) gradient support for solid key entries and layer solids, and (4) a project-wide Tailwind v4 syntax cleanup. Each area is well-constrained by user decisions and maps cleanly to existing codebase patterns.

The collapse/expand work is a focused change in SequenceItem (SequenceList.tsx), adding a toggle-on-second-click behavior to the already-existing maxHeight CSS transition. Solo mode follows the isolationStore pattern: a new signal-based soloStore, a toolbar button, and gating logic in renderGlobalFrame and exportEngine. Gradient solids extend the ColorPickerModal with a mode toggle and gradient stop editor, plus Canvas 2D gradient rendering in previewRenderer. The Tailwind cleanup is a mechanical find-and-replace across ~33 files.

**Primary recommendation:** Implement in four independent work streams: collapse, solo, gradient solids, and Tailwind cleanup. The first three each require frontend signal + UI + renderer integration. The Tailwind cleanup is purely mechanical and can be done in a single pass.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** ENH-01 (scroll through key photos) is dropped -- the real issue is scroll blocking when key photos are expanded, and ENH-02 collapse solves it
- **D-02:** Toggle behavior: first click on sequence header selects + expands key photos. Second click on the SAME active sequence collapses key photos
- **D-03:** Clicking a different sequence auto-collapses the previous and auto-expands the new one
- **D-04:** Always auto-expand when selecting a new sequence -- no memory of collapsed state across sequence switches
- **D-05:** No wheel passthrough fix needed -- collapse is sufficient for the scroll blocking issue
- **D-06:** ENH-03 revised from "solo a sequence" to "solo the timeline" -- global toggle, not per-sequence
- **D-07:** ENH-04 (per-layer solo) is dropped -- only global solo exists
- **D-08:** Solo = strips ALL overlay layers (from key photos and timeline) and ALL FX (from timeline). Only base key photos render
- **D-09:** Solo toggle lives in the timeline toolbar as a button
- **D-10:** Solo affects both preview and export -- when active, export also produces clean frames
- **D-11:** Solo is independent from the existing isolation system (orange bar). Isolation controls which sequences play; solo controls whether layers/FX render. They can combine
- **D-12:** Solid key entries and layer solids gain a gradient mode alongside flat color -- CSS gradient rendering (not GLSL)
- **D-13:** Extend existing ColorPickerModal with a Solid / Gradient mode toggle. Solid mode = current HSV picker. Gradient mode = gradient type + color stops + angle/center controls
- **D-14:** Supported gradient types: linear, radial, and conic
- **D-15:** 2-5 color stops per gradient. Start with 2 stops, user can add more. Draggable stop positions on a gradient bar
- **D-16:** Applies to both key photo solid entries and timeline layer solids
- **D-17:** Gradient data persists in .mce project file (format version bump required)
- **D-18:** Fix all Tailwind v4 syntax warnings project-wide -- not just files touched by this phase
- **D-19:** Migrate deprecated patterns like `ring-[var(--color-accent)]` to `ring-(--color-accent)`, `bg-[var(...)]` to `bg-(...)`, `text-[var(...)]` to `text-(...)`, etc.

### Claude's Discretion
- Solo button icon and visual indicator (active state styling)
- Keyboard shortcut for solo toggle
- Animation/transition for collapse/expand (current maxHeight transition can be kept)
- Whether solo state persists in project file or is session-only
- Gradient picker UI layout within the ColorPickerModal
- Gradient bar drag interaction details

### Deferred Ideas (OUT OF SCOPE)
- **Per-layer solo** -- Solo individual layers within a sequence (ENH-04 original scope) -- dropped for now, could revisit in a future polish phase
- **Smart wheel passthrough** -- Fix KeyPhotoStrip wheel handler to propagate to parent when at scroll edges -- low priority since collapse solves the UX issue
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENH-01 | User can scroll through key photos in sidebar Sequences panel when list overflows | DROPPED per D-01: collapse (ENH-02) solves the underlying scroll blocking issue |
| ENH-02 | User can collapse/expand key photo list by clicking sequence header bar a second time | Collapse toggle in SequenceItem; maxHeight CSS transition already exists at lines 380-384 |
| ENH-03 | User can solo a sequence to play without layers and FX | Revised to global solo (D-06); soloStore signal, renderGlobalFrame gating, export integration |
| ENH-04 | User can solo individual layers within a sequence via sidebar toggle | DROPPED per D-07: only global solo exists |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Find GSD tools from `.claude/get-shit-done` (not `$HOME/.claude/get-shit-done`)
- Do not run the server -- the user runs it separately

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | (existing) | UI framework | Already in use project-wide |
| @preact/signals | (existing) | Reactive state management | All stores use signals pattern |
| lucide-preact | (existing) | Icon library | All toolbar icons use Lucide |
| tailwindcss | 4.2.1 | Utility CSS | Already installed, v4 with @tailwindcss/vite plugin |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (existing) | Test framework | soloStore unit tests |

No new dependencies required. All features are implementable with the existing stack.

## Architecture Patterns

### Recommended Structure for New Code

```
src/
  stores/
    soloStore.ts          # New: signal-based solo state (follows isolationStore pattern)
  components/
    sequence/
      SequenceList.tsx     # Modify: add collapse toggle on second click
    layout/
      TimelinePanel.tsx    # Modify: add solo button to toolbar
    shared/
      ColorPickerModal.tsx # Modify: add gradient mode toggle + gradient editor
      GradientBar.tsx      # New: draggable gradient stop editor component
  lib/
    exportRenderer.ts      # Modify: solo-aware rendering path
    previewRenderer.ts     # Modify: CSS gradient canvas rendering
  types/
    sequence.ts            # Modify: add GradientData to KeyPhoto
    project.ts             # Modify: add gradient fields to MceKeyPhoto
    timeline.ts            # Modify: add gradient field to FrameEntry
```

### Pattern 1: Signal-Based Store (soloStore)
**What:** Follow the isolationStore pattern for solo state
**When to use:** Solo toggle is a global boolean signal
**Example:**
```typescript
// Source: isolationStore.ts pattern (lines 1-54)
import { signal, computed } from '@preact/signals';

const soloEnabled = signal(false);

export const soloStore = {
  soloEnabled,
  isSolo: computed(() => soloEnabled.value),

  toggleSolo() {
    soloEnabled.value = !soloEnabled.value;
  },

  setSolo(v: boolean) {
    soloEnabled.value = v;
  },
};
```

### Pattern 2: Collapse Toggle on Existing SequenceItem
**What:** Add local collapse state that toggles on second click of same active sequence
**When to use:** SequenceItem already uses `isActive` to control maxHeight (line 383)
**Example:**
```typescript
// Current code (SequenceList.tsx lines 380-384):
// maxHeight: isActive ? '72px' : '0px'
//
// New: add keyPhotoCollapsed state that tracks manual collapse
const [keyPhotoCollapsed, setKeyPhotoCollapsed] = useState(false);

// In handleSelect: if already active, toggle collapse
// If switching sequences, reset collapse to false (auto-expand per D-04)
const handleSelect = useCallback(() => {
  if (!editing) {
    if (seq.id === sequenceStore.activeSequenceId.peek()) {
      // Second click on same sequence -- toggle collapse (D-02)
      setKeyPhotoCollapsed(prev => !prev);
      return;
    }
    // Switching sequences -- auto-expand (D-04)
    setKeyPhotoCollapsed(false);
    // ... existing selection logic
  }
}, [seq.id, editing]);

// maxHeight now checks both isActive AND collapsed state
// maxHeight: isActive && !keyPhotoCollapsed ? '72px' : '0px'
```

### Pattern 3: Solo-Aware Rendering in renderGlobalFrame
**What:** Skip overlay/FX sequences when solo is active
**When to use:** In exportRenderer.ts renderGlobalFrame function
**Example:**
```typescript
// In renderGlobalFrame, after normal content render:
// The solo flag is passed in (not read from signals -- pure function pattern)
// Overlay loop (lines 253-312) is skipped entirely when soloActive is true
if (!soloActive) {
  // existing overlay sequence compositing code
  const overlaySeqs = allSeqs.filter(s => s.kind !== 'content' && s.visible !== false);
  // ... rest of overlay/FX rendering
}
```

### Pattern 4: Gradient Data Model
**What:** Gradient configuration stored alongside solidColor on KeyPhoto
**When to use:** When a key entry uses gradient mode instead of flat color
**Example:**
```typescript
// types/sequence.ts extension:
export interface GradientStop {
  color: string;    // hex color
  position: number; // 0-1 normalized position
}

export interface GradientData {
  type: 'linear' | 'radial' | 'conic';
  stops: GradientStop[];    // 2-5 stops
  angle?: number;           // degrees, for linear (default 0 = top to bottom)
  centerX?: number;         // 0-1, for radial/conic (default 0.5)
  centerY?: number;         // 0-1, for radial/conic (default 0.5)
}

// KeyPhoto extension:
export interface KeyPhoto {
  // ... existing fields
  gradient?: GradientData;  // present when using gradient mode instead of solidColor
}
```

### Pattern 5: CSS Gradient to Canvas 2D
**What:** Convert GradientData to Canvas 2D gradient for rendering
**When to use:** In previewRenderer.ts when rendering a solid entry with gradient
**Example:**
```typescript
function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: GradientData,
  width: number,
  height: number,
): CanvasGradient {
  let canvasGrad: CanvasGradient;
  if (gradient.type === 'linear') {
    const angle = (gradient.angle ?? 0) * Math.PI / 180;
    const cx = width / 2, cy = height / 2;
    const len = Math.sqrt(width * width + height * height) / 2;
    canvasGrad = ctx.createLinearGradient(
      cx - Math.sin(angle) * len, cy - Math.cos(angle) * len,
      cx + Math.sin(angle) * len, cy + Math.cos(angle) * len,
    );
  } else if (gradient.type === 'radial') {
    const cx = (gradient.centerX ?? 0.5) * width;
    const cy = (gradient.centerY ?? 0.5) * height;
    const radius = Math.max(width, height) / 2;
    canvasGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  } else {
    // Conic: Canvas 2D has createConicGradient (Chrome 99+, Safari 16.4+)
    const cx = (gradient.centerX ?? 0.5) * width;
    const cy = (gradient.centerY ?? 0.5) * height;
    const startAngle = ((gradient.angle ?? 0) - 90) * Math.PI / 180;
    canvasGrad = ctx.createConicGradient(startAngle, cx, cy);
  }
  for (const stop of gradient.stops) {
    canvasGrad.addColorStop(stop.position, stop.color);
  }
  return canvasGrad;
}
```

### Pattern 6: Tailwind v4 Syntax Migration
**What:** Replace `[var(--custom-prop)]` with `(--custom-prop)` in utility classes
**When to use:** All component files using CSS custom properties in Tailwind classes
**Example:**
```
// Before (Tailwind v3/early v4 syntax):
ring-[var(--color-accent)]
bg-[var(--color-bg-input)]
text-[var(--color-text-secondary)]
border-[var(--color-border-subtle)]

// After (Tailwind v4 parenthetical shorthand):
ring-(--color-accent)
bg-(--color-bg-input)
text-(--color-text-secondary)
border-(--color-border-subtle)
```

### Anti-Patterns to Avoid
- **Reading signals in renderGlobalFrame:** This function is pure (no signal reads). Pass soloActive as a parameter, not via soloStore.soloEnabled.peek() inside the function.
- **Storing collapse state globally:** Per D-04, collapse state resets when switching sequences. Local useState in SequenceItem is correct, not a global signal.
- **Using GLSL for gradients:** D-12 specifies CSS gradient rendering, not GLSL shaders. Canvas 2D gradient APIs are the correct approach.
- **Building gradient picker from scratch:** Reuse the existing ColorPickerModal structure and extend it. Do not create a separate modal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gradient rendering | GLSL shader pipeline | Canvas 2D createLinearGradient/createRadialGradient/createConicGradient | D-12 specifies CSS gradient rendering; Canvas 2D APIs handle all three gradient types natively |
| Icon for solo button | Custom SVG | Lucide `Headphones` icon (available in lucide-preact) | Consistent with project icon library |
| Tailwind migration | Manual file-by-file editing | Find-and-replace regex: `\[var\((--[^)]+)\)\]` to `($1)` | 332 occurrences across 33 files -- must be automated |

## Common Pitfalls

### Pitfall 1: Collapse State Reset on Sequence Switch
**What goes wrong:** Collapse state persists when switching sequences, making the new sequence appear collapsed
**Why it happens:** Using global state or forgetting to reset local state when seq.id changes
**How to avoid:** Per D-04, always auto-expand when selecting a new sequence. Reset `keyPhotoCollapsed` to `false` when `seq.id` changes. The collapse toggle only fires on second click of the SAME active sequence
**Warning signs:** Switching sequences shows collapsed key photo area

### Pitfall 2: Solo in renderGlobalFrame Purity Violation
**What goes wrong:** Adding signal reads inside renderGlobalFrame breaks its pure-function contract
**Why it happens:** Temptation to call soloStore.soloEnabled.peek() inside the render function
**How to avoid:** Pass `soloActive: boolean` as a parameter to renderGlobalFrame. The callers (Preview.tsx, exportEngine.ts) read the signal and pass it in
**Warning signs:** renderGlobalFrame imports soloStore

### Pitfall 3: Conic Gradient Browser Support
**What goes wrong:** createConicGradient may not be available in older WebView/WebKit versions
**Why it happens:** Canvas 2D createConicGradient was added in Chrome 99 (2022) and Safari 16.4 (2023). Tauri uses the system WebView
**How to avoid:** Check that the Tauri WebView version supports conic gradients. On macOS (Safari WebKit), this requires macOS 13.3+ (Safari 16.4). Add a fallback that renders conic as linear if createConicGradient is unavailable
**Warning signs:** Runtime error on older macOS versions

### Pitfall 4: Breaking renderGlobalFrame Signature
**What goes wrong:** Adding the solo parameter changes a function signature used in 4 call sites (Preview.tsx, exportEngine.ts, ExportPreview.tsx, exportRenderer.test.ts)
**Why it happens:** renderGlobalFrame is a shared pure function with multiple callers
**How to avoid:** Add `soloActive` as an optional parameter with default `false` to maintain backward compatibility. Update all 4 call sites
**Warning signs:** TypeScript compilation errors after signature change

### Pitfall 5: Tailwind Migration Breaks Inline Styles
**What goes wrong:** Regex replaces `[var(--x)]` inside inline style strings or non-Tailwind contexts
**Why it happens:** The pattern `[var(--x)]` can appear in JSX inline `style={{}}` objects
**How to avoid:** Only replace within Tailwind class strings (the `class=` or `className=` attribute context). The project uses `style={{}}` objects for most CSS variable references, which should NOT be modified. Target only patterns within string literals passed to `class`
**Warning signs:** Broken inline styles after migration

### Pitfall 6: Gradient Data in FrameEntry Propagation
**What goes wrong:** Gradient data is on KeyPhoto but not carried through to FrameEntry, so renderer cannot access it
**Why it happens:** buildSequenceFrames in exportRenderer.ts constructs FrameEntry from KeyPhoto but currently only carries solidColor and isTransparent
**How to avoid:** Extend FrameEntry to include optional `gradient?: GradientData` and propagate it in buildSequenceFrames, similar to how solidColor is spread
**Warning signs:** Gradient entries render as flat color

### Pitfall 7: Project File Version Bump
**What goes wrong:** Gradient data saved to .mce file but older versions cannot read it, or current version reads old files without gradient data and crashes
**Why it happens:** Missing backward compatibility handling
**How to avoid:** Bump version from 12 to 13. Use `serde(default)` / optional fields with conditional spread (established pattern from v10, v11 bumps). Gradient fields are optional -- older files without them deserialize cleanly
**Warning signs:** "Failed to parse project file" errors on older .mce files

## Code Examples

### Existing Collapse Mechanism (SequenceList.tsx lines 380-384)
```typescript
// Source: Application/src/components/sequence/SequenceList.tsx
<div
  class="overflow-hidden transition-[max-height] duration-150 ease-out"
  style={{
    maxHeight: isActive ? '72px' : '0px',
  }}
>
```

### Existing Solo-like Pattern: isolationStore (full file)
```typescript
// Source: Application/src/stores/isolationStore.ts
import { signal, computed } from '@preact/signals';
import { getLoopEnabled, setLoopEnabled } from '../lib/appConfig';

const isolatedSequenceIds = signal<Set<string>>(new Set());
const loopEnabled = signal(false);

export const isolationStore = {
  isolatedSequenceIds,
  loopEnabled,
  hasIsolation: computed(() => isolatedSequenceIds.value.size > 0),
  toggleIsolation(sequenceId: string) { /* ... */ },
  // ...
};
```

### Timeline Toolbar Button Pattern (TimelinePanel.tsx)
```typescript
// Source: Application/src/components/layout/TimelinePanel.tsx lines 120-131
// Loop toggle -- same pattern for solo button
<button
  class={`rounded px-2 py-[5px] cursor-pointer transition-colors ${
    isolationStore.loopEnabled.value
      ? 'bg-[var(--color-accent)] text-white hover:brightness-125'
      : 'bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white'
  }`}
  onClick={() => isolationStore.toggleLoop()}
  title={isolationStore.loopEnabled.value ? 'Loop: ON' : 'Loop: OFF'}
>
  {isolationStore.loopEnabled.value ? <Repeat1 size={14} /> : <Repeat size={14} />}
</button>
```

### Overlay Sequence Rendering (exportRenderer.ts lines 252-312)
```typescript
// Source: Application/src/lib/exportRenderer.ts
// This is the code block that solo mode will gate:
const overlaySeqs = allSeqs.filter(s => s.kind !== 'content' && s.visible !== false);
for (let i = overlaySeqs.length - 1; i >= 0; i--) {
  const overlaySeq = overlaySeqs[i];
  // ... FX and content-overlay rendering
}
```

### Key Photo Serialization Pattern (projectStore.ts)
```typescript
// Source: Application/src/stores/projectStore.ts lines 100-108
key_photos: seq.keyPhotos.map(
  (kp: KeyPhoto, kpIndex: number): MceKeyPhoto => ({
    id: kp.id,
    image_id: kp.imageId,
    hold_frames: kp.holdFrames,
    order: kpIndex,
    ...(kp.solidColor ? { solid_color: kp.solidColor } : {}),
    ...(kp.isTransparent ? { is_transparent: true } : {}),
    // Gradient will follow this exact pattern:
    // ...(kp.gradient ? { gradient: serializeGradient(kp.gradient) } : {}),
  }),
),
```

### Existing Solid Rendering in PreviewRenderer (for gradient extension)
```typescript
// Source: Application/src/lib/previewRenderer.ts lines 217-232
if (entry?.solidColor && !entry?.isTransparent) {
  // Key solid: fill canvas with solid color
  ctx.save();
  ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
  ctx.globalAlpha = effectiveOpacity;
  ctx.fillStyle = entry.solidColor;
  ctx.fillRect(0, 0, logicalW, logicalH);
  ctx.restore();
  handledAsSolid = true;
}
// Gradient extension point: check entry.gradient before solidColor,
// create Canvas 2D gradient and use as fillStyle instead
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bg-[var(--color)]` | `bg-(--color)` | Tailwind v4.0 (Jan 2025) | Parenthetical shorthand is preferred; old syntax still works but generates warnings |
| Canvas gradients (basic) | createConicGradient | Chrome 99 / Safari 16.4 (2022/2023) | Conic gradients now natively supported in Canvas 2D |

**Deprecated/outdated:**
- `[var(--custom-prop)]` in Tailwind classes: Still functional but deprecated in v4. The parenthetical `(--custom-prop)` syntax is the recommended replacement. Both produce identical CSS output.

## Discretion Recommendations

### Solo Button Icon
**Recommendation:** Use `Headphones` from lucide-preact. This is the standard DAW/NLE "solo" icon (headphones = listen to this alone). It is available in the installed lucide-preact package. Active state uses the same accent color pattern as Loop and Beat Markers buttons.

### Keyboard Shortcut for Solo
**Recommendation:** `S` key (standard solo shortcut in DAWs like Pro Tools, Logic, Ableton). Guard against text input focus to avoid conflicts with rename fields.

### Solo State Persistence
**Recommendation:** Session-only (not persisted in .mce file). Solo is a monitoring/preview tool, not a project property. Similar to how isolation state is not persisted. This avoids version bump complexity for solo and keeps the format change limited to gradient data.

### Collapse Animation
**Recommendation:** Keep the existing `transition-[max-height] duration-150 ease-out` from SequenceList.tsx line 381. It already provides smooth collapse/expand animation. No change needed.

### Gradient Picker Layout
**Recommendation:** Below the existing hue slider in ColorPickerModal, add a mode toggle (Solid | Gradient). In gradient mode: gradient type dropdown (linear/radial/conic), a gradient preview bar with draggable color stops, angle control for linear, center controls for radial/conic. Each stop opens a mini color picker (reuse the HSV area + hue slider). The modal width may need to increase slightly (from 300px to ~340px) to accommodate the gradient controls.

## Open Questions

1. **Solo and content-overlay layers**
   - What we know: D-08 says "strips ALL overlay layers (from key photos and timeline) and ALL FX (from timeline)"
   - What's unclear: Does "overlay layers" include content-overlay sequences (kind === 'content-overlay'), or only layers within a content sequence?
   - Recommendation: Solo strips BOTH content-overlay sequences AND FX sequences, plus all non-base layers within content sequences. Only base key photos render. This is the most intuitive interpretation of "only base key photos render."

2. **Solo and cross-dissolve/transitions**
   - What we know: Solo shows only base key photos
   - What's unclear: Should cross-dissolve transitions still render in solo mode? They are between base content, not overlay/FX
   - Recommendation: Keep cross-dissolves active in solo mode. They are part of the base content timeline, not layer effects.

3. **Solo and fade transitions**
   - What we know: fadeIn/fadeOut are sequence-level transitions
   - What's unclear: Should fades render in solo mode?
   - Recommendation: Keep fades active in solo mode for the same reason as cross-dissolves.

4. **Conic gradient on older macOS**
   - What we know: Tauri uses system WebKit; createConicGradient requires Safari 16.4+ (macOS 13.3+)
   - What's unclear: What is the minimum macOS version the app targets?
   - Recommendation: Add a runtime check. If createConicGradient is unavailable, fall back to a linear gradient and log a console warning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `Application/vitest.config.ts` |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENH-02 | Collapse/expand toggle logic | unit | Manual verification (UI-only, no testable logic module) | N/A -- UI behavior |
| ENH-03 | Solo store toggle/state | unit | `cd Application && npx vitest run src/stores/soloStore.test.ts -x` | Wave 0 |
| ENH-03 | Solo gating in renderGlobalFrame | unit | `cd Application && npx vitest run src/lib/exportRenderer.test.ts -x` | Exists (todos) |
| D-12 | Gradient data model serialization | unit | `cd Application && npx vitest run src/stores/projectStore.test.ts -x` | Exists |
| D-17 | Project file version bump to 13 | unit | `cd Application && npx vitest run src/stores/projectStore.test.ts -x` | Exists (version test) |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/soloStore.test.ts` -- covers soloStore toggle, state, computed
- [ ] Extend `src/lib/exportRenderer.test.ts` -- add solo-aware rendering test case

## Tailwind Migration Scope

Total occurrences of `[var(--` pattern: **332 across 33 files**

Breakdown by pattern type:
| Pattern | Count | Files |
|---------|-------|-------|
| `bg-[var(--...)]` | 168 | 29 |
| `text-[var(--...)]` | 200 | 30 |
| `ring-[var(--...)]` | 7 | 4 |
| `border-[var(--...)]` | 37 | 17 |

**Migration regex:** Within Tailwind class strings, replace pattern:
- Find: `(\w+)-\[var\((--[^)]+)\)\]`
- Replace: `$1-($2)`

**Important:** Many uses of `[var(--...)]` are INSIDE Tailwind class strings using template literals or string concatenation. The `style={{}}` objects (which also use `var()`) must NOT be modified -- they are valid CSS, not Tailwind utilities.

## Sources

### Primary (HIGH confidence)
- Codebase: `Application/src/components/sequence/SequenceList.tsx` -- collapse mechanism, SequenceItem structure
- Codebase: `Application/src/components/sequence/KeyPhotoStrip.tsx` -- key photo strip, wheel handler
- Codebase: `Application/src/stores/isolationStore.ts` -- signal-based store pattern for solo
- Codebase: `Application/src/lib/exportRenderer.ts` -- renderGlobalFrame pure function, overlay rendering
- Codebase: `Application/src/lib/previewRenderer.ts` -- solid rendering, Canvas 2D compositing
- Codebase: `Application/src/components/shared/ColorPickerModal.tsx` -- HSV picker, modal structure
- Codebase: `Application/src/components/layout/TimelinePanel.tsx` -- toolbar button layout
- Codebase: `Application/src/types/sequence.ts` -- KeyPhoto type, Sequence type
- Codebase: `Application/src/types/project.ts` -- MceKeyPhoto, MceProject types
- Codebase: `Application/src-tauri/src/models/project.rs` -- Rust MceKeyPhoto, version handling
- [Tailwind CSS Official Docs](https://tailwindcss.com/docs/adding-custom-styles) -- v4 parenthetical syntax for CSS variables

### Secondary (MEDIUM confidence)
- [Tailwind CSS v4 Breaking Changes](https://codevup.com/issues/2025-10-01-tailwind-css-v4-arbitrary-values-breaking-changes/) -- v4 arbitrary value syntax changes
- MDN Canvas 2D createConicGradient -- browser support matrix

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- all patterns directly observed in codebase
- Pitfalls: HIGH -- based on direct code analysis of existing patterns
- Tailwind migration: HIGH -- verified against official Tailwind v4 docs

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no fast-moving dependencies)

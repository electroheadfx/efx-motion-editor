# Phase 5: Editing Infrastructure - Research

**Researched:** 2026-03-03
**Domain:** Undo/redo command pattern, keyboard shortcuts, store lifecycle, unsaved-changes guards
**Confidence:** HIGH

## Summary

Phase 5 fixes three v1.0 store-lifecycle bugs (data bleed on new project, timeline/playback not reset, auto-save leak) and builds two major features: a command-pattern undo/redo system and a comprehensive keyboard shortcut layer. All pieces are well-understood — no novel technology is needed.

The command pattern for undo/redo is a classic architecture: each editing action creates a `HistoryEntry` with `undo()` and `redo()` callbacks that capture before/after state snapshots of the affected signals. The existing `historyStore` stub already has `stack` and `pointer` signals plus the `HistoryEntry` type with `undo`/`redo` callbacks — it just needs the push/undo/redo/reset logic and wiring into every editing action in `sequenceStore`.

For keyboard shortcuts, `tinykeys` v3.0.0 (650 bytes, TypeScript-native) is the decided library. It provides `$mod` for cross-platform Cmd/Ctrl mapping and returns an `unsubscribe` function. The main implementation challenge is input-field suppression (shortcuts must not fire when typing in inputs/textareas) and the JKL shuttle scrub model (DaVinci Resolve style with counter-direction deceleration and speed tiers).

**Primary recommendation:** Build undo/redo as a standalone `lib/history.ts` module with `pushAction()`, `undo()`, `redo()`, `reset()` exports, then wrap each `sequenceStore` mutation to capture before/after snapshots. Wire keyboard shortcuts in a single `lib/shortcuts.ts` using `tinykeys`, mounted once in `main.tsx`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Undoable actions: sequence edits only — add/remove/reorder key photos, change hold duration, sequence create/delete/reorder
- Project settings (fps, name, resolution) are NOT undoable — they're rare, deliberate changes
- Global undo stack across all sequences — Cmd+Z undoes the last action regardless of which sequence it was in
- No undo UI indicator — no visible undo button or counter, just Cmd+Z/Cmd+Shift+Z works
- Fresh undo stack per project — clear on New/Open/Close project
- Slider coalescing: mousedown-to-mouseup on any slider = one undo entry
- J and L counter each other on a shared speed axis — pressing opposite key decelerates before reversing (DaVinci Resolve model)
- K stops playback AND resets speed tier to zero — next L or J starts fresh at 1x
- Brief speed badge near playback controls — shows "2x", "4x" etc for ~1 second when speed changes, then fades out
- macOS-style "Save / Don't Save / Cancel" dialog when user clicks New, Open, or quits with unsaved changes
- Guard on all exit paths: New Project, Open Project, Cmd+Q, window close
- If project was never saved and user picks "Save" — open Save As file picker; if they cancel the picker, return to editor
- Use native OS dialog via Tauri's dialog API — not a custom in-app modal
- Centered dark-themed modal triggered by ? key for shortcuts overlay
- Shortcuts grouped by action type: Playback, File, Editing, Navigation
- 2-column layout for scanability
- macOS key symbols throughout: command, shift, option, delete (not text labels)
- Dismiss with Escape, click outside, or ? again (toggle)

### Claude's Discretion
- JKL speed tier values (how many tiers, exact multipliers)
- Speed badge visual design and fade animation
- Shortcuts overlay typography and spacing
- Exact implementation of keyboard event suppression in input fields
- How to handle undo stack memory (100+ levels, but implementation detail)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | App resets all stores when user creates/closes project | `closeProject()` needs to call `timelineStore.reset()`, `playbackEngine.stop()`, `stopAutoSave()`, `historyStore.reset()`, `layerStore.reset()` — all reset methods already exist |
| INFRA-02 | App calls `stopAutoSave()` on project close | `stopAutoSave()` exists in `autoSave.ts` but is never called — wire into `closeProject()` |
| INFRA-03 | User can undo any editing action with Cmd+Z (100+ levels) | Command pattern with `HistoryEntry` capturing before/after signal snapshots; existing stub in `historyStore.ts` |
| INFRA-04 | User can redo undone actions with Cmd+Shift+Z | Same command pattern — pointer-based stack navigation |
| INFRA-05 | Rapid slider/drag changes coalesce into single undo entry | `startCoalescing()`/`stopCoalescing()` pattern on mousedown/mouseup; batch intermediate changes |
| KEY-01 | Space bar toggles play/pause | `tinykeys` binding: `"Space"` calls `playbackEngine.toggle()` |
| KEY-02 | Arrow keys step one frame forward/backward | `tinykeys`: `"ArrowLeft"` / `"ArrowRight"` call `playbackEngine.stepBackward()`/`stepForward()` |
| KEY-03 | JKL variable-speed scrubbing | Custom JKL shuttle controller with speed tiers and rAF-based variable-rate tick loop |
| KEY-04 | Cmd+Z / Cmd+Shift+Z trigger undo/redo | `tinykeys`: `"$mod+KeyZ"` / `"$mod+Shift+KeyZ"` call history `undo()`/`redo()` |
| KEY-05 | Cmd+S/N/O for save/new/open | `tinykeys`: `"$mod+KeyS"` / `"$mod+KeyN"` / `"$mod+KeyO"` with unsaved-changes guard |
| KEY-06 | Delete/Backspace deletes selected item | `tinykeys`: `"Backspace"` / `"Delete"` — checks `uiStore.selectedLayerId` or selected key photo |
| KEY-07 | Shortcuts do not fire in input fields | Check `event.target` — skip if `tagName` is `INPUT`/`TEXTAREA`/`SELECT` or `contentEditable` |
| KEY-08 | ? shows keyboard shortcuts help overlay | `tinykeys`: `"Shift+/"` toggles overlay signal in `uiStore` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tinykeys | 3.0.0 | Keyboard shortcut bindings | 650B, TypeScript-native, `$mod` for cross-platform Cmd/Ctrl, returns unsubscribe fn. Already decided in STATE.md |
| @preact/signals | 2.8.1+ | Reactive state (undo snapshots, UI signals) | Already in use across all 7 stores |
| @tauri-apps/plugin-dialog | 2.6.0 (installed) | Native "Save/Don't Save/Cancel" dialog | `message()` with `buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' }` returns `MessageDialogResult` string. YesNoCancel support added in 2.4.0 |
| @tauri-apps/api | 2.10.1 (installed) | Window close intercept | `getCurrentWindow().onCloseRequested()` with `event.preventDefault()` for unsaved-changes guard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/signals batch() | (built-in) | Group signal updates for undo atomicity | Every undo/redo action applies multiple signal changes atomically |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tinykeys | hotkeys-js | Larger (3.5KB), class-based API, less ergonomic for Preact — already rejected in STATE.md |
| Custom undo | @kvndy/undo-manager | Already rejected in STATE.md — need operation-level granularity with signal snapshots |

**Installation:**
```bash
pnpm add tinykeys
```

No other new dependencies needed — dialog plugin and Tauri API are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── history.ts           # Undo/redo engine (push/undo/redo/reset/coalesce)
│   ├── shortcuts.ts          # tinykeys binding map + mount/unmount
│   ├── jklShuttle.ts         # JKL shuttle speed controller
│   ├── unsavedGuard.ts       # "Save/Don't Save/Cancel" dialog + close guard
│   ├── playbackEngine.ts     # (existing) — add variable-speed tick support
│   └── autoSave.ts           # (existing) — no changes needed
├── stores/
│   ├── historyStore.ts       # (existing stub) — flesh out with push/undo/redo
│   ├── projectStore.ts       # (existing) — fix closeProject() lifecycle
│   └── uiStore.ts            # (existing) — add shortcutsOverlayOpen signal
├── components/
│   ├── layout/
│   │   ├── EditorShell.tsx   # (existing) — render ShortcutsOverlay
│   │   └── Toolbar.tsx       # (existing) — wire unsaved-changes guards
│   └── overlay/
│       ├── ShortcutsOverlay.tsx  # ? key modal (new)
│       └── SpeedBadge.tsx       # JKL speed indicator (new)
└── main.tsx                  # Mount shortcuts listener + close guard
```

### Pattern 1: Command Pattern for Undo/Redo
**What:** Each undoable action creates a `HistoryEntry` capturing before-state and after-state snapshots of the affected signals, with `undo()`/`redo()` closures that restore those snapshots.
**When to use:** Every sequence editing mutation (add/remove/reorder key photos, change hold duration, sequence CRUD).
**Example:**
```typescript
// lib/history.ts
import { batch } from '@preact/signals';
import { historyStore } from '../stores/historyStore';

const MAX_STACK_SIZE = 200;
let coalescing = false;
let coalesceEntry: HistoryEntry | null = null;

export function pushAction(entry: HistoryEntry): void {
  if (coalescing && coalesceEntry) {
    // Update the redo of the coalescing entry (keep original undo)
    coalesceEntry.redo = entry.redo;
    return;
  }

  const { stack, pointer } = historyStore;
  // Truncate any redo entries beyond current pointer
  const newStack = stack.value.slice(0, pointer.value + 1);
  newStack.push(entry);

  // Enforce max size
  if (newStack.length > MAX_STACK_SIZE) {
    newStack.shift();
  }

  batch(() => {
    stack.value = newStack;
    pointer.value = newStack.length - 1;
  });

  if (coalescing) {
    coalesceEntry = newStack[newStack.length - 1];
  }
}

export function undo(): void {
  const { stack, pointer } = historyStore;
  if (pointer.value < 0) return;
  const entry = stack.value[pointer.value];
  entry.undo();
  pointer.value = pointer.value - 1;
}

export function redo(): void {
  const { stack, pointer } = historyStore;
  if (pointer.value >= stack.value.length - 1) return;
  pointer.value = pointer.value + 1;
  const entry = stack.value[pointer.value];
  entry.redo();
}

export function startCoalescing(): void {
  coalescing = true;
  coalesceEntry = null;
}

export function stopCoalescing(): void {
  coalescing = false;
  coalesceEntry = null;
}

export function resetHistory(): void {
  batch(() => {
    historyStore.stack.value = [];
    historyStore.pointer.value = -1;
  });
}
```

### Pattern 2: Signal Snapshot for Before/After State
**What:** Before mutating a signal, `.peek()` the current value, clone it (structuredClone or spread), then perform the mutation. The `undo()` closure restores the cloned before-value; the `redo()` closure restores the after-value.
**When to use:** Every undoable action wrapper.
**Example:**
```typescript
// Wrapping sequenceStore.addKeyPhoto with undo support
function addKeyPhotoWithUndo(sequenceId: string, imageId: string, holdFrames: number = 4) {
  const before = structuredClone(sequenceStore.sequences.peek());
  sequenceStore.addKeyPhoto(sequenceId, imageId, holdFrames);
  const after = structuredClone(sequenceStore.sequences.peek());

  pushAction({
    id: crypto.randomUUID(),
    description: 'Add key photo',
    timestamp: Date.now(),
    undo: () => { sequenceStore.sequences.value = before; },
    redo: () => { sequenceStore.sequences.value = after; },
  });
}
```

### Pattern 3: tinykeys Binding with Input-Field Suppression
**What:** Mount `tinykeys` on `window` once at app startup, return `unsubscribe` for cleanup. Each handler checks if the event target is an input field before acting.
**When to use:** All keyboard shortcuts.
**Example:**
```typescript
// lib/shortcuts.ts
import { tinykeys } from 'tinykeys';

function shouldSuppressShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function mountShortcuts(): () => void {
  return tinykeys(window, {
    'Space': (e) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      playbackEngine.toggle();
    },
    '$mod+KeyZ': (e) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      undo();
    },
    '$mod+Shift+KeyZ': (e) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      redo();
    },
    // ... more bindings
  });
}
```

### Pattern 4: Unsaved-Changes Guard with Tauri Dialog
**What:** Before destructive navigation (New/Open/Close/Quit), check `isDirty`, show native 3-button dialog, handle each result.
**When to use:** `projectStore.closeProject()`, toolbar New/Open buttons, window close event.
**Example:**
```typescript
// lib/unsavedGuard.ts
import { message } from '@tauri-apps/plugin-dialog';
import { save } from '@tauri-apps/plugin-dialog';
import { projectStore } from '../stores/projectStore';

export type GuardResult = 'saved' | 'discarded' | 'cancelled';

export async function guardUnsavedChanges(): Promise<GuardResult> {
  if (!projectStore.isDirty.value) return 'discarded'; // no changes to save

  const result = await message(
    'Do you want to save changes to this project?',
    {
      title: 'EFX Motion Editor',
      kind: 'warning',
      buttons: {
        yes: 'Save',
        no: "Don't Save",
        cancel: 'Cancel',
      },
    }
  );

  if (result === 'Yes') {
    // User wants to save
    if (!projectStore.filePath.value) {
      // Never saved — open Save As picker
      const filePath = await save({
        filters: [{ name: 'EFX Motion Project', extensions: ['mce'] }],
        defaultPath: `${projectStore.name.value}.mce`,
      });
      if (!filePath) return 'cancelled'; // User cancelled the save picker
      await projectStore.saveProjectAs(filePath);
    } else {
      await projectStore.saveProject();
    }
    return 'saved';
  }

  if (result === 'No') {
    return 'discarded'; // Don't save — proceed without saving
  }

  return 'cancelled'; // Cancel — abort the operation
}
```

### Pattern 5: Window Close Intercept
**What:** Listen for window close requests, show unsaved-changes dialog, prevent close if cancelled.
**When to use:** Mounted once in `main.tsx`.
**Example:**
```typescript
// In main.tsx
import { getCurrentWindow } from '@tauri-apps/api/window';

const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
  const result = await guardUnsavedChanges();
  if (result === 'cancelled') {
    event.preventDefault();
  }
  // 'saved' or 'discarded' — let the window close
});
```

### Pattern 6: JKL Shuttle Controller (DaVinci Resolve Model)
**What:** Maintain a speed axis state: J/L accelerate in opposite directions on a shared speed tier array. Pressing the opposite direction first decelerates, then reverses. K resets to zero.
**When to use:** JKL keyboard shortcut handlers.
**Example:**
```typescript
// lib/jklShuttle.ts
const SPEED_TIERS = [1, 2, 4, 8]; // Recommended for 15/24fps stop-motion

let currentTier = 0; // 0 = stopped, positive = forward, negative = reverse
let rafId: number | null = null;

export function pressL(): void {
  if (currentTier < 0) {
    // Decelerating from reverse
    currentTier += 1;
  } else if (currentTier < SPEED_TIERS.length) {
    currentTier += 1;
  }
  updatePlayback();
}

export function pressJ(): void {
  if (currentTier > 0) {
    // Decelerating from forward
    currentTier -= 1;
  } else if (currentTier > -SPEED_TIERS.length) {
    currentTier -= 1;
  }
  updatePlayback();
}

export function pressK(): void {
  currentTier = 0;
  playbackEngine.stop();
  // Also stop the shuttle rAF loop
}

function getSpeedMultiplier(): number {
  if (currentTier === 0) return 0;
  const absIndex = Math.abs(currentTier) - 1;
  const speed = SPEED_TIERS[Math.min(absIndex, SPEED_TIERS.length - 1)];
  return currentTier > 0 ? speed : -speed;
}
```

### Anti-Patterns to Avoid
- **Wrapping every store method with undo at definition site:** Keep store methods pure. Wrap them with undo at the call site (UI components or action layer) to avoid complex circular dependencies.
- **Using signal `.value` in rAF callbacks:** Always use `.peek()` inside rAF to avoid creating signal subscriptions in non-reactive contexts. The existing `playbackEngine.ts` already does this correctly.
- **Storing full project snapshots per undo entry:** Only snapshot the specific signal(s) that changed (e.g., `sequences.value`), not the entire project state. Keeps memory usage manageable.
- **Re-mounting tinykeys per component:** Mount once on `window` in `main.tsx` — not per component. Components register via a centralized map.
- **Calling `closeProject()` without `stopAutoSave()` first:** This is the current INT-03 bug. `stopAutoSave()` must run before store resets to prevent orphaned save timers from writing stale data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcut parsing | KeyboardEvent.code/key string parsing | `tinykeys` | Cross-platform modifier handling (`$mod`), key aliasing (`AltGraph`), sequence support — ~20 edge cases |
| Native "Save/Don't Save/Cancel" dialog | Custom HTML modal | `@tauri-apps/plugin-dialog` `message()` with `YesNoCancel` buttons | OS-native sheet appearance, proper focus management, cancel vs close handling |
| Window close intercept | `window.onbeforeunload` | `getCurrentWindow().onCloseRequested()` | Tauri's event system, not browser's; `preventDefault()` works properly in desktop context |

**Key insight:** The undo/redo system IS hand-rolled (custom command pattern), but this is the right choice since each `HistoryEntry` needs to capture signal-specific before/after state — no off-the-shelf library handles Preact Signals snapshots.

## Common Pitfalls

### Pitfall 1: Data Bleed on New Project (INT-01, the bug we're fixing)
**What goes wrong:** User creates a new project from Toolbar — previous sequences, images, timeline position, and playback state persist because `closeProject()` doesn't reset all stores.
**Why it happens:** `closeProject()` only resets `projectStore`, `sequenceStore`, `imageStore`, and `uiStore`. It does NOT call `timelineStore.reset()`, `playbackEngine.stop()`, `stopAutoSave()`, or `layerStore.reset()`.
**How to avoid:** Wire ALL store resets and engine stops into `closeProject()`. Call `closeProject()` at the start of `createProject()` and `openProject()`.
**Warning signs:** After "New Project", the timeline shows frames from the previous project. Frame counter is not at 0.

### Pitfall 2: Undo Corruption from Missing Truncation
**What goes wrong:** User undoes 3 actions, then performs a new action, then tries to redo — stale redo entries from the old branch are replayed, corrupting state.
**Why it happens:** The undo stack was not truncated at the pointer before pushing the new action.
**How to avoid:** Always `stack.slice(0, pointer + 1)` before pushing a new entry. This discards any entries beyond the current position.
**Warning signs:** Redo produces unexpected state after performing new actions post-undo.

### Pitfall 3: Undo Signal Mutation (Shallow Copy Trap)
**What goes wrong:** Undo restores state, but the restored arrays/objects are the same references as current state, so the undo appears to do nothing (or corrupts both states).
**Why it happens:** Capturing `before = sequences.peek()` without cloning — both before and after point to the same array reference that gets mutated in place.
**How to avoid:** Always `structuredClone()` when capturing signal snapshots for undo. Signal immutability pattern (spread/map to new arrays) in the existing stores helps, but explicit clone is the safe default.
**Warning signs:** Undo/redo appears to do nothing, or undoing one action undoes multiple.

### Pitfall 4: Keyboard Shortcuts Fire in Input Fields
**What goes wrong:** User types "j" in a sequence name input — JKL shuttle activates and playback starts scrubbing backward.
**Why it happens:** Global `tinykeys` listener doesn't check if the event target is an input field.
**How to avoid:** Every shortcut handler must check `shouldSuppressShortcut(event)` before acting. The helper checks `tagName` for INPUT/TEXTAREA/SELECT and `isContentEditable`.
**Warning signs:** Typing in any text input triggers playback, undo, or other shortcuts.

### Pitfall 5: Auto-Save Timer Leak (INT-03)
**What goes wrong:** Opening a second project starts a new auto-save watcher without stopping the first. Two concurrent save loops compete, writing interleaved data from different project states.
**Why it happens:** `startAutoSave()` is called in `main.tsx` but `stopAutoSave()` is never called on project close/open.
**How to avoid:** Call `stopAutoSave()` in `closeProject()`. Call `startAutoSave()` after `openProject()` or `createProject()` succeeds. Ensure `startAutoSave()` is idempotent (stops existing watchers before starting new ones).
**Warning signs:** Multiple rapid saves, file corruption, saves happening after project is closed.

### Pitfall 6: Space Key Scrolls Page
**What goes wrong:** Pressing Space to play/pause also scrolls the page down (default browser behavior for spacebar).
**Why it happens:** Space key's default action is to scroll the page. Without `preventDefault()`, both the shortcut and the default action fire.
**How to avoid:** Call `event.preventDefault()` in the Space key handler.
**Warning signs:** Page jumps/scrolls when pressing Space to toggle playback.

### Pitfall 7: JKL Counter-Direction Accumulator Drift
**What goes wrong:** During variable-speed playback, the playback engine's rAF accumulator has leftover delta from the previous speed, causing a frame burst when changing speed tiers.
**Why it happens:** Changing speed multiplier doesn't reset the time accumulator.
**How to avoid:** Reset `accumulator = 0` when speed tier changes.
**Warning signs:** Frame jumps or stutters when pressing J or L during JKL scrubbing.

### Pitfall 8: Coalescing Undo Entries Without Bounds
**What goes wrong:** User holds a slider for a long time — hundreds of intermediate `pushAction` calls flood the undo stack even though coalescing is active.
**Why it happens:** `startCoalescing()` was never called, or `stopCoalescing()` was missed on mouseup.
**How to avoid:** Always pair `startCoalescing()` on `mousedown`/`pointerdown` with `stopCoalescing()` on `mouseup`/`pointerup`. Use `window` event listeners for the "up" event to catch mouseup-outside-element cases.
**Warning signs:** One slider drag creates dozens of undo entries instead of one.

## Code Examples

Verified patterns from official sources:

### tinykeys — Basic Binding with $mod
```typescript
// Source: https://github.com/jamiebuilds/tinykeys (README)
import { tinykeys } from 'tinykeys';

const unsubscribe = tinykeys(window, {
  '$mod+KeyS': (event) => {
    event.preventDefault();
    // Meta+S on Mac, Control+S on Windows/Linux
    handleSave();
  },
  '$mod+KeyZ': (event) => {
    event.preventDefault();
    undo();
  },
  '$mod+Shift+KeyZ': (event) => {
    event.preventDefault();
    redo();
  },
});

// Cleanup when needed
unsubscribe();
```

### Tauri Dialog — YesNoCancel with Custom Labels
```typescript
// Source: https://v2.tauri.app/reference/javascript/dialog/ (official API reference)
import { message } from '@tauri-apps/plugin-dialog';
// MessageDialogResult: 'Yes' | 'No' | 'Ok' | 'Cancel' | string
const result = await message('Do you want to save changes?', {
  title: 'EFX Motion Editor',
  kind: 'warning',
  buttons: {
    yes: 'Save',
    no: "Don't Save",
    cancel: 'Cancel',
  },
});
// result === 'Yes' → user clicked "Save"
// result === 'No'  → user clicked "Don't Save"
// result === 'Cancel' → user clicked "Cancel" or closed dialog
```

### Tauri Window — Close Request Intercept
```typescript
// Source: https://v2.tauri.app/reference/javascript/api/namespacewindow/ (official API)
import { getCurrentWindow } from '@tauri-apps/api/window';

const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
  const result = await guardUnsavedChanges();
  if (result === 'cancelled') {
    event.preventDefault(); // Don't close the window
  }
});
```

### Preact Signals — batch() for Atomic Undo
```typescript
// Source: https://github.com/preactjs/signals (README)
import { batch } from '@preact/signals';

function applyUndo(entry: HistoryEntry): void {
  batch(() => {
    entry.undo(); // May set multiple signals
    // All signal subscribers notified once when batch completes
  });
}
```

### structuredClone — Deep Signal Snapshot
```typescript
// Source: MDN Web API (browser built-in, no library needed)
// Capture immutable snapshot before mutation
const before = structuredClone(sequenceStore.sequences.peek());
// ... perform mutation ...
const after = structuredClone(sequenceStore.sequences.peek());
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom key event parsing | `tinykeys` with `$mod` macro | 2020+ | Eliminates cross-platform key code handling |
| `window.onbeforeunload` | Tauri `onCloseRequested` | Tauri v2 | Desktop-native close intercept with async dialog support |
| `ask()` returning boolean | `message()` with `YesNoCancel` buttons returning string | @tauri-apps/plugin-dialog 2.4.0+ | Three-button native dialogs with custom labels |
| String-based undo descriptions | Closure-based command pattern | Standard practice | Each entry captures exact state restoration logic |

**Deprecated/outdated:**
- `okLabel`/`cancelLabel` on `MessageDialogOptions`: Deprecated since plugin-dialog 2.4.0 — use `buttons` property instead
- `window.onbeforeunload`: Does not work in Tauri context (webview, not browser tab)
- `hotkeys-js`: Viable but larger (3.5KB) and already rejected in STATE.md

## Open Questions

1. **JKL Speed Tiers: Optimal Values for Stop-Motion**
   - What we know: DaVinci Resolve uses 1x, 2x, 4x, 8x, 16x, 32x tiers. At 15fps/24fps stop-motion rates, high multipliers would jump too fast.
   - What's unclear: Whether 4 tiers (1x, 2x, 4x, 8x) or 3 tiers (1x, 2x, 4x) feels better for typical stop-motion sequences with 50-200 frames.
   - Recommendation: Start with 4 tiers `[1, 2, 4, 8]`. Easy to adjust — it's a constant array. Can be tuned based on user testing.

2. **`structuredClone` vs Spread for Undo Snapshots**
   - What we know: `structuredClone` handles nested objects/arrays correctly. Spread only does shallow copy. The `Sequence` type has nested `keyPhotos` arrays.
   - What's unclear: Performance impact of `structuredClone` on large sequences (100+ key photos per sequence, multiple sequences).
   - Recommendation: Use `structuredClone` for correctness. Performance is not a concern — undo snapshots happen on user actions (human-speed), not render loops.

3. **Undo Stack Max Size**
   - What we know: User decision says 100+ levels. Typical text editors use 100-1000.
   - What's unclear: Memory cost per entry depends on sequence complexity.
   - Recommendation: Set `MAX_STACK_SIZE = 200`. Each entry stores two `Sequence[]` snapshots (~1-5KB each). 200 entries = ~2MB worst case — negligible.

## Sources

### Primary (HIGH confidence)
- tinykeys v3.0.0 — [GitHub README](https://github.com/jamiebuilds/tinykeys) — API, syntax, $mod handling, options, version confirmed via npm registry
- @tauri-apps/plugin-dialog v2.6.0 — [Official API Reference](https://v2.tauri.app/reference/javascript/dialog/) — `message()`, `MessageDialogResult`, `YesNoCancel` buttons, custom labels
- @tauri-apps/api window — [Official API Reference](https://v2.tauri.app/reference/javascript/api/namespacewindow/) — `onCloseRequested`, `CloseRequestedEvent`, `preventDefault()`
- @preact/signals — [GitHub README](https://github.com/preactjs/signals) — `batch()`, `effect()`, disposal, nested batching
- Tauri Dialog Plugin — [Official Plugin Page](https://v2.tauri.app/plugin/dialog/) — default permissions (allow-ask, allow-confirm, allow-message, allow-open, allow-save)

### Secondary (MEDIUM confidence)
- Tauri window close patterns — [GitHub Discussion #5334](https://github.com/tauri-apps/tauri/discussions/5334) — community examples of close intercept patterns
- DaVinci Resolve JKL model — general industry knowledge, confirmed through product documentation references

### Tertiary (LOW confidence)
- None — all critical claims verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs, versions confirmed against installed packages
- Architecture: HIGH — command pattern is well-understood, existing codebase has all integration points identified, Tauri dialog API confirmed with installed version
- Pitfalls: HIGH — identified from actual codebase bugs (INT-01, INT-02, INT-03) and standard undo/redo edge cases

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — no rapidly moving dependencies)

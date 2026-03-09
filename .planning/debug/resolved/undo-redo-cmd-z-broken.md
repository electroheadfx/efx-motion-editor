---
status: resolved
trigger: "Cmd+Z or ctrl+Z (on mac) no work, I have no state reverts on any action"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: Tauri 2 default macOS native menu intercepts Cmd+Z/Cmd+Shift+Z before keydown reaches webview JS
test: Confirmed by code review -- no menu() call in lib.rs means Tauri creates default macOS Edit menu with Undo/Redo accelerators
expecting: Native menu accelerators consume the keyboard event at the Cocoa layer; JS keydown never fires
next_action: Return diagnosis

## Symptoms

expected: Pressing Cmd+Z reverts last mutation; Cmd+Shift+Z re-applies it
actual: Nothing happens -- no state revert on any action
errors: None reported
reproduction: Press Cmd+Z after any mutation (create sequence, add key photo, etc.)
started: Always broken (feature was built but never worked on macOS)

## Eliminated

- hypothesis: tinykeys binding syntax is wrong ($mod+KeyZ)
  evidence: tinykeys v3 docs confirm $mod resolves to Meta on macOS; syntax is correct
  timestamp: 2026-03-09

- hypothesis: undo/redo engine logic is broken
  evidence: Code review of history.ts shows correct pointer management, stack truncation, and batch updates. pushAction/undo/redo logic is sound.
  timestamp: 2026-03-09

- hypothesis: sequenceStore mutations don't call pushAction
  evidence: All 11 mutable methods in sequenceStore.ts call pushAction with before/after snapshots
  timestamp: 2026-03-09

- hypothesis: mountShortcuts() is never called
  evidence: main.tsx line 14 calls mountShortcuts() during app init
  timestamp: 2026-03-09

- hypothesis: Another keydown listener intercepts the event
  evidence: Grep for addEventListener('keydown') shows only ShortcutsOverlay (Escape key only). No stopPropagation on keydown events.
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: Application/src-tauri/src/lib.rs (Tauri builder setup)
  found: No .menu() call on tauri::Builder. No custom menu configuration whatsoever.
  implication: Tauri 2 on macOS auto-creates a default application menu including Edit > Undo (Cmd+Z) and Edit > Redo (Cmd+Shift+Z)

- timestamp: 2026-03-09
  checked: Application/src-tauri/Cargo.toml
  found: tauri v2 with features ["devtools", "protocol-asset"]. No "macos-private-api" or menu-related features.
  implication: Standard Tauri 2 behavior applies -- default macOS menu is active

- timestamp: 2026-03-09
  checked: Application/src/lib/shortcuts.ts lines 131-141
  found: Correct tinykeys bindings: '$mod+KeyZ' -> undo(), '$mod+Shift+KeyZ' -> redo()
  implication: JS bindings are correct but never fire because native menu captures the accelerator first

- timestamp: 2026-03-09
  checked: Application/src/lib/history.ts (full file)
  found: undo() checks pointer >= 0, calls entry.undo(), decrements pointer. redo() checks pointer < length-1, increments, calls entry.redo(). All wrapped in batch(). Logic is correct.
  implication: Engine works; the problem is upstream (events never reach it)

- timestamp: 2026-03-09
  checked: Application/src/stores/sequenceStore.ts (all mutations)
  found: All 11 mutations (createSequence, remove, duplicate, reorderSequences, rename, setSequenceFps, setSequenceResolution, addKeyPhoto, removeKeyPhoto, reorderKeyPhotos, updateHoldFrames) plus 4 layer mutations call pushAction with snapshot-based undo/redo closures
  implication: History stack is populated correctly

## Resolution

root_cause: Tauri 2 on macOS auto-creates a default native application menu with Edit > Undo (Cmd+Z) and Edit > Redo (Cmd+Shift+Z) as native menu accelerators. These accelerators intercept the keyboard shortcut at the Cocoa/AppKit layer before the keydown event reaches the WKWebView, so tinykeys never receives the event and the JS undo/redo functions never execute.
fix: empty
verification: empty
files_changed: []

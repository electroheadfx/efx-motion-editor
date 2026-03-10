---
status: resolved
trigger: "NumericInput in PropertiesPanel resets on every keystroke"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: NumericInput binds `value` directly to signal-derived prop, causing immediate store update on every keystroke which triggers re-render and overwrites the input
test: Code review of NumericInput component vs KeyPhotoStrip pattern
expecting: Direct signal binding with no local editing state
next_action: Return diagnosis

## Symptoms

expected: User can type multi-digit values (10, 1.2, 200) into numeric inputs in PropertiesPanel
actual: Input resets after each keystroke; only single-digit values can be entered
errors: No errors - silent UX failure
reproduction: Select a layer, try to type "200" in any Transform or Crop numeric input
started: Since initial implementation

## Eliminated

(none needed - root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-03-10T00:00:00Z
  checked: NumericInput component (PropertiesPanel.tsx lines 21-55)
  found: |
    - `value` prop bound directly: `value={step < 1 ? value.toFixed(2) : String(value)}`
    - `onInput` handler calls `onChange` immediately with parsed float
    - `onChange` calls `layerStore.updateLayer()` which writes to signal store
    - Signal update triggers Preact re-render, which overwrites the input value
    - No local state, no Enter/blur commit pattern, no Escape revert
  implication: Classic "controlled input bound to external reactive store" problem

- timestamp: 2026-03-10T00:00:00Z
  checked: KeyPhotoStrip.tsx lines 100-175 (existing correct pattern)
  found: |
    - Uses `useState` for local `frameValue` string
    - Uses `editingFrames` boolean to toggle between display and edit mode
    - `onInput` writes to local state only (setFrameValue)
    - `commitFrames()` validates and writes to store on Enter/blur
    - Escape reverts by setting editingFrames=false
  implication: Codebase already has the correct pattern for editable inputs

- timestamp: 2026-03-10T00:00:00Z
  checked: Rotation input (PropertiesPanel.tsx lines 156-171)
  found: Same bug - inline `<input type="number">` with direct signal binding, same as NumericInput
  implication: The rotation input also needs the same fix

## Resolution

root_cause: |
  NumericInput binds the `value` attribute directly to the signal-derived layer property.
  On every keystroke, `onInput` fires, parses the partial input, and calls `onChange` which
  updates the signal store. The signal update triggers a Preact re-render, and the re-render
  overwrites the input's value with the (now-parsed) store value.

  Example: User types "2" -> store gets 2 -> re-render sets value="2". User types "0" after
  the "2" to make "20", but the intermediate value "2" was already committed. Depending on
  cursor position and timing, the input may show "2" then "20" briefly before being overwritten,
  or parseFloat("2" + partial) may produce unexpected values for decimals.

  For decimal inputs (step < 1), it's even worse: typing "0." gets parsed as 0 by parseFloat,
  so the input resets to "0.00" before the user can type the decimal digits.

fix: (see detailed changes below)
verification: (pending implementation)
files_changed:
  - Application/src/components/layout/PropertiesPanel.tsx

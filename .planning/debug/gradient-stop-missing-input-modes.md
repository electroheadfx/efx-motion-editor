---
status: diagnosed
trigger: "gradient stop color editing only shows HSV picker, not hex/rgba/hsl input modes"
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
---

## Current Focus

hypothesis: The color input mode selector (HEX/RGBA/HSL tabs) and their corresponding input fields are wrapped in a conditional that explicitly excludes gradient mode
test: Read the JSX rendering logic for the mode tabs and mode-specific inputs
expecting: A `!isGradientMode` guard hiding these elements in gradient mode
next_action: Diagnosis complete - return root cause

## Symptoms

expected: When editing a gradient stop color, the same HEX/RGBA/HSL input modes available in solid color mode should also be available
actual: Only the HSV color area picker and hue slider are shown; no text input fields for hex, rgba, or hsl values
errors: N/A (UI omission, not a runtime error)
reproduction: Open ColorPickerModal in gradient mode, select a gradient stop - only the HSV picker area and hue slider are visible
started: Since gradient mode was implemented

## Eliminated

(none needed - root cause found on first inspection)

## Evidence

- timestamp: 2026-03-24T00:00:00Z
  checked: ColorPickerModal.tsx lines 602-692 - rendering logic for color preview, mode tabs, and input fields
  found: |
    Lines 602-611: Color preview + current/initial is wrapped in `{!isGradientMode && (...)}` - hidden in gradient mode.
    Lines 613-692: The entire mode tabs section (HEX/RGBA/HSL buttons) AND all mode-specific input fields (hex input, rgba inputs, hsl inputs) are wrapped in `{!isGradientMode && (<>...</>)}` - completely hidden in gradient mode.
    The HSV color area (lines 551-575) and hue slider (lines 577-600) are NOT guarded by any mode check, so they always render.
  implication: This is an explicit conditional exclusion. The gradient mode only gets the visual HSV picker but none of the text-based input modes.

- timestamp: 2026-03-24T00:00:00Z
  checked: Lines 544-548 - gradient mode "Selected Stop Color" label
  found: The gradient mode renders a "Selected Stop Color" label separator (line 546) right before the color area, confirming the intent is for the HSV picker to serve as the stop color editor. But no text inputs follow.
  implication: The original implementation intentionally (or by oversight) only provided the HSV picker for gradient stop editing, omitting the text input modes.

## Resolution

root_cause: |
  In ColorPickerModal.tsx, lines 613-692, the color input mode selector (HEX/RGBA/HSL tab buttons) and ALL mode-specific text input fields are wrapped inside a single `{!isGradientMode && (<>...</>)}` conditional block. This explicitly hides them whenever the user is in gradient mode. The HSV color area and hue slider (lines 551-600) are unconditional and always render, which is why only the visual picker is visible in gradient mode.

  The specific code at line 614:
  ```
  {!isGradientMode && (
    <>
      <div class="flex gap-1 items-center">
        <button ...>HEX</button>
        <button ...>RGBA</button>
        <button ...>HSL</button>
      </div>
      {/* All hex/rgba/hsl input fields */}
    </>
  )}
  ```

fix: |
  Remove the `{!isGradientMode && (...)}` guard around the mode tabs and input fields (lines 614 and 692). This will make the HEX/RGBA/HSL mode selector and their text inputs render in both solid and gradient modes. The existing wiring already handles gradient mode correctly:
  - Lines 166-176: HSV state syncs from selected gradient stop
  - Lines 179-191: HSV changes propagate back to the selected gradient stop's color
  - The commitHex, commitRgba, and commitHsl callbacks (lines 259-286) all update HSV state, which will naturally flow through to the gradient stop via the existing useEffect

  The color preview bar (lines 602-611) could optionally remain hidden in gradient mode since the gradient preview bar serves that purpose, but the mode tabs and inputs should be unconditional.

  Concretely: change line 614 from `{!isGradientMode && (` to remove the guard (or keep only the color preview guarded), and remove the matching closing `)}` at line 692.

verification: N/A (diagnosis only)
files_changed: []

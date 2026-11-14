---
phase: 261113-qjd-i-want-a-shift-shortcut-for-show-all-key
plan: 01
subsystem: ui
tags: [preact, signals, shortcuts, overlay, vitest, tdd]

requires: []
provides:
  - "Pure zero-import shortcuts catalog + context resolver module (shortcutsHelp.ts)"
  - "Context-aware Shortcuts overlay that opens on the detected surface group"
  - "Truthful Paint Mode / Timeline help rows and catalog-driven number-key routing"
affects: [shortcuts-overlay, help-catalog, paint-mode, timeline]

actuals:
  tokens: 6488
  tasks: 2
  commits: 4
plan_head_before: a3dfadfd424d8a4160f3c1d2d46b708590ce8ad5
plan_head_after: ee85ee1ef0a2236a2be8596e4342bbf0d6bd36fd

tech-stack:
  added: []
  patterns:
    - "Zero-import pure help module with a .test.ts sibling (source reads allowed via node:fs)"
    - "Open-time context seeding with lazy useState initializers reading signals once via .peek()"

key-files:
  created:
    - app/src/components/overlay/shortcutsHelp.ts
    - app/src/components/overlay/shortcutsHelp.test.ts
    - app/src/components/overlay/shortcutsOverlayContextWiring.test.ts
  modified:
    - app/src/components/overlay/ShortcutsOverlay.tsx

key-decisions:
  - "D-01 precedence: paint edit mode > timeline hover > canvas hover > Sections"
  - "Context frozen once per open with .peek() in the useState initializer (no subscriptions)"
  - "Catalog relocated verbatim (every unicode escape preserved) to a zero-import module"
  - "Number keys route through resolveShortcutsTabNumber so the range follows catalog length"

requirements-completed: [QUICK-261113-QJD]

coverage:
  - id: D1
    description: "Overlay opens on the detected surface group and shows an always-visible 'Detected:' label"
    requirement: QUICK-261113-QJD
    verification:
      - kind: unit
        ref: "app/src/components/overlay/shortcutsHelp.test.ts#resolveShortcutsContext > prefers paint edit mode over every hover region"
        status: pass
      - kind: unit
        ref: "app/src/components/overlay/shortcutsOverlayContextWiring.test.ts#context seeding > resolves the context once and seeds the active tab from it"
        status: pass
    human_judgment: true
    rationale: "Live overlay opening per surface (UAT rows 1-4) requires native UAT; the executor cannot open the app."
  - id: D2
    description: "All nine groups reachable; number keys 1..9 route through the catalog count"
    requirement: QUICK-261113-QJD
    verification:
      - kind: unit
        ref: "app/src/components/overlay/shortcutsHelp.test.ts#resolveShortcutsTabNumber > maps 1 through the group count to their group tab"
        status: pass
      - kind: unit
        ref: "app/src/components/overlay/shortcutsOverlayContextWiring.test.ts#number-key routing > carries no hardcoded group-count upper bound in the number-key branch"
        status: pass
    human_judgment: true
    rationale: "Tab/keyboard reachability in the live overlay (UAT row 5) is native-UAT territory."
  - id: D3
    description: "Auto-selectable help groups document only real bindings (Paint Mode S/X/Esc, Cmd/Ctrl+A scope; Timeline Alt+S and scroll wording)"
    requirement: QUICK-261113-QJD
    verification:
      - kind: unit
        ref: "app/src/components/overlay/shortcutsHelp.test.ts#Paint Mode catalog accuracy > documents exactly the real paint bindings, in order"
        status: pass
      - kind: unit
        ref: "app/src/components/overlay/shortcutsHelp.test.ts#Timeline catalog accuracy > names Alt+S for solo and nothing else"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shift+? remains the only overlay opener; fullscreen suppression and all other groups unchanged"
    requirement: QUICK-261113-QJD
    verification:
      - kind: unit
        ref: "app/src/components/overlay/shortcutsOverlayContextWiring.test.ts#opening binding > keeps Shift+? as the only overlay opener"
        status: pass
    human_judgment: true
    rationale: "The fullscreen-suppression row (UAT row 8) must be proven natively."

duration: ~12 min
completed: 2026-11-13
status: complete
---

# Quick 261113-qjd: Context-aware Shortcuts overlay Summary

**Shift+? now opens the help on the surface in use — paint edit mode, timeline hover, canvas hover, else the Sections index — with truthful Paint Mode and Timeline rows and number keys that follow the catalog length.**

## Performance

- **Duration:** ~12 min (measured artifacts: first RED run 18:26Z → completion 18:31Z; execution began after the plan was read at ~18:19Z)
- **Started:** 2026-11-13T18:19:00Z (approximation)
- **Completed:** 2026-11-13T18:31:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Catalog and context law extracted into a zero-import pure module (`shortcutsHelp.ts`) with `resolveShortcutsContext`, `resolveShortcutsInitialTab`, `resolveShortcutsTabNumber`, tab labels/count and the `Detected:` copy table.
- The overlay seeds its tab once per open from `paintStore.paintMode.peek()` and `uiStore.mouseRegion.peek()` and renders an always-visible "Detected: <label> — <detail>" subtitle.
- Paint Mode help repaired against the real bindings: S (select tool), X (swap foreground/background), Esc (leave paint mode), Cmd/Ctrl+A scoped to the select tool; the unbound sequence-overlay row removed.
- Timeline help corrected: solo is `Alt+S` (no bare S claim) and the plain-scroll row states the device-specific behavior.
- Number keys 1..9 route through `resolveShortcutsTabNumber`, dropping the hardcoded 1..8 bound; all nine groups remain reachable via clicks, arrows, Tab, Up/Down+Enter and number keys.

## Task Commits

Each task committed atomically:

1. **Task 1 (tracer, TDD):** `93cc317e8` (test) → `bc4bdb5c0` (feat) — zero-import catalog + context-aware overlay seeding
2. **Task 2 (auto, TDD):** `7f3800350` (test) → `ee85ee1ef` (feat) — truthful help rows + catalog-driven number keys

_Plan metadata commit is handled by the orchestrator (docs artifacts intentionally not committed by the executor)._

## TDD Gate Compliance

- **Task 1:** RED committed in `93cc317e8`, evidence `red-junit-task1.xml` / `red-evidence-task1.json` → `RED_EVIDENCE_OK`; GREEN in `bc4bdb5c0`.
- **Task 2:** RED committed in `7f3800350`, evidence `red-junit-task2.xml` / `red-evidence-task2.json` → `RED_EVIDENCE_OK`; GREEN in `ee85ee1ef`.
- Final run: 25/25 tests pass across both suites; `pnpm --prefix app run typecheck` clean.

## Files Created/Modified

- `app/src/components/overlay/shortcutsHelp.ts` — pure catalog, tab constants, context resolver, initial-tab and number-key helpers, `Detected:` copy table (zero imports).
- `app/src/components/overlay/ShortcutsOverlay.tsx` — imports the module, seeds context/tab once per open, renders the Detected subtitle, routes number keys through the helper.
- `app/src/components/overlay/shortcutsHelp.test.ts` — 16 pins: resolver precedence, tab shape, copy, catalog accuracy, number-key range, module purity.
- `app/src/components/overlay/shortcutsOverlayContextWiring.test.ts` — 9 source pins: single `.peek()` reads, single resolver call, seeded tab, label tokens, no local catalog, helper routing, unchanged Shift+? opener.

## Decisions Made

- Context is frozen for the lifetime of one open (lazy initializer + `.peek()`), matching the D-01 "read at mount" law and adding no signal subscriptions.
- The catalog moved verbatim; unicode escapes were preserved exactly (verified byte-identical after normalizing the three `export` keywords).
- Number-key bounds derive from `SHORTCUT_GROUPS.length` so future group additions need no overlay edit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The Edit/Write tooling mangles `\u....` escapes typed in parameters (converted to glyphs or doubled backslashes). The catalog was therefore spliced verbatim from the previous overlay source with a node script and verified byte-identical; the close-button `✕` escape was restored the same way.

## User Setup Required

None - no external service configuration required.

## Native UAT (automated-ready — not claimed)

1. Paint edit mode (P or pill) + Shift+? → opens on Paint Mode, header "Detected: Paint Mode — shortcuts for editing strokes".
2. Paint mode off, pointer over timeline + Shift+? → opens on Timeline with the Timeline label.
3. Pointer over canvas + Shift+? → opens on Canvas with the Canvas label.
4. Pointer in the sidebar / non-canvas, non-timeline area + Shift+? → opens on Sections index with the All shortcuts label.
5. While open, reach all nine groups via tab clicks, Left/Right, Tab, Up/Down+Enter from Sections, and number keys 1 through 9; Esc still closes.
6. Paint Mode tab: S selects the select tool, X swaps foreground/background, Esc leaves paint mode, F toggles flat/FX preview, Cmd/Ctrl+A selects all strokes (select tool), Delete removes selected strokes.
7. Timeline tab: Alt+S toggles solo; bare S does not.
8. In fullscreen, Shift+? still does not open the overlay.

## Next Phase Readiness

- Automated-ready; awaiting native UAT rows above before claiming the quick task verified.
- No stubs, no deferred issues, no scope creep: only the four planned overlay files changed since the plan base.

---
*Quick: 261113-qjd-i-want-a-shift-shortcut-for-show-all-key*
*Completed: 2026-11-13*

## Self-Check: PASSED

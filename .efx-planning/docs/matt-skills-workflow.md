# Matt Skills Workflow For EFX Planning

## Purpose

This folder is the EFX planning workspace for the Matt Pocock-style skills workflow. It replaces the failed GSD `.planning/` flow for the Physics Paint/Krita strategy work.

Use this folder for agent planning context, research, handoffs, PRDs, issue breakdowns, and prototype notes.

## Folder layout

```text
.efx-planning/
  decision-maps/
    physics-paint-strategy-decision-map.md

  research/
    krita-roundtrip.md

  docs/
    matt-skills-workflow.md

  handoffs/
    resume-physics-paint-strategy.md

  prds/
    # future PRDs, if not published directly to GitHub issues

  issues/
    # future local issue/story breakdowns, if not using GitHub issues

  prototypes/
    # notes/links to throwaway prototypes, not production code
```

## Main context file

The main planning file is:

```text
.efx-planning/decision-maps/physics-paint-strategy-decision-map.md
```

It contains:

- open decisions,
- resolved decisions,
- dependencies between decisions,
- ticket types: `Research`, `Grilling`, or `Prototype`,
- links to research assets.

This file is the equivalent mental anchor that `.planning/ROADMAP.md` provided in GSD, but it is smaller and decision-focused.

## Research context

Research assets live in:

```text
.efx-planning/research/
```

Example:

```text
.efx-planning/research/krita-roundtrip.md
```

A research file answers one decision-map ticket. It should not become a huge project plan. The decision map links to it and stores the final compact answer.

## Handoff context

Handoffs live in:

```text
.efx-planning/handoffs/
```

Current handoff:

```text
.efx-planning/handoffs/resume-physics-paint-strategy.md
```

Use handoffs when switching repos, switching Claude sessions, or preserving enough context to resume cleanly.

## When code starts

The current stage is **context and decision work**, not production implementation.

Production code should start only after:

1. The minimum decision-map tickets are resolved.
2. A PRD exists for the selected feature.
3. The PRD is split into implementation issues/stories.
4. A fresh Claude Code session runs `/implement` on one issue.

Recommended sequence for Physics Paint/Krita:

```text
1. /decision-mapping ticket paint-module-interface
2. /decision-mapping ticket krita-license-assets
3. /decision-mapping ticket roto-data-contract
4. /to-prd for Krita companion workflow
5. /to-issues to split into implementation stories
6. /implement one issue at a time
```

## Role of each skill

### `/decision-mapping`

Use for uncertain strategy work. It creates or updates a decision map.

For this project:

```text
.efx-planning/decision-maps/physics-paint-strategy-decision-map.md
```

Use it to answer one ticket per session.

### `/grilling`

Use when the blocker is a product or architecture decision that needs user answers.

Example tickets:

```text
paint-module-interface
brush-scope
native-wgpu-threshold
```

### `/domain-modeling`

Use when terminology is unclear and needs a stable glossary.

Possible terms:

```text
paint session
rendered frame
editable state
Krita exchange folder
roto reference frame
paint output
brush sample
```

If terms become stable, create or update a domain context file. Do not overload the decision map with glossary content.

### `/prototype`

Use when a runnable throwaway artifact is needed to answer a question.

Good prototype questions:

```text
Can EFX export one frame to a Krita exchange folder and reimport a PNG?
Can a Rust/WASM dirty-rect brush beat the current Canvas2D path?
```

Prototype code should be clearly marked as throwaway and either deleted or absorbed after it answers the question.

### `/to-prd`

Use when decisions are clear enough to describe a real feature.

Expected PRD example:

```text
Krita-assisted Physics Paint workflow for EFX Motion
```

Store PRDs in:

```text
.efx-planning/prds/
```

unless the skill publishes them directly to GitHub issues.

### `/to-issues`

Use after a PRD exists. It splits the PRD into implementation stories.

Store local issue breakdowns in:

```text
.efx-planning/issues/
```

unless the skill publishes them directly to GitHub issues.

### `/implement`

Use only when implementing one specific issue/story.

A good implementation session should start from:

- the PRD,
- the single issue/story,
- the decision map,
- relevant research assets.

## Comparison with GSD

| GSD | EFX/Matt skills workflow |
|---|---|
| `.planning/PROJECT.md` | `.efx-planning/decision-maps/*.md` |
| `.planning/research/*.md` | `.efx-planning/research/*.md` |
| `.planning/phases/*/PLAN.md` | `.efx-planning/prds/*.md` + `.efx-planning/issues/*.md` |
| `/gsd-plan-phase` | `/decision-mapping` then `/to-prd` |
| `/gsd-execute-phase` | `/implement` one issue at a time |
| large phase execution | small issue execution |
| centralized but heavy | lighter and decision-first |

## Current resolved decisions

### `v1-track`

Run both tracks:

- short-term Krita companion workflow,
- future embedded EFX paint renderer path.

### `krita-roundtrip`

Use a project-folder exchange workflow first:

```text
paint/krita/<session-id>/manifest.json
paint/krita/<session-id>/source/*.png
paint/krita/<session-id>/current-paint/*.png
paint/krita/<session-id>/out/*.png
```

Do not try to embed Krita as a live paint engine inside EFX Motion.

## How to reload context

From a terminal:

```bash
cd /Users/lmarques/Dev/efx-motion-editor
claude
```

Then paste:

```text
Invoke /decision-mapping with the map at .efx-planning/decision-maps/physics-paint-strategy-decision-map.md.
```

Or choose a specific ticket:

```text
Invoke /decision-mapping with the map at .efx-planning/decision-maps/physics-paint-strategy-decision-map.md, ticket paint-module-interface.
```

## Important caution

The previous GSD standalone Rust/wgpu paint lab failed during brush/material implementation. Keep that repo as research evidence, but continue planning and future implementation from `efx-motion-editor`.

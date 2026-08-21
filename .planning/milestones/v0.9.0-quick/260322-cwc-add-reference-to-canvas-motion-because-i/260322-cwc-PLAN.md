---
phase: quick
plan: 260322-cwc
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/package.json
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "@efxlab/efx-canvas-motion is listed as a dependency in package.json"
    - "README documents the canvas-motion fork relationship and its role in future templates"
  artifacts:
    - path: "Application/package.json"
      provides: "efx-canvas-motion dependency declaration"
      contains: "@efxlab/efx-canvas-motion"
    - path: "README.md"
      provides: "Documentation of the canvas-motion fork"
      contains: "efx-canvas-motion"
  key_links: []
---

<objective>
Add a reference to the @efxlab/efx-canvas-motion package in the project.

Purpose: The user forked canvas-motion to @efxlab/efx-canvas-motion. This project already uses some of it (via the @efxlab/motion-canvas-* packages), and future templates will be built on top of efx-canvas-motion. Adding the reference now establishes the dependency and documents the relationship.

Output: Updated package.json with the new dependency and README with fork documentation.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/package.json
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add @efxlab/efx-canvas-motion dependency and update README</name>
  <files>Application/package.json, README.md</files>
  <action>
IMPORTANT: Before modifying, ASK the user the following (this task cannot proceed without answers):

1. What is the npm package name? Is it `@efxlab/efx-canvas-motion` exactly, or a different name?
2. Is the package published to npm yet, or should we reference a GitHub repo (e.g., `github:electroheadfx/efx-canvas-motion`)?
3. What version or tag should be used? (e.g., `latest`, `^1.0.0`, a git branch like `main`)
4. Should it be a `dependency` or `devDependency`?

Once answered:

A) In `Application/package.json`:
   - Add `@efxlab/efx-canvas-motion` to the appropriate dependencies section with the correct version specifier.
   - If the package is not on npm, use the GitHub shorthand: `"@efxlab/efx-canvas-motion": "github:electroheadfx/efx-canvas-motion"` (adjust org/repo as provided by user).
   - Run `cd Application && pnpm install` to update the lockfile.

B) In `README.md`:
   - In the Tech Stack table, add a row referencing efx-canvas-motion, e.g.:
     `| Templates Engine | @efxlab/efx-canvas-motion (fork of canvas-motion) |`
   - Or add a brief note in a relevant section explaining that future templates will be based on this fork.
   - Keep wording concise and consistent with existing README style.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && grep "efx-canvas-motion" package.json && grep -c "efx-canvas-motion" /Users/lmarques/Dev/efx-motion-editor/README.md</automated>
  </verify>
  <done>
    - @efxlab/efx-canvas-motion appears in Application/package.json dependencies
    - README.md documents the fork and its role in future templates
    - pnpm-lock.yaml updated (if package is resolvable)
  </done>
</task>

</tasks>

<verification>
- `grep "efx-canvas-motion" Application/package.json` shows the dependency entry
- `grep "efx-canvas-motion" README.md` shows the documentation reference
- `cd Application && pnpm ls @efxlab/efx-canvas-motion` confirms installation (if package is resolvable)
</verification>

<success_criteria>
- The @efxlab/efx-canvas-motion package is referenced in package.json
- README documents the fork relationship and its purpose for future templates
- No existing dependencies are broken
</success_criteria>

<output>
After completion, create `.planning/quick/260322-cwc-add-reference-to-canvas-motion-because-i/260322-cwc-SUMMARY.md`
</output>

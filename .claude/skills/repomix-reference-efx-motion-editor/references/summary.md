This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.
The content has been processed where comments have been removed, empty lines have been removed.

# Summary

## Purpose

This is a reference codebase organized into multiple files for AI consumption.
It is designed to be easily searchable using grep and other text-based tools.

## File Structure

This skill contains the following reference files:

| File | Contents |
|------|----------|
| `project-structure.md` | Directory tree with line counts per file |
| `files.md` | All file contents (search with `## File: <path>`) |
| `tech-stacks.md` | Languages, frameworks, and dependencies per package (search with `## Tech Stack: <path>`) |
| `summary.md` | This file - purpose and format explanation |

## Usage Guidelines

- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes

- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: src-tauri/target/**, src-tauri/icons/**, dist/**, **/node_modules/**, **/dist/**, coverage/**, .planning/**, .claude/**, .codex/**, RESEARCH/**, .vscode/**, .github/**, SPECS/**, **/*.woff2, **/*.icns, **/*.ico, **/*.png, **/*.pen, **/*.jpg, **/*.jpeg, **/*.webp, **/*.gif, **/*.svg, **/*.pdf, pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb, **/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx, **/__tests__/**, **/__mocks__/**, **/*.snap, **/*.map, **/*.log, **/.next/**, **/.turbo/**, **/storybook-static/**, LICENSE, **/LICENSE, **/LICENSE.md, app/src/lib/shaders/**
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Code comments have been removed from supported file types
- Empty lines have been removed from all files
- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count
- Files are sorted by Git change count (files with more changes are at the bottom)

## Statistics

387 files | 75 912 lines

| Language | Files | Lines |
|----------|------:|------:|
| TypeScript | 184 | 34 624 |
| TypeScript (TSX) | 79 | 19 298 |
| Markdown | 76 | 15 253 |
| Rust | 23 | 2 954 |
| JSON | 11 | 570 |
| Shell | 3 | 191 |
| META | 3 | 40 |
| CSS | 3 | 2 869 |
| HTML | 2 | 24 |
| TOML | 1 | 45 |
| Other | 2 | 44 |

**Largest files:**
- `.agents/skills/repomix-reference-efx-motion-editor/references/files.md` (8 523 lines)
- `app/src/components/physic-paint/physicsPaintStudio.css` (2 224 lines)
- `app/src/components/canvas/PaintOverlay.tsx` (2 017 lines)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` (1 668 lines)
- `app/src/stores/physicPaintStore.ts` (1 282 lines)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (1 237 lines)
- `app/src/components/timeline/TimelineRenderer.ts` (1 203 lines)
- `app/src/lib/physicPaintBridge.ts` (1 124 lines)
- `app/src/components/sidebar/PaintProperties.tsx` (1 112 lines)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (1 042 lines)
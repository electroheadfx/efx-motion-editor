This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.
The content has been processed where comments have been removed, empty lines have been removed, content has been compressed (code blocks are separated by ⋮---- delimiter).

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
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count
- Files are sorted by Git change count (files with more changes are at the bottom)

## Statistics

218 files | 7 650 lines

| Language | Files | Lines |
|----------|------:|------:|
| TypeScript | 114 | 4 297 |
| TypeScript (TSX) | 65 | 1 416 |
| Rust | 17 | 1 000 |
| JSON | 9 | 305 |
| Markdown | 5 | 483 |
| META | 3 | 40 |
| CSS | 1 | 23 |
| TOML | 1 | 38 |
| HTML | 1 | 12 |
| YAML | 1 | 3 |
| Other | 1 | 33 |

**Largest files:**
- `README.md` (305 lines)
- `app/src-tauri/src/services/project_io.rs` (240 lines)
- `app/src/components/timeline/TimelineRenderer.ts` (211 lines)
- `app/src-tauri/src/lib.rs` (181 lines)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` (173 lines)
- `app/src/types/project.ts` (164 lines)
- `packages/efx-physic-paint/src/types.ts` (144 lines)
- `app/src/components/canvas/PaintOverlay.tsx` (144 lines)
- `app/src-tauri/src/services/image_pool.rs` (130 lines)
- `packages/efx-physic-paint/src/brush/paint.ts` (125 lines)
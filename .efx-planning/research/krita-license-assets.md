# Krita Source And Asset Constraints

## Question

What can EFX Motion safely learn from Krita source, Python APIs, brush presets, and bundles without accidentally copying GPL-covered code/assets into EFX Motion?

## Recommendation

Treat Krita as an external GPL application and use it through process/file exchange. Do not vendor Krita source, port GPL implementation details, or ship Krita/third-party brush assets unless each asset license is explicitly vetted.

Safe paths:

- Launch the installed Krita app, pass files/folders, and import artist-exported PNGs back into EFX Motion.
- Read Krita documentation/API pages for public behavior and write original integration code against the documented Python plugin/CLI surface.
- Build an optional Krita-side exporter plugin that runs inside Krita and writes EFX-compatible files/metadata.
- Import user-created artwork exported from Krita; GPL generally does not cover program output unless the output copies substantial protected material from the program/assets.

Risky or blocked paths:

- Do not copy, translate, or closely port Krita GPL source code into EFX Motion TypeScript/Rust/WASM/native code.
- Do not copy Krita docs/manual text into product docs or UI; docs pages are GFDL 1.3+ unless stated otherwise.
- Do not redistribute `.kpp`, `.myb`, `.bundle`, patterns, textures, palettes, or third-party Krita Artists resources without a per-asset license check.
- Do not assume bundled Krita resources all share the source-code GPL license. The repository shows mixed resource licenses.

## Findings

### Source code

The official `KDE/krita` repository reports `GNU General Public License v3.0` license metadata and includes a GPLv3 `COPYING` file. This makes direct source reuse unsuitable for EFX Motion unless the receiving component is intentionally GPL-compatible.

Use Krita source only for high-level learning: concepts, behavior observation, and non-code requirements. Avoid copying structure, constants, algorithms, shader/brush code, or translated implementations.

### Program output

The GNU GPL FAQ says program output is generally not covered by the program copyright: “The output of a program is not, in general, covered by the copyright on the code of the program.” The important exception is output that copies substantial text/art/assets from the program.

For EFX Motion, that means artist-painted PNGs from Krita are normally safe to import as user artwork, but outputs that visibly/substantially incorporate copyrighted brush textures/patterns may still inherit obligations from those asset licenses.

### Python API and plugin automation

Krita Python plugins run inside Krita. The official plugin how-to describes extensions as scripts that run on Krita start, installed under the `pykrita` resource folder with a Python module and `.desktop` metadata file. Plugins can add actions/dockers and use Krita APIs such as active document access and export.

An EFX exporter plugin should therefore be treated as a Krita-side helper, not as an embedded paint engine. If distributed, keep it optional and separately identifiable. Safest policy: license the plugin under GPLv3-compatible terms if it is shipped as a Krita plugin, or keep generated exchange metadata schemas independent from Krita implementation code.

### Brush presets and bundles

Krita brush presets (`paintoppresets`) can contain preview thumbnail, brush engine, parameters, brush tip, and possibly texture. Krita presets are `.kpp`; MyPaint brushes are `.myb`. Resource bundles are Krita’s primary sharing format and contain resources, metadata, and a manifest.

Because presets and bundles may contain textures, tips, thumbnails, and authored settings, treat them as copyrightable assets/data. EFX Motion should not import or redistribute Krita preset/bundle files by default. Let users use their own installed brushes in Krita, then import only their rendered artwork.

### Bundled/default resource licenses are mixed

Krita repository resource files show mixed licenses:

- `krita/data/README` says shipped GIMP/Krita brushes and palettes come from David Revoy / Gimp Paint Studio sources and are under Creative Commons Attribution 3.0, with specific attribution exceptions for some uses.
- `krita/data/patterns/dith_license.txt` licenses dithering/halftoning patterns under CC-BY-SA 4.0.
- Resource management docs describe bundles as shareable/importable resources, but do not make every bundle safe to redistribute.

Conclusion: do not package Krita default resources, brush bundles, or forum bundles into EFX Motion unless a future task audits exact files and records their obligations.

## Policy for implementation

1. Keep the first Krita companion workflow file-based and user-owned: EFX Motion exports context, Krita edits, EFX Motion imports PNG outputs.
2. Store no Krita source, bundled resources, or copied documentation in the EFX Motion app.
3. If a Krita plugin is built, make it an optional Krita-side exporter with original code and a clear GPL-compatible license choice.
4. Use original EFX brush presets/assets for embedded painting. If third-party brushes are desired later, create a dedicated per-bundle license audit before importing them.
5. Add a short “external Krita required; user artwork remains user artwork; bundled third-party brush assets are not redistributed” note to any product-facing Krita integration docs.

## Sources checked

- `KDE/krita` repository license metadata and `COPYING`: GPLv3.
- Krita manual: Resource Management, Brush Preset, Python Plugin How-to; documentation footer says GFDL 1.3+ unless stated otherwise.
- Krita repository resource files: `krita/data/README`, `krita/data/bundles/README`, `krita/data/patterns/dith_license.txt`, `plugins/extensions/pykrita/readme.txt`.
- GNU GPL FAQ: GPL coverage of program output.

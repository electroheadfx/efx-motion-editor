# Quick Task 260327-tqg: Fix Brush Color Picker Modal Not Opening

**Date:** 2026-03-27
**Status:** Complete

## Summary

Fixed `ReferenceError: Can't find variable: ColorPickerModal` — the component was used on line 1011 of `PaintProperties.tsx` but was never imported.

## Fix Applied

Added missing import in `Application/src/components/sidebar/PaintProperties.tsx`:

```tsx
import {ColorPickerModal} from '../shared/ColorPickerModal';
```

## Verification

```bash
grep -n "ColorPickerModal" Application/src/components/sidebar/PaintProperties.tsx
# 4:import {ColorPickerModal} from '../shared/ColorPickerModal';
# 1011:        <ColorPickerModal
```

Import present on line 4, usage on line 1011.

## Files Changed

- `Application/src/components/sidebar/PaintProperties.tsx` — added 1 import line

## Commit

`fix(quick-260327-tqg): add missing ColorPickerModal import to PaintProperties`

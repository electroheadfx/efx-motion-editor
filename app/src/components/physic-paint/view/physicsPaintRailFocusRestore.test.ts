import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stripSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const loopRailSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintLoopClipRail.tsx');
const stripSource = () => readFileSync(stripSourcePath, 'utf8');
const loopRailSource = () => readFileSync(loopRailSourcePath, 'utf8');

describe('GSD-52 loop-rail focus restore wiring (source contract)', () => {
  it('declares onRailFocus on the Loop Clip rail and calls it in onFocus', () => {
    const source = loopRailSource();
    expect(source).toContain('readonly onRailFocus?: (element: HTMLElement) => void;');
    expect(source).toContain('props.onRailFocus?.(event?.currentTarget as HTMLElement);');
  });

  it('wires the shared handleRailFocus on BOTH the Key Rail and the Loop Clip rail', () => {
    const source = stripSource();
    const keyRailBlock = source.slice(source.indexOf('<PhysicsPaintKeyRail'), source.indexOf('<PhysicsPaintLoopClipRail'));
    const loopRailBlock = source.slice(source.indexOf('<PhysicsPaintLoopClipRail'));
    expect(keyRailBlock).toContain('onRailFocus={handleRailFocus}');
    expect(loopRailBlock).toContain('onRailFocus={handleRailFocus}');
  });

  it('fires the orphan-restore effect on the loop-range derivation signal too', () => {
    const source = stripSource();
    const effectStart = source.indexOf('shouldRestoreOrphanedKeyRailFocus(lastFocused.element, document.activeElement)');
    expect(effectStart).toBeGreaterThan(-1);
    const effectBlock = source.slice(effectStart, effectStart + 400);
    expect(effectBlock).toContain('}, [keyRailSegments, loopResolutionContext]);');
  });

  it('keeps ONE shared restore predicate across both rail families', () => {
    const source = stripSource();
    const predicateImports = source.match(/shouldRestoreOrphanedKeyRailFocus/g) ?? [];
    // The import + the single effect call site — never a second predicate.
    expect(predicateImports.length).toBe(2);
  });
});

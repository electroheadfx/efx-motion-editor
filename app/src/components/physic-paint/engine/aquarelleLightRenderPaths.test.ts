// ============================================================
//  aquarelleLightRenderPaths — 64-07 (MED-17): the per-document
//  emboss light reaches EVERY render path and never enters the
//  paint.
//
//  1. LIVE      — the sheet applies the layer document's light on
//                 every frame through applyLiveConfig, read from a
//                 getter (never a second signal), so a slider
//                 gesture re-lights the wash without a stroke.
//  2. MOUNT     — the canvas mount forwards the getter through a
//                 ref, like every other aquarelle seam.
//  3. RESOLVE   — the Studio reads the ACTIVE layer document's
//                 light at call time: the same getter reaches the
//                 canvas mount and a light value reaches all three
//                 bake call sites.
//  4. STORE     — both reveal render entry points carry
//                 `light: document.light`: the layer id is the
//                 resolution key, never a copied prop.
//  5. SIGNATURE — the content fingerprint carries the light term,
//                 so a cached artifact keyed on it can never serve
//                 pixels lit by a superseded light, and a missing
//                 light and the explicit default never alternate.
//  6. NO LEAK   — no stroke payload or params-bag construction
//                 site mentions the light: it is render state.
//
//  Pins assert booleans (not `toContain`) so a failure reports one
//  line instead of dumping the whole source file.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import * as studioSettings from './physicsPaintStudioSettings';

const layer = readFileSync(resolve(__dirname, './AquarelleCanvasLayer.tsx'), 'utf8');
const mount = readFileSync(resolve(__dirname, './PhysicsPaintCanvasMount.tsx'), 'utf8');
const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const store = readFileSync(resolve(__dirname, '../../../stores/physicPaintStore.ts'), 'utf8');

const applyLiveConfigBody = layer.slice(
  layer.indexOf('function applyLiveConfig('),
  layer.indexOf('export function AquarelleCanvasLayer('),
);

const has = (haystack: string, needle: string): boolean => haystack.includes(needle);
const count = (haystack: string, needle: RegExp): number => haystack.match(needle)?.length ?? 0;

// The formatter is a pure settings-model helper (importable in the node test
// env); the Studio module itself is source-pinned, never imported.
const lightSignatureOf = (studioSettings as unknown as {
  lightSignature?: (
    light: { azimuth: number; elevation: number; intensity: number } | undefined,
  ) => string;
}).lightSignature;

describe('aquarelle light render paths (64-07, MED-17)', () => {
  it('LIVE: the sheet applies the light inside applyLiveConfig, from a getter ref', () => {
    // The prop is a GETTER — a value prop would freeze the light at mount.
    expect(has(layer, 'getLight?: () => LightSettings | undefined;')).toBe(true);
    // The ref-assignment idiom: every render refreshes the getter; the sheet
    // never keeps a light copy (the document is the one source).
    expect(has(layer, 'const getLightRef = useRef(props.getLight);')).toBe(true);
    expect(has(layer, 'getLightRef.current = props.getLight;')).toBe(true);
    // Both the mount call and the per-frame call pass the LIVE getter — and the
    // 64-21 recorded-paper-seed getter beside it, so the sheet paints on the
    // grain the document records.
    expect(
      count(layer, /applyLiveConfig\(engine, getLightRef\.current, getPaperSeedRef\.current\)/g),
    ).toBe(2);
    // The apply itself: read the getter, only a present light writes. The
    // engine's compare-then-write setLight owns the bands and the no-op, so a
    // per-frame call costs three numeric comparisons and nothing else.
    expect(has(applyLiveConfigBody, 'const light = getLight?.();')).toBe(true);
    expect(has(applyLiveConfigBody, 'if (light) engine.setLight(light);')).toBe(true);
    // Never a second light signal — no render-path mirror of the document.
    expect(/const\s+\w*[Ll]ight\w*\s*=\s*signal\(/.test(layer)).toBe(false);
  });

  it('MOUNT: the canvas mount forwards the light getter through a ref', () => {
    expect(has(mount, 'getAquarelleLight?: () => LightSettings | undefined;')).toBe(true);
    expect(has(mount, 'const getAquarelleLightRef = useRef(props.getAquarelleLight);')).toBe(true);
    expect(has(mount, 'getAquarelleLightRef.current = props.getAquarelleLight;')).toBe(true);
    // The layer receives a getter, never a value — the mount memo stays stable.
    expect(has(mount, 'getLight={() => getAquarelleLightRef.current?.()}')).toBe(true);
  });

  it('RESOLVE: the Studio reads the ACTIVE layer document and passes it everywhere', () => {
    // Resolved at call time by the active layer id — never a copied prop and
    // never a project-wide light.
    expect(has(studio, 'const layerId = launchContextRef.current?.layerId;')).toBe(true);
    expect(has(studio, 'return layerId ? getEfxPaintDocument(layerId)?.light : undefined;')).toBe(true);
    // The canvas mount receives the getter …
    expect(has(studio, 'getAquarelleLight: documentLight,')).toBe(true);
    // … and every consumer receives the resolved value: the Apply bake, the two
    // lift-erase recovery bakes, plus the 64-09 right-panel prop (which sits
    // beside `onLightChange` and is not a bake).
    expect(count(studio, /light: documentLight\(\),/g)).toBe(4);
  });

  it('RESOLVE: the Studio owns the ONE light write and its one ledger entry', () => {
    expect(has(studio, 'setDocumentLight(layerId, patch)')).toBe(true);
    expect(has(studio, 'rotoMoveHistory.recordBackgroundEdit(result.descriptor)')).toBe(true);
  });

  it('STORE: both reveal render entry points carry the document light', () => {
    // commitRevealBake and renderRevealTailFrames already load the document on
    // their first line — the light is read at render time, not threaded in.
    expect(count(store, /light: document\.light,/g)).toBe(2);
  });

  it('SIGNATURE: the Studio content fingerprint carries the light term', () => {
    expect(has(studio, '|${lightSignature(documentLight())}')).toBe(true);
  });

  it('SIGNATURE BEHAVIOR: two triples differ; the same triple twice is one', () => {
    expect(typeof lightSignatureOf).toBe('function');
    if (!lightSignatureOf) {
      throw new Error('lightSignature must be exported by physicsPaintStudioSettings');
    }
    const a = lightSignatureOf({ azimuth: 12, elevation: 34, intensity: 1 });
    const b = lightSignatureOf({ azimuth: 200, elevation: 30, intensity: 2 });
    expect(a).not.toBe(b);
    expect(lightSignatureOf({ azimuth: 12, elevation: 34, intensity: 1 })).toBe(a);
    // A missing light and the explicit engine default render the SAME pixels,
    // so they must never alternate between two signatures.
    expect(lightSignatureOf(undefined)).toBe('default');
    expect(lightSignatureOf({ ...DEFAULT_LIGHT })).toBe('default');
  });

  it('NO LEAK: no stroke payload or params-bag construction site mentions the light', () => {
    // The layer's two recorded-stroke literals (hand-painted + vector commit)
    // are the ONLY payload constructors on these render paths.
    const recordSites = [...layer.matchAll(/onStrokeEndRef\.current\?\.\(stroke\)/g)].map((match) => {
      const callIndex = match.index ?? 0;
      const start = layer.lastIndexOf('const stroke', callIndex);
      return layer.slice(start, callIndex);
    });
    expect(recordSites).toHaveLength(2);
    for (const site of recordSites) {
      // The slice really is the stroke literal (the params bag rides it) …
      expect(has(site, 'params: { ...snap.params }')).toBe(true);
      // … and it never carries the render-only light.
      expect(/\blight\b/.test(site)).toBe(false);
    }
    // Neither the Studio nor the store constructs a params bag, so there is no
    // other place for the light to leak into paint.
    expect(has(studio, 'params: {')).toBe(false);
    expect(has(store, 'params: {')).toBe(false);
  });
});

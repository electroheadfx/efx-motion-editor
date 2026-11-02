import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// MOD-03 / D-24 (quick 261027-klx — the single-engine world): the Studio
// script, bake cache, and timeline are ONE shared engine path for every module,
// never forked per module. These pins go RED the moment a module branch or a
// second engine factory lands in the Play Script path.
//
// Family: src/lib/paperPass.frameGuard.test.ts — a normal source-scan .test.ts,
// no new config. Comments are stripped so prose may name the very identifiers
// these pins forbid without weakening them.

const controllerSource = readFileSync(
  new URL('./physicsPaintRotoPlayScriptController.ts', import.meta.url),
  'utf8',
);
const rendererSource = readFileSync(
  new URL('./physicsPaintRotoPlayScriptRenderer.ts', import.meta.url),
  'utf8',
);
const rotoFiles = readdirSync(new URL('.', import.meta.url));

/**
 * Remove `//` and block comments while leaving string and template literals
 * untouched. A plain regex is unsafe here: a stripped `//` inside a string
 * would truncate real code and turn the pins below vacuous.
 */
function stripComments(source: string): string {
  let output = '';
  let index = 0;
  let quote: string | null = null;
  while (index < source.length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);
    if (quote !== null) {
      output += char;
      if (char === '\\' && index + 1 < source.length) {
        output += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      output += char;
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source.charAt(index) !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source.charAt(index) === '*' && source.charAt(index + 1) === '/')) index += 1;
      index += 2;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const controllerCode = stripComments(controllerSource);
const rendererCode = stripComments(rendererSource);

describe('MOD-03 / D-24 — one shared Studio engine, never forked per module', () => {
  it('control: both sources are the real code, not an over-stripped shell', () => {
    // Non-vacuity guard: a broken stripper must not make the absence pins below
    // pass by deleting the files.
    expect(controllerCode.length).toBeGreaterThan(controllerSource.length * 0.5);
    expect(rendererCode.length).toBeGreaterThan(rendererSource.length * 0.5);
    expect(controllerCode).toContain('export function isRevealRunKind(');
    expect(rendererCode).toContain('export async function renderRotoRevealFrames(');
  });

  it('the Play Script path carries no per-module branch (no activeModule anywhere)', () => {
    // `activeModule` is the module-identity signal. If the script/cache/timeline
    // ever forked per module, this is the branch that would appear here.
    expect(controllerCode).not.toMatch(/activeModule/);
    expect(rendererCode).not.toMatch(/activeModule/);
  });

  it('the script path builds engine 2 only — never engine 1 or a second factory', () => {
    // Engine choice lives in the module switcher (D-14); the script path always
    // speaks @efxlab/efx-watercolor.
    expect(controllerCode).not.toContain('@efxlab/efx-physic-paint');
    expect(rendererCode).not.toContain('@efxlab/efx-physic-paint');
    expect(controllerCode).not.toMatch(/EfxPaintEngine/);
    expect(rendererCode).not.toMatch(/EfxPaintEngine/);
    expect(controllerCode).toContain("await import('@efxlab/efx-watercolor')");
    expect(controllerCode).toContain("from '@efxlab/efx-watercolor/bake'");
    expect(rendererCode).toContain("import('@efxlab/efx-watercolor')");
    expect(rendererCode).toContain("import('@efxlab/efx-watercolor/bake')");
    // No second engine family may be constructed in this path.
    const secondEngineFactory = /create(?:Physic|Brush|Spectr|Krita)\w*Engine(?:Adapter|Bake)?\s*\(/;
    expect(controllerCode).not.toMatch(secondEngineFactory);
    expect(rendererCode).not.toMatch(secondEngineFactory);
  });

  it('the controller owns exactly ONE lazy engine-adapter factory site', () => {
    // Call-site counts, not occurrence-anywhere: a second `createAquarelleEngineAdapter(`
    // construction is a per-module fork even if both import the same package.
    expect(occurrences(controllerCode, 'createAquarelleEngineAdapter(')).toBe(1);
    expect(occurrences(controllerCode, "await import('@efxlab/efx-watercolor')")).toBe(1);
    expect(occurrences(controllerCode, 'async function createDefaultAquarelleAdapter(')).toBe(1);
  });

  it('the renderer owns exactly ONE bake-cache construction site', () => {
    expect(occurrences(rendererCode, 'createAquarelleBake(')).toBe(1);
    expect(occurrences(rendererCode, 'const bake = createAquarelleBake(adapter,')).toBe(1);
    // The controller resolves ONE bake queue: the injected port or the
    // engine-2 default — never a second flush/cache queue.
    expect(occurrences(controllerCode, 'createAquarelleBake as defaultCreateAquarelleBake')).toBe(1);
    expect(occurrences(controllerCode, 'ports.createAquarelleBake ?? defaultCreateAquarelleBake')).toBe(1);
  });

  it('the shared script/cache path exists at ONE file site in the tree', () => {
    // A per-module fork would land as a sibling controller/renderer file.
    expect(rotoFiles.filter((name) => name.endsWith('PlayScriptController.ts'))).toEqual([
      'physicsPaintRotoPlayScriptController.ts',
    ]);
    expect(rotoFiles.filter((name) => name.endsWith('PlayScriptRenderer.ts'))).toEqual([
      'physicsPaintRotoPlayScriptRenderer.ts',
    ]);
    const forked = rotoFiles.filter(
      (name) => name.includes('PlayScript') && /(?:Watercolor|WaterColour|Brush|Krita)/i.test(name),
    );
    expect(forked).toEqual([]);
  });
});

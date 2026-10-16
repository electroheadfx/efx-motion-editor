import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, it, expect} from 'vitest';

/**
 * TS ↔ Rust .mce field-diff contract (261012-d6q dual-language law).
 *
 * `open_project` deserializes through serde, which silently drops any key the
 * Rust struct does not name. So a field TS emits and Rust omits is lost on
 * every save → close → reopen, and a field Rust declares and TS never emits is
 * dead weight (or a TS-side omission). Both directions are bugs.
 *
 * This test parses BOTH declaration surfaces and diffs the wire keys per .mce
 * member. Adding a field to one language only fails here — which is the point.
 *
 * Allowlist carries the one intentional asymmetry, with its reason.
 */

// ---------------------------------------------------------------------------
// Parsers — enough of each language to read field declarations + serde renames
// ---------------------------------------------------------------------------

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** structName → (rustFieldName → wireName, i.e. after `#[serde(rename)]`) */
function parseRustStructs(src: string): Map<string, Map<string, string>> {
  const clean = stripComments(src);
  const out = new Map<string, Map<string, string>>();
  const structRe = /pub struct (\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = structRe.exec(clean)) !== null) {
    const name = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      i++;
    }
    out.set(name, parseRustFields(clean.slice(start, i - 1)));
  }
  return out;
}

function parseRustFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  // Attribute block(s) followed by `pub name:`. Attributes carry the serde rename.
  const fieldRe = /((?:#\[[^\]]*\]\s*)*)pub (\w+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    const attrs = m[1];
    const rustName = m[2];
    const rename = /rename\s*=\s*"([^"]+)"/.exec(attrs);
    fields.set(rustName, rename ? rename[1] : rustName);
  }
  return fields;
}

/** interfaceName → wire field names */
function parseTsInterfaces(src: string): Map<string, Set<string>> {
  const clean = stripComments(src);
  const out = new Map<string, Set<string>>();
  const ifaceRe = /export interface (\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = ifaceRe.exec(clean)) !== null) {
    const name = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      i++;
    }
    out.set(name, parseTsFields(clean.slice(start, i - 1)));
  }
  return out;
}

function parseTsFields(body: string): Set<string> {
  const fields = new Set<string>();
  let depth = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(trimmed);
      if (m) fields.add(m[1]);
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// The two declaration surfaces
// ---------------------------------------------------------------------------

const RUST_SRC = readFileSync(
  fileURLToPath(new URL('../../src-tauri/src/models/project.rs', import.meta.url)),
  'utf8',
);
const TS_SOURCES = [
  readFileSync(fileURLToPath(new URL('../types/project.ts', import.meta.url)), 'utf8'),
  readFileSync(fileURLToPath(new URL('../types/audio.ts', import.meta.url)), 'utf8'),
].join('\n');

/**
 * Intentional one-language fields. Anything else appearing on one side only is
 * a drop-hole and fails this contract.
 *
 * - `MceSequence.fps` (Rust-only): 53.1-01 retired per-sequence fps on the TS
 *   side (project fps is the only timebase). Rust keeps it `#[serde(default)]`
 *   so a pre-53.1 manifest still parses. No TS reader touches it.
 */
const ALLOWED_ONE_LANGUAGE = new Set([
  'MceSequence.fps',
]);

function diffMember(name: string, tsKeys: Set<string>, rustKeys: Set<string>): string[] {
  const problems: string[] = [];
  for (const key of tsKeys) {
    if (!rustKeys.has(key) && !ALLOWED_ONE_LANGUAGE.has(`${name}.${key}`)) {
      problems.push(
        `${name}.${key}: TS declares it but Rust does not — serde drops it on open (emitted-but-not-declared)`,
      );
    }
  }
  for (const key of rustKeys) {
    if (!tsKeys.has(key) && !ALLOWED_ONE_LANGUAGE.has(`${name}.${key}`)) {
      problems.push(
        `${name}.${key}: Rust declares it but TS does not — TS can never emit it (declared-but-not-emitted)`,
      );
    }
  }
  return problems;
}

describe('TS ↔ Rust .mce field-diff contract', () => {
  const rust = parseRustStructs(RUST_SRC);
  const ts = parseTsInterfaces(TS_SOURCES);

  it('parses both declaration surfaces', () => {
    expect(rust.size).toBeGreaterThan(10);
    expect(ts.size).toBeGreaterThan(10);
    // Sanity: the parser really sees the members this contract is about.
    for (const name of ['MceProject', 'MceSequence', 'MceLayerSource', 'MceKeyframeValues']) {
      expect(rust.has(name), `Rust parser missed ${name}`).toBe(true);
      expect(ts.has(name), `TS parser missed ${name}`).toBe(true);
    }
  });

  it('declares the same set of .mce members in both languages', () => {
    const rustMembers = new Set([...rust.keys()].filter((n) => n.startsWith('Mce')));
    const tsMembers = new Set([...ts.keys()].filter((n) => n.startsWith('Mce')));
    const onlyTs = [...tsMembers].filter((n) => !rustMembers.has(n));
    const onlyRust = [...rustMembers].filter((n) => !tsMembers.has(n));
    expect(onlyTs, `TS-only .mce members: ${onlyTs.join(', ')}`).toEqual([]);
    expect(onlyRust, `Rust-only .mce members: ${onlyRust.join(', ')}`).toEqual([]);
  });

  it('agrees on every wire key of every .mce member', () => {
    const problems: string[] = [];
    for (const [name, rustFields] of rust) {
      if (!name.startsWith('Mce')) continue;
      const tsKeys = ts.get(name);
      if (!tsKeys) continue; // covered by the member-set test
      const rustKeys = new Set(rustFields.values());
      problems.push(...diffMember(name, tsKeys, rustKeys));
    }
    expect(problems, `Field-diff contract violations:\n${problems.join('\n')}`).toEqual([]);
  });

  it('catches a field declared in only one language (self-test of the diff)', () => {
    // Proves the comparison is live, not vacuously green.
    const problems = diffMember(
      'MceSelfTest',
      new Set(['both', 'ts_only']),
      new Set(['both', 'rust_only']),
    );
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toContain('MceSelfTest.ts_only');
    expect(problems.join('\n')).toContain('MceSelfTest.rust_only');
    // The allowlist really suppresses exactly its entry.
    expect(diffMember('MceSequence', new Set(), new Set(['fps']))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 56 field set (DATA-04 / D-27 / MOD-04)
//
// Four new .mce field groups join the dual-language law in this phase:
//   1. paper display state on the fond (id, strength, scale) — PAPER-03 / D-22
//   2. aquarelle brush properties (the 8-field per-brush surface) — AQUA-03 / R1.7
//   3. per-engine stroke payload in the envelope (opaque engine slot) — HOST-02
//   4. brush-pack snapshot (D-23 inline .mce data) — NOT a one-language field
//
// Each group is a named Mce* member in BOTH languages. The generic wire-key
// diff above covers key-set equality; these rows pin the member names and the
// exact keys the phase's feature block enumerates, so a rename cannot silently
// drop a group out of the contract.
// ---------------------------------------------------------------------------

describe('Phase 56 .mce field set (DATA-04 / D-27)', () => {
  const rust = parseRustStructs(RUST_SRC);
  const ts = parseTsInterfaces(TS_SOURCES);

  function expectMemberKeys(name: string, keys: readonly string[]): void {
    expect(ts.has(name), `TS parser missed ${name}`).toBe(true);
    expect(rust.has(name), `Rust parser missed ${name}`).toBe(true);
    const tsKeys = ts.get(name)!;
    const rustKeys = new Set(rust.get(name)!.values());
    for (const key of keys) {
      expect(tsKeys.has(key), `${name}.${key}: TS side is missing the key`).toBe(true);
      expect(rustKeys.has(key), `${name}.${key}: Rust side is missing the key`).toBe(true);
    }
    // And no missing keys on either side for this member (the four groups must
    // be complete two-language declarations, not partial sketches).
    const problems = diffMember(name, tsKeys, rustKeys);
    expect(problems, `${name} field-diff violations:\n${problems.join('\n')}`).toEqual([]);
  }

  it('declares paper display state on the fond (id, strength, scale) in both languages', () => {
    // PAPER-03 / D-22: paper id + strength + scale ride the document fond.
    expectMemberKeys('McePaperDisplayState', ['id', 'strength', 'scale']);
  });

  it('declares the aquarelle brush property surface in both languages', () => {
    // AQUA-03 / R1.7 / D-08: the 8 per-brush multipliers.
    expectMemberKeys('MceAquarelleBrushProperties', [
      'tip', 'aspect', 'rotation', 'sizeCurve', 'scatter', 'capacity', 'grain', 'wetRound',
    ]);
  });

  it('declares the per-engine stroke payload carrier (opaque engine slot) in both languages', () => {
    // HOST-02 / D-19: the envelope's per-stroke engine payload slot.
    expectMemberKeys('MceEngineStrokePayload', ['engine']);
  });

  it('declares the brush-pack snapshot in both languages (D-23 inline .mce data)', () => {
    // MOD-04 / D-23: kind + entries travel IN the .mce as inline data.
    expectMemberKeys('MceBrushPackSnapshot', ['kind', 'entries']);
  });

  it('brushPack is NOT an ALLOWED_ONE_LANGUAGE entry (D-23 two-language by design)', () => {
    for (const entry of ALLOWED_ONE_LANGUAGE) {
      expect(entry.toLowerCase()).not.toContain('brushpack');
      expect(entry.toLowerCase()).not.toContain('brush_pack');
    }
  });
});

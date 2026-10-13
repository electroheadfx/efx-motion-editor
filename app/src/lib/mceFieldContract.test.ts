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

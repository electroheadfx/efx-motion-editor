/**
 * 52.2-11 Task 2 (D-03, T-52.2-39): the document-type declaration contract.
 *
 * The `.mce` package is declared to macOS exactly once, in the hand-authored
 * `app/src-tauri/Info.plist`. Tauri merges that file into the generated bundle
 * plist as a SHALLOW top-level overwrite, so a second partial declaration in
 * `tauri.conf.json` (`bundle.fileAssociations`) would silently erase the
 * package flag — this test is what keeps the two files from diverging.
 *
 * `tauri dev` carries no Info.plist, so nothing here can be verified by a dev
 * run: the Finder icon, the double-click and the rfd dialog treatment are
 * measured in plan 16's bundled UAT. What IS machine-checkable is that the
 * declaration parses, says the right thing, and stays in one place.
 *
 * `plutil` is the authoritative XML/plist reader and only exists on macOS, so
 * the structural probes are darwin-guarded (the repo runs no CI; the local
 * machine is the only judge). The portable assertions cover the same facts as
 * text, so a non-macOS run still fails on a dropped key.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TAURI_DIR = join(APP_DIR, 'src-tauri');
const INFO_PLIST_PATH = join(TAURI_DIR, 'Info.plist');
const TAURI_CONFIG_PATH = join(TAURI_DIR, 'tauri.conf.json');

const PROJECT_UTI = 'com.efxlab.motion-editor.project';

const infoPlist = readFileSync(INFO_PLIST_PATH, 'utf8');
const tauriConfig = JSON.parse(readFileSync(TAURI_CONFIG_PATH, 'utf8')) as {
  bundle?: { icon?: string[]; macOS?: { hardenedRuntime?: boolean }; fileAssociations?: unknown };
};

/** How many times a `<key>NAME</key>` entry appears anywhere in the plist. */
function countKeyOccurrences(plist: string, key: string): number {
  return plist.split(`<key>${key}</key>`).length - 1;
}

/** Every JSON key path in a parsed document, for structural "must not exist" probes. */
function collectKeyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
      prefix === '' ? key : `${prefix}.${key}`,
      ...collectKeyPaths(child, prefix === '' ? key : `${prefix}.${key}`),
    ]);
  }
  return [];
}

/** `plutil -convert json` — macOS's own parse of the file, as structured data. */
function plistAsJson(path: string): Record<string, unknown> {
  const raw = execSync(`plutil -convert json -o - ${JSON.stringify(path)}`, { encoding: 'utf8' });
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('package association contract', () => {
  it('ships the declaration in the hand-authored Info.plist, as a well-formed plist document', () => {
    expect(existsSync(INFO_PLIST_PATH), 'app/src-tauri/Info.plist exists').toBe(true);
    expect(infoPlist.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(infoPlist).toContain('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"');
    expect(infoPlist).toContain('<plist version="1.0">');
  });

  it.runIf(process.platform === 'darwin')('passes `plutil -lint` and parses through `plutil -convert json`', () => {
    const lint = execSync(`plutil -lint ${JSON.stringify(INFO_PLIST_PATH)}`, { encoding: 'utf8' });
    expect(lint.trim()).toMatch(/: OK$/);
    const parsed = plistAsJson(INFO_PLIST_PATH);
    expect(parsed.CFBundleDocumentTypes).toBeDefined();
    expect(parsed.UTExportedTypeDeclarations).toBeDefined();
  });

  it.runIf(process.platform === 'darwin')('declares the package flag with the editor role and owner rank', () => {
    const root = plistAsJson(INFO_PLIST_PATH);
    const documentType = (root.CFBundleDocumentTypes as Array<Record<string, unknown>>)[0];
    expect(documentType.CFBundleTypeName).toBe('EFX Motion Project');
    expect(documentType.CFBundleTypeRole).toBe('Editor');
    expect(documentType.LSHandlerRank).toBe('Owner');
    expect(documentType.LSTypeIsPackage).toBe(true);
    expect(documentType.CFBundleTypeExtensions).toEqual(['mce']);
    expect(documentType.LSItemContentTypes).toEqual([PROJECT_UTI]);
  });

  it('declares LSTypeIsPackage as `<true/>` and the mce extension in text form', () => {
    expect(countKeyOccurrences(infoPlist, 'CFBundleDocumentTypes')).toBe(1);
    expect(countKeyOccurrences(infoPlist, 'LSTypeIsPackage')).toBe(1);
    expect(infoPlist).toMatch(/<key>LSTypeIsPackage<\/key>\s*<true\/>/);
    expect(infoPlist).toMatch(/<key>CFBundleTypeExtensions<\/key>\s*<array>\s*<string>mce<\/string>/);
    expect(infoPlist).toMatch(/<key>CFBundleTypeRole<\/key>\s*<string>Editor<\/string>/);
    expect(infoPlist).toMatch(/<key>LSHandlerRank<\/key>\s*<string>Owner<\/string>/);
  });

  it('declares the exported UTI once, conforming to com.apple.package, and references it from the document type', () => {
    expect(countKeyOccurrences(infoPlist, 'UTExportedTypeDeclarations')).toBe(1);
    expect(countKeyOccurrences(infoPlist, 'UTTypeIdentifier')).toBe(1);
    expect(infoPlist).toMatch(/<key>UTTypeConformsTo<\/key>\s*<array>\s*<string>com\.apple\.package<\/string>/);
    expect(infoPlist.split(PROJECT_UTI).length - 1).toBeGreaterThanOrEqual(2);
    expect(infoPlist).toMatch(/<key>public\.filename-extension<\/key>\s*<array>\s*<string>mce<\/string>/);
  });

  it.runIf(process.platform === 'darwin')('exports exactly the UTI the document type declares', () => {
    const root = plistAsJson(INFO_PLIST_PATH);
    const exported = (root.UTExportedTypeDeclarations as Array<Record<string, unknown>>)[0];
    expect(exported.UTTypeIdentifier).toBe(PROJECT_UTI);
    expect(exported.UTTypeConformsTo).toEqual(['com.apple.package']);
    expect(exported.UTTypeTagSpecification).toEqual({ 'public.filename-extension': ['mce'] });
    const documentType = (root.CFBundleDocumentTypes as Array<Record<string, unknown>>)[0];
    expect(documentType.LSItemContentTypes).toContain(exported.UTTypeIdentifier);
  });

  it('keeps tauri.conf.json free of a second declaration', () => {
    const rawConfig = readFileSync(TAURI_CONFIG_PATH, 'utf8');
    expect(rawConfig.includes('fileAssociations'), 'raw tauri.conf.json text').toBe(false);
    expect(collectKeyPaths(tauriConfig)).not.toContain('bundle.fileAssociations');
  });

  it('keeps the signed-release settings and only references declared bundle icon assets', () => {
    expect(tauriConfig.bundle?.macOS?.hardenedRuntime).toBe(true);
    const iconAsset = infoPlist.match(/<key>CFBundleTypeIconFile<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    if (iconAsset !== undefined) {
      expect(tauriConfig.bundle?.icon ?? []).toContain(iconAsset);
    }
  });
});

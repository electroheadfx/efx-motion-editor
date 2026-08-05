import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure fs/JSON/text contract assertions for the v0.8.1 macOS packaging hotfix —
// no build, no special timeout needed.

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');
const TAURI_DIR = join(APP_DIR, 'src-tauri');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'macos-release.sh');

const EXPECTED_ICONS = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.icns',
  'icons/icon.ico',
];

const packageJson = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as { version: string };
const tauriConfig = JSON.parse(readFileSync(join(TAURI_DIR, 'tauri.conf.json'), 'utf8')) as {
  version: string;
  bundle?: { icon?: string[] };
  app?: { security?: { csp?: string } };
};
const cargoToml = readFileSync(join(TAURI_DIR, 'Cargo.toml'), 'utf8');
const cargoLock = readFileSync(join(TAURI_DIR, 'Cargo.lock'), 'utf8');
const script = readFileSync(SCRIPT_PATH, 'utf8');

function cargoTomlPackageVersion(toml: string): string | undefined {
  const packageSection = toml.match(/^\[package\]\n([\s\S]*?)(?=^\[|\s*$(?![\s\S]))/m);
  return packageSection?.[1].match(/^version = "([^"]+)"/m)?.[1];
}

function cargoLockPackageVersion(lock: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return lock.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${escaped}"\\nversion = "([^"]+)"`))?.[1];
}

function scriptProductVersion(text: string): string | undefined {
  return text.match(/^PRODUCT_VERSION="([^"]+)"/m)?.[1];
}

function cspDirectiveTokens(csp: string, directive: string): string[] {
  const value = csp.match(new RegExp(`(?:^|;)\\s*${directive}\\s+([^;]+)`))?.[1];
  return value ? value.trim().split(/\s+/) : [];
}

describe('release contract', () => {
  it('all product-owned version surfaces agree with app/package.json (single source)', () => {
    const expected = packageJson.version;
    expect(tauriConfig.version, 'tauri.conf.json version').toBe(expected);
    expect(cargoTomlPackageVersion(cargoToml), 'Cargo.toml package version').toBe(expected);
    expect(cargoLockPackageVersion(cargoLock, 'efx-motion-editor'), 'Cargo.lock efx-motion-editor version').toBe(
      expected,
    );
    expect(scriptProductVersion(script), 'PRODUCT_VERSION in scripts/macos-release.sh').toBe(expected);
  });

  it('bundle.icon names exactly the 5 desktop files, all present and non-empty, ICNS signed', () => {
    expect(tauriConfig.bundle?.icon).toEqual(EXPECTED_ICONS);
    for (const rel of EXPECTED_ICONS) {
      const filePath = join(TAURI_DIR, rel);
      expect(existsSync(filePath), `${rel} must exist`).toBe(true);
      expect(statSync(filePath).size, `${rel} must be non-empty`).toBeGreaterThan(0);
    }
    const icns = readFileSync(join(TAURI_DIR, 'icons', 'icon.icns'));
    expect(icns.subarray(0, 4).toString('ascii'), 'icon.icns must start with the icns magic bytes').toBe('icns');
  });

  it('release script has no version-pinned DMG glob and no hardcoded version comparison', () => {
    // DMG glob must interpolate PRODUCT_VERSION, never pin a release literal.
    expect(script).not.toMatch(/_\d+\.\d+\.\d+_[^"]*\.dmg/);
    expect(script).toContain('_${PRODUCT_VERSION}_');
    // validate_tauri_config must compare config.version against the passed
    // PRODUCT_VERSION, not a hardcoded string.
    const validateBody = script.slice(
      script.indexOf('validate_tauri_config() {'),
      script.indexOf('run_preflight() {'),
    );
    expect(validateBody).not.toMatch(/config\.version\s*!==\s*'\d/);
    expect(validateBody).toContain('"$PRODUCT_VERSION"');
  });

  it('script prefixes system PATH on the Tauri build and preflights codesign resolution', () => {
    // Tauri build invocation must resolve system binaries first (its internal
    // codesign/security calls depend on PATH).
    expect(script).toMatch(/PATH="\/usr\/bin:\/bin:\/usr\/sbin:\/sbin:\$PATH" "\$PNPM_BIN" --dir/);
    // Preflight must prove runtime codesign resolution, not string ordering.
    expect(script).toMatch(/PATH="\/usr\/bin:\/bin:\/usr\/sbin:\/sbin:\$PATH" command -v codesign/);
  });

  // Live probe: macOS-only — on other hosts `codesign` does not exist and the
  // platform-neutral contract tests above must still run.
  it.runIf(process.platform === 'darwin')('simulated codesign resolution passes on this machine', () => {
    const resolved = execSync('PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign', {
      shell: '/bin/bash',
      encoding: 'utf8',
    }).trim();
    expect(resolved).toBe('/usr/bin/codesign');
  });
});

describe('Tauri CSP image data-url contract', () => {
  const csp = tauriConfig.app?.security?.csp ?? '';

  it('img-src grants the data: scheme alongside every pre-existing source', () => {
    const tokens = cspDirectiveTokens(csp, 'img-src');
    expect(tokens.length, 'CSP must contain an img-src directive').toBeGreaterThan(0);
    for (const source of ["'self'", 'asset:', 'http://asset.localhost', 'efxasset:', 'blob:', 'data:', 'https://*']) {
      expect(tokens, `img-src must include ${source}`).toContain(source);
    }
  });

  it('no other CSP directive gains the data: scheme', () => {
    for (const directive of ['default-src', 'script-src', 'style-src', 'connect-src', 'media-src']) {
      const tokens = cspDirectiveTokens(csp, directive);
      expect(tokens, `${directive} must not include data:`).not.toContain('data:');
    }
  });

  it('rotoCanvasFrames.ts declares the canonical ROTO_PNG_DATA_URL_HEADER constant', () => {
    const source = readFileSync(
      join(APP_DIR, 'src', 'components', 'physic-paint', 'roto', 'rotoCanvasFrames.ts'),
      'utf8',
    );
    expect(source).toContain("ROTO_PNG_DATA_URL_HEADER = 'data:image/png;base64'");
  });
});

// Phase 41-05 D-04: EFX Paint audio monitoring fetches decoded bytes via the
// efxasset:// custom protocol; fetch to a custom scheme is governed by
// connect-src. The single-token grant below was proven necessary by a packaged
// build observing the connect-src refusal BEFORE the grant landed
// (d04-proof-packaged-build, truth table section 9).
describe('Tauri CSP connect-src efxasset contract', () => {
  const csp = tauriConfig.app?.security?.csp ?? '';

  it('connect-src grants the efxasset: scheme alongside every pre-existing source', () => {
    const tokens = cspDirectiveTokens(csp, 'connect-src');
    expect(tokens.length, 'CSP must contain a connect-src directive').toBeGreaterThan(0);
    for (const source of ["'self'", 'ipc:', 'http://ipc.localhost', 'https://*', 'efxasset:']) {
      expect(tokens, `connect-src must include ${source}`).toContain(source);
    }
  });

  it('no other directive beyond img-src/media-src/connect-src gains the efxasset: scheme', () => {
    for (const directive of ['default-src', 'script-src', 'style-src']) {
      const tokens = cspDirectiveTokens(csp, directive);
      expect(tokens, `${directive} must not include efxasset:`).not.toContain('efxasset:');
    }
  });

  it('connect-src does not grant data: or blob: (narrow-grant guard per D-04)', () => {
    const tokens = cspDirectiveTokens(csp, 'connect-src');
    expect(tokens, 'connect-src must not include data:').not.toContain('data:');
    expect(tokens, 'connect-src must not include blob:').not.toContain('blob:');
  });
});

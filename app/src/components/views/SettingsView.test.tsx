/**
 * 260918-ovi: SettingsView source-scan contract.
 *
 * SettingsView is a thin select over projectStore; a source-scan contract is
 * the right surface (mirroring the 260918-o0n TimelineInteraction region
 * pattern). The contract pins:
 *   1. SettingsView consumes the SHARED preset table (canvasFormatPresets) —
 *      so a future edit cannot silently reintroduce a 4K option in one surface
 *      while the other stays clamped (T-260918-ovi-03).
 *   2. No '3840' / '2160' / '4K' literal survives outside comments.
 *   3. The COMMON_RESOLUTIONS local table is gone.
 *   4. The live-size fallback branch is retained for projects created outside
 *      the preset set (today's UX preserved).
 *   5. The onChange handler resolves the chosen option against the shared
 *      table and calls projectStore.setResolution with the preset dims.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./SettingsView.tsx', import.meta.url)),
  'utf8',
);

/** Strip single-line comments so literal scans don't trip on annotations. */
function stripLineComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

describe('SettingsView canvas format contract (260918-ovi)', () => {
  it('SettingsView consumes the shared preset table', () => {
    expect(source).toContain("from '../project/canvasFormatPresets'");
    expect(source).toContain('CANVAS_FORMAT_PRESETS');
  });

  it("no 4K escape: the file does NOT contain '3840', '2160', or '4K' outside comments", () => {
    const stripped = stripLineComments(source);
    expect(stripped).not.toContain('3840');
    expect(stripped).not.toContain('2160');
    expect(stripped).not.toContain('4K');
  });

  it('no COMMON_RESOLUTIONS local table', () => {
    expect(source).not.toContain('const COMMON_RESOLUTIONS');
  });

  it('current custom size still offered as a fallback option', () => {
    // The fallback branch preserves today's UX for projects created outside
    // the preset set — an extra <option> carrying the live WxH label.
    expect(source).toContain('${projectStore.width.value}x${projectStore.height.value}');
  });

  it('preset options call projectStore.setResolution with preset dims', () => {
    expect(source).toContain('projectStore.setResolution(preset.width, preset.height)');
  });
});

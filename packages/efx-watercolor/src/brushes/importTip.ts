// ============================================================
//  Custom tip import (56-04 / AQUA-03 / T-56-10).
//
//  RED stub — the named surface exists so pack.test.ts collects,
//  but every import reports success with a placeholder tip. The
//  real sniff/decode path lands in the GREEN step.
// ============================================================

import type { AquarelleTip } from './tips'
import { NEUTRAL_TOOL_OVERRIDES } from './tips'

/** Discriminated import result — never a throw into the UI layer. */
export type ImportTipResult =
  | { ok: true; tip: AquarelleTip }
  | { ok: false; reason: 'unreadable-image' }

/** UI-SPEC refusal copy — the Brushes docker shows this verbatim. */
export const IMPORT_TIP_FAILURE_COPY =
  'Import failed — this file is not a readable PNG or JPG. Nothing changed.'

/**
 * Import a custom PNG/JPG brush tip.
 *
 * RED stub: always claims success with a placeholder tip so the
 * accept/reject contract tests fail on assertions.
 */
export async function importTip(bytes: Uint8Array, fileName: string): Promise<ImportTipResult> {
  void bytes
  return {
    ok: true,
    tip: {
      id: 'wc/custom-stub',
      category: 'round',
      name: fileName,
      defaults: NEUTRAL_TOOL_OVERRIDES,
    },
  }
}

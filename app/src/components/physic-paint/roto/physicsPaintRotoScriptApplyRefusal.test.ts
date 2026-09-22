import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET,
  ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED,
  buildRotoScriptApplyRefusalMessage,
} from './physicsPaintRotoScriptApplyRefusal';
import type { RotoScriptOperationError, RotoScriptOperationErrorCode } from './physicsPaintRotoScriptClipboard';

const source = readFileSync(fileURLToPath(new URL('./physicsPaintRotoScriptApplyRefusal.ts', import.meta.url)), 'utf8');

function operationError(code: RotoScriptOperationErrorCode, message = 'clipboard message', cause?: string): RotoScriptOperationError {
  return cause === undefined ? { operation: 'apply', code, message } : { operation: 'apply', code, message, cause };
}

describe('quick-260922-al1 Action-apply refusal copy', () => {
  it('names the refusal and that nothing changed when the destination cannot accept the Action', () => {
    const copy = buildRotoScriptApplyRefusalMessage(operationError('apply-empty-target-failed'));
    expect(copy).toBe(ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET);
    expect(copy).toContain('Apply rejected');
    expect(copy).toContain('Nothing changed.');
  });

  it('maps every shape of apply-empty-target-failed to ONE line, never claiming an internal cause', () => {
    // The clipboard sets this code on three distinct production paths whose
    // only shared observable is the refusal itself: `prepareTarget` THREW
    // (physicsPaintRotoScriptClipboard.ts:666), it resolved null, and it
    // resolved but the target stopped being current across the await (:688).
    // The throwing path appends `: ${cause}` to `error.message`, so a mapper
    // that echoed the message would leak an internal cause that is untrue of
    // the other two — the copy must be built from the code alone.
    const threw = buildRotoScriptApplyRefusalMessage(
      operationError('apply-empty-target-failed', 'Apply Script could not prepare the physical destination: workspace reference lost', 'workspace reference lost'),
    );
    const resolvedNull = buildRotoScriptApplyRefusalMessage(operationError('apply-empty-target-failed', 'Apply Script could not prepare the destination as an accepted physical Roto key.'));
    const wentStale = buildRotoScriptApplyRefusalMessage(operationError('apply-empty-target-failed', 'Apply Script could not prepare the destination as an accepted physical Roto key.'));
    expect(threw).toBe(ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET);
    expect(resolvedNull).toBe(ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET);
    expect(wentStale).toBe(ROTO_SCRIPT_APPLY_REFUSAL_EMPTY_TARGET);
    expect(threw).toBe(resolvedNull);
    expect(threw).not.toContain('workspace reference lost');
    expect(threw).not.toContain('prepare');
  });

  it('carries a partial failure verbatim — its own message already states the committed count', () => {
    const copy = buildRotoScriptApplyRefusalMessage(
      operationError('apply-partial-failure', 'Apply Script stopped after 3 of 5 brushes.'),
    );
    expect(copy).toBe('Apply Script stopped after 3 of 5 brushes.');
  });

  it('carries a cancellation verbatim — it is reachable after brushes were already committed', () => {
    // quick-260922-al1 (user-approved override): `apply-cancelled` is set at
    // physicsPaintRotoScriptClipboard.ts:573 with the completed/total counts and
    // is reachable with `completed > 0`, so the planned "cancelled, nothing
    // changed" copy would be FALSE. It mirrors `apply-partial-failure` instead.
    const copy = buildRotoScriptApplyRefusalMessage(
      operationError('apply-cancelled', 'Apply Script was cancelled after 2 of 5 brushes completed.'),
    );
    expect(copy).toBe('Apply Script was cancelled after 2 of 5 brushes completed.');
    expect(copy).not.toContain('Nothing changed');
  });

  it('states the target-change refusal and that nothing changed, for the zero-committed case', () => {
    // This code is only reachable with `completed === 0`
    // (physicsPaintRotoScriptClipboard.ts:574-576), so "nothing changed" holds.
    const copy = buildRotoScriptApplyRefusalMessage(operationError('apply-invalidated'));
    expect(copy).toBe(ROTO_SCRIPT_APPLY_REFUSAL_INVALIDATED);
    expect(copy).toContain('changed while applying');
    expect(copy).toContain('Nothing changed');
    expect(copy).toContain('try again');
  });

  it('never invents a message for an unaffected path', () => {
    expect(buildRotoScriptApplyRefusalMessage(operationError('apply-enqueue-failed'))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(operationError('copy-drain-failed'))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(operationError('copy-source-invalidated'))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(null)).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(undefined)).toBeNull();
  });

  it('degrades to null rather than emitting a blank or non-string line', () => {
    expect(buildRotoScriptApplyRefusalMessage(operationError('apply-partial-failure', ''))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(operationError('apply-partial-failure', '   '))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage(operationError('apply-cancelled', ''))).toBeNull();
    expect(buildRotoScriptApplyRefusalMessage({ operation: 'apply', code: 'apply-cancelled', message: 42 as never })).toBeNull();
  });

  it('never returns a raw error object, a stack, or a code identifier', () => {
    const codes: RotoScriptOperationErrorCode[] = [
      'apply-empty-target-failed', 'apply-partial-failure', 'apply-invalidated', 'apply-cancelled',
      'apply-enqueue-failed', 'copy-drain-failed', 'copy-source-invalidated',
    ];
    for (const code of codes) {
      // A realistic clipboard message: the codes are internal identifiers and
      // never appear in the text the clipboard itself writes.
      const copy = buildRotoScriptApplyRefusalMessage(operationError(code, 'Apply Script stopped after 2 of 5 brushes.', 'object Object'));
      if (copy === null) continue;
      expect(typeof copy).toBe('string');
      expect(copy).not.toContain(code);
      expect(copy).not.toContain('object Object');
      expect(copy).not.toContain('[object');
      expect(copy).not.toContain('\n');
      expect(copy).not.toMatch(/\bat .+:\d+:\d+/);
    }
  });

  it('PIN: the helper stays pure — type-only imports, no signals, no IO', () => {
    // A refusal mapper that reached for a signal, a store or the clipboard module
    // at runtime could not be called from a render body or a test without setup.
    expect(source).toContain("import type { RotoScriptOperationError }");
    expect(source).not.toMatch(/^import\s+(?!type)/m);
    expect(source).not.toContain('@preact/signals');
    expect(source).not.toContain('window.');
    expect(source).not.toContain('document.');
  });
});

import { describe, expect, it } from 'vitest';
import { shouldRestoreOrphanedKeyRailFocus } from './physicsPaintKeyRailFocus';

describe('shouldRestoreOrphanedKeyRailFocus (43.4 defect 6)', () => {
  it('restores focus when the focused rail was removed and focus fell to body', () => {
    expect(shouldRestoreOrphanedKeyRailFocus({ isConnected: false }, { tagName: 'BODY' })).toBe(true);
  });

  it('does not restore when the focused rail is still connected', () => {
    expect(shouldRestoreOrphanedKeyRailFocus({ isConnected: true }, { tagName: 'BODY' })).toBe(false);
  });

  it('does not restore when no rail was focused', () => {
    expect(shouldRestoreOrphanedKeyRailFocus(null, { tagName: 'BODY' })).toBe(false);
  });

  it('does not restore when focus sits on a live control (toolbar Delete)', () => {
    expect(shouldRestoreOrphanedKeyRailFocus({ isConnected: false }, { tagName: 'BUTTON' })).toBe(false);
  });

  it('does not restore when the document has no active element', () => {
    expect(shouldRestoreOrphanedKeyRailFocus({ isConnected: false }, null)).toBe(false);
  });
});

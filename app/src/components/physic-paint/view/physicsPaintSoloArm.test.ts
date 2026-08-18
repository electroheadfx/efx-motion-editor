import { beforeEach, describe, expect, it, vi } from 'vitest';

type SoloArmModule = typeof import('./physicsPaintSoloArm');

/**
 * Session-only solo arm lifecycle (D-04, D-14, D-16). The module-scope signal
 * persists across tests, so each test re-imports a fresh module instance.
 */
describe('physicsPaintSoloArm (session-only solo arm)', () => {
  let arm: SoloArmModule;

  beforeEach(async () => {
    vi.resetModules();
    arm = await import('./physicsPaintSoloArm');
  });

  it('starts disarmed (save/reopen always starts disarmed, D-14)', () => {
    expect(arm.isSoloArmed()).toBe(false);
  });

  it('toggleSolo arms and returns true', () => {
    expect(arm.toggleSolo()).toBe(true);
    expect(arm.isSoloArmed()).toBe(true);
  });

  it('re-click toggles off (D-04 re-click exit)', () => {
    arm.toggleSolo();
    expect(arm.toggleSolo()).toBe(true);
    expect(arm.isSoloArmed()).toBe(false);
  });

  it('disarmSolo returns true ONLY when armed (one-Escape-one-layer, D-04)', () => {
    expect(arm.disarmSolo()).toBe(false);
    arm.toggleSolo();
    expect(arm.disarmSolo()).toBe(true);
    expect(arm.isSoloArmed()).toBe(false);
  });

  it('disarmSolo is idempotent: a second disarm after exit returns false', () => {
    arm.toggleSolo();
    expect(arm.disarmSolo()).toBe(true);
    expect(arm.disarmSolo()).toBe(false);
    expect(arm.isSoloArmed()).toBe(false);
  });

  it('re-arms after disarm (arm persists across stop/start while selection unchanged, D-16)', () => {
    arm.toggleSolo();
    arm.disarmSolo();
    expect(arm.toggleSolo()).toBe(true);
    expect(arm.isSoloArmed()).toBe(true);
  });

  it('arming never starts or stops transport (toggle returns a boolean only)', () => {
    expect(arm.toggleSolo()).toBe(true);
    expect(arm.toggleSolo()).toBe(true);
    expect(arm.isSoloArmed()).toBe(false);
  });
});

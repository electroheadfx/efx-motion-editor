import {describe, expect, it} from 'vitest';

// 261010-bkv Task 1: the audioGain bridge does not exist yet at RED time.
// Dynamic import keeps each failure under its own test name.
async function loadAudioGain() {
  return await import('./audioGain');
}

describe('audioGain dB domain (261010-bkv)', () => {
  it('pins the dB slider range', async () => {
    const {GAIN_DB_MIN, GAIN_DB_MAX} = await loadAudioGain();
    expect(GAIN_DB_MIN).toBe(-20);
    expect(GAIN_DB_MAX).toBe(20);
  });

  it('dbToLinear maps the dB grid to true amplitude', async () => {
    const {dbToLinear} = await loadAudioGain();
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 10);
    expect(dbToLinear(20)).toBeCloseTo(10, 10);
    expect(dbToLinear(-5)).toBeCloseTo(10 ** (-5 / 20), 10);
    expect(dbToLinear(6)).toBeCloseTo(10 ** (6 / 20), 10);
  });

  it('linearToDb inverts dbToLinear and floors non-positive at -20', async () => {
    const {linearToDb} = await loadAudioGain();
    expect(linearToDb(1)).toBe(0);
    expect(linearToDb(0)).toBe(-20);
    expect(linearToDb(-1)).toBe(-20);
    expect(linearToDb(0.1)).toBeCloseTo(-20, 10);
    expect(linearToDb(10)).toBeCloseTo(20, 10);
  });
});

describe('audioGain Studio integer gain (261010-bkv)', () => {
  it('gainToDb is gain/5 across the -100..+100 store domain', async () => {
    const {gainToDb} = await loadAudioGain();
    expect(gainToDb(-100)).toBe(-20);
    expect(gainToDb(0)).toBe(0);
    expect(gainToDb(100)).toBe(20);
    expect(gainToDb(-25)).toBe(-5);
    expect(gainToDb(35)).toBe(7);
  });

  it('dbToGain round-trips integers on the 5-wide gain grid', async () => {
    const {dbToGain, gainToDb} = await loadAudioGain();
    for (const gain of [-100, -75, -25, 0, 5, 35, 100]) {
      expect(dbToGain(gainToDb(gain))).toBe(gain);
    }
    expect(dbToGain(-20)).toBe(-100);
    expect(dbToGain(0)).toBe(0);
    expect(dbToGain(20)).toBe(100);
    // Off-grid dB snaps to the nearest stored gain integer.
    expect(dbToGain(0.4)).toBe(2);
    expect(dbToGain(-0.4)).toBe(-2);
  });
});

describe('audioGain frames/seconds (261010-bkv)', () => {
  it('converts frames and seconds at project fps', async () => {
    const {framesToSeconds, secondsToFrames} = await loadAudioGain();
    expect(secondsToFrames(3.5, 24)).toBe(84);
    expect(framesToSeconds(84, 24)).toBe(3.5);
    expect(framesToSeconds(0, 24)).toBe(0);
    expect(secondsToFrames(0, 24)).toBe(0);
  });

  it('secondsToFrames rounds to the nearest frame', async () => {
    const {secondsToFrames} = await loadAudioGain();
    expect(secondsToFrames(1.0, 24)).toBe(24);
    expect(secondsToFrames(1.02, 24)).toBe(24);
    expect(secondsToFrames(1.03, 24)).toBe(25);
    expect(secondsToFrames(0.5, 12)).toBe(6);
  });
});

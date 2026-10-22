import { describe, expect, it } from 'vitest';
import { stripOpaqueWhiteMatte } from './opaqueWhiteMatte';

function frame(width: number, height: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return data;
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, rgba: [number, number, number, number]): void {
  const index = (y * width + x) * 4;
  data[index] = rgba[0];
  data[index + 1] = rgba[1];
  data[index + 2] = rgba[2];
  data[index + 3] = rgba[3];
}

describe('stripOpaqueWhiteMatte', () => {
  it('strips a fully opaque white matte and keeps the paint', () => {
    const data = frame(4, 4, [255, 255, 255, 255]);
    setPixel(data, 4, 1, 1, [200, 30, 40, 255]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(true);

    expect([data[0], data[1], data[2], data[3]]).toEqual([0, 0, 0, 0]);
    const paint = (1 * 4 + 1) * 4;
    expect([data[paint], data[paint + 1], data[paint + 2], data[paint + 3]]).toEqual([200, 30, 40, 255]);
    expect(data[((3 * 4) + 3) * 4 + 3]).toBe(0);
  });

  it('leaves a real-alpha frame untouched', () => {
    const data = frame(4, 4, [0, 0, 0, 0]);
    setPixel(data, 4, 1, 1, [200, 30, 40, 255]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(false);
    expect(data[3]).toBe(0);
    expect(data[((1 * 4) + 1) * 4 + 3]).toBe(255);
  });

  it('leaves a fully white opaque frame untouched', () => {
    const data = frame(4, 4, [255, 255, 255, 255]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(false);
    expect(data[3]).toBe(255);
  });

  it('leaves a mixed-alpha frame untouched', () => {
    const data = frame(4, 4, [255, 255, 255, 255]);
    setPixel(data, 4, 1, 1, [200, 30, 40, 128]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(false);
    expect(data[3]).toBe(255);
    expect(data[((1 * 4) + 1) * 4 + 3]).toBe(128);
  });

  it('strips the near-white wash fringe along with the pure-white matte', () => {
    const data = frame(4, 4, [255, 255, 255, 255]);
    setPixel(data, 4, 1, 1, [200, 30, 40, 255]);
    setPixel(data, 4, 2, 2, [245, 242, 248, 255]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(true);

    const fringe = (2 * 4 + 2) * 4;
    expect(data[fringe + 3]).toBe(0);
    const paint = (1 * 4 + 1) * 4;
    expect(data[paint + 3]).toBe(255);
  });

  it('leaves a frame with a tinted corner untouched', () => {
    const data = frame(4, 4, [255, 255, 255, 255]);
    setPixel(data, 4, 1, 1, [200, 30, 40, 255]);
    setPixel(data, 4, 0, 0, [230, 230, 230, 255]);

    expect(stripOpaqueWhiteMatte(data, 4, 4)).toBe(false);
    expect(data[3]).toBe(255);
  });
});

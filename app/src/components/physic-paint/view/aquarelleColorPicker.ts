// 261030-cnq RED stub — API surface only; bodies land in GREEN.
import { computed, signal } from '@preact/signals';

export interface PickRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const PICK_MIN_ALPHA = 0;

export const aquarellePickerLatched = signal(false);
export const aquarellePickerAltHeld = signal(false);
export const aquarellePickerActive = computed(
  () => aquarellePickerLatched.value || aquarellePickerAltHeld.value,
);

export function setAquarellePickerLatched(_next: boolean): void {}

export function setAquarellePickerAltHeld(_next: boolean): void {}

export function toggleAquarellePickerLatched(): void {}

export function disarmAquarellePicker(): void {}

export function isAquarellePickerArmed(): boolean {
  return false;
}

export function compositeRgbaOver(base: PickRgba, _top: PickRgba): PickRgba {
  return base;
}

export function compositePickLayers(_layers: ReadonlyArray<PickRgba | null>): PickRgba {
  return { r: 0, g: 0, b: 0, a: 0 };
}

export function transmittancePixelToPigment(_r: number, _g: number, _b: number): PickRgba {
  return { r: 0, g: 0, b: 0, a: 0 };
}

export function rgbaToHex(_color: PickRgba): string {
  return '';
}

export function sampleAquarelleStackColor(_input: {
  stack: HTMLElement;
  clientX: number;
  clientY: number;
  paintCanvas: HTMLCanvasElement | null;
}): string | null {
  return null;
}

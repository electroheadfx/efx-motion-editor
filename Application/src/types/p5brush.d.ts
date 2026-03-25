// Type declarations for p5.brush standalone build
// Only declares the API surface used by our brush FX renderer

declare module 'p5.brush/standalone' {
  /** Canvas setup */
  export function createCanvas(
    width: number,
    height: number,
    options?: {
      pixelDensity?: number;
      parent?: string | HTMLElement;
      id?: string;
    },
  ): HTMLCanvasElement;

  export function load(target?: HTMLCanvasElement | OffscreenCanvas): void;

  /** Frame lifecycle */
  export function render(): void;
  export function clear(color?: string): void;

  /** Transform stack */
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function rotate(angle: number): void;
  export function scale(x: number, y?: number): void;

  /** Angle mode */
  export const DEGREES: 'degrees';
  export const RADIANS: 'radians';
  export function angleMode(mode: 'degrees' | 'radians'): void;

  /** Seeding */
  export function seed(n: number): void;
  export function noiseSeed(n: number): void;

  /** Brush management */
  export function set(brushName: string, color: string, weight?: number): void;
  export function pick(brushName: string): void;
  export function stroke(color: string): void;
  export function strokeWeight(weight: number): void;
  export function noStroke(): void;
  export function add(name: string, params: BrushParams): void;
  export function box(): string[];
  export function scaleBrushes(scale: number): void;

  /** Drawing */
  export function line(x1: number, y1: number, x2: number, y2: number): void;
  export function flowLine(
    x: number,
    y: number,
    length: number,
    dir: number,
  ): void;
  export function spline(
    points: [number, number, number?][],
    curvature?: number,
  ): void;
  export function circle(
    x: number,
    y: number,
    radius: number,
    irregularity?: number,
  ): void;
  export function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    mode?: string,
  ): void;

  /** Fill */
  export function fill(color: string, opacity?: number): void;
  export function noFill(): void;
  export function fillBleed(intensity: number, direction?: string): void;
  export function fillTexture(
    texture?: number,
    border?: number,
    scatter?: boolean,
  ): void;

  /** Wash */
  export function wash(color: string, opacity?: number): void;
  export function noWash(): void;

  /** Flow fields */
  export function field(name: string): void;
  export function noField(): void;
  export function addField(
    name: string,
    generator: (t: number, field: any) => any,
    options?: {angleMode?: 'degrees' | 'radians'},
  ): void;
  export function refreshField(time: number): void;
  export function listFields(): string[];
  export function wiggle(amount: number): void;

  /** Hatching */
  export function hatch(
    spacing: number,
    angle: number,
    options?: object,
  ): void;
  export function hatchStyle(
    brush: string,
    color: string,
    weight: number,
  ): void;
  export function noHatch(): void;

  /** Noise utilities */
  export function random(min?: number, max?: number): number;
  export function noise(x: number, y?: number, z?: number): number;

  /** Brush parameter types */
  interface BrushParams {
    type?: 'default' | 'spray' | 'marker' | 'custom' | 'image';
    weight?: number;
    scatter?: number;
    sharpness?: number;
    grain?: number;
    opacity?: number;
    spacing?: number;
    pressure?:
      | [number, number]
      | [number, number, number]
      | ((t: number) => number);
    tip?: (surface: any) => void;
    rotate?: 'random' | 'natural';
    markerTip?: boolean;
    noise?: number;
  }
}

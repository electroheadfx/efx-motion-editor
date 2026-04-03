declare module 'bezier-js' {
  interface Point {
    x: number;
    y: number;
    t?: number;
    d?: number;
  }

  interface BezierCurve {
    points: Point[];
  }

  interface SplitResult {
    left: BezierCurve;
    right: BezierCurve;
  }

  export class Bezier {
    points: Point[];

    constructor(
      x1: number, y1: number,
      x2: number, y2: number,
      x3: number, y3: number,
      x4: number, y4: number,
    );

    /** Split the curve at parameter t */
    split(t: number): SplitResult;

    /** Project a point onto the curve, returning the nearest point with t parameter */
    project(point: { x: number; y: number }): Point;

    /** Get the point at parameter t */
    get(t: number): Point;

    /** Get the total arc length of the curve */
    length(): number;
  }
}

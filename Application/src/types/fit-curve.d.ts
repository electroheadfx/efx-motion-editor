declare module 'fit-curve' {
  export default function fitCurve(
    points: number[][],
    maxError: number,
  ): number[][][];
}

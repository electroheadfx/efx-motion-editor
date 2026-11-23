// A dashed outline over the paper showing where a scripted drawing will land.
// Tools write an SVG path (client-space coordinates); the host draws it.
// Preact-free core — the signal is a plain get/set (the host may wrap it).

let current: string | null = null;

export const ghostPath = {
  get value() { return current; },
  peek() { return current; },
};
export const setGhost = (d: string) => { current = d; };
export const hideGhost = () => { current = null; };

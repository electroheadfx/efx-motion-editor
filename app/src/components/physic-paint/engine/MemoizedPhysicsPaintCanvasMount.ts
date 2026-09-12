// 38.1-11: keep the plain mount directly callable while StudioView uses a
// dedicated compat boundary. Stable structural props skip the persistent Efx
// child on frame-only Studio renders; canvasKey still controls replacement.
//
// 52.2 D-18 (render-churn inventory): the compat boundary counts REAL renders
// of the canvas area — the increment runs only when the memo compare fails, so
// it measures churn rather than parent renders. `countRender` is a no-op while
// the profile gate is off. This module is a `.ts` file, so the counted boundary
// delegates through createElement: a direct `PhysicsPaintCanvasMount(props)`
// call would bind the mount's hooks to this wrapper's component instance.
import type { ComponentProps } from 'preact';
import { createElement } from 'preact';
import { memo } from 'preact/compat';
import { countRender } from '../performance/renderCounters';
import { PhysicsPaintCanvasMount } from './PhysicsPaintCanvasMount';

function PhysicsPaintCanvasMountRenderCounted(props: ComponentProps<typeof PhysicsPaintCanvasMount>) {
  countRender('canvas');
  return createElement(PhysicsPaintCanvasMount, props);
}

export const MemoizedPhysicsPaintCanvasMount = memo(PhysicsPaintCanvasMountRenderCounted);

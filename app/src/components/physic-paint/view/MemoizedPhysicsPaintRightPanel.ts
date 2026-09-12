// 38-11: the Studio render path mounts the right panel through this
// preact/compat memo wrapper — a startFrame-only Studio render feeds
// referentially stable props (38-11 identity memo in the Studio), the default
// shallow compare returns equal, and Preact skips the subtree. Signal-backed
// controllers (scripts.library/playScript/rotoScript) are read internally via
// .value, so ScriptsPanel signal updates bypass the memo and keep flowing.
//
// 38-11 fix: the wrapper lives in its own module, NOT in
// PhysicsPaintRightPanel.tsx. Importing preact/compat there installs a global
// options.vnode hook that rewrites DOM event props (onInput → oninput) at
// vnode creation, and memo() returns an unrendered vnode when invoked as a
// plain function — both break the palette contract tests, which call
// PhysicsPaintRightPanel(props) directly through a hook-runtime harness.
// Keeping compat out of that module's import graph preserves the
// direct-invocation contract.
//
// 52.2 D-18 (render-churn inventory): the memo boundary counts REAL renders of
// the panel — the increment runs only when the shallow compare fails, so it
// measures churn rather than parent renders. `countRender` is a no-op while the
// profile gate is off. This module is a `.ts` file, so the counted boundary
// delegates through createElement: a direct `PhysicsPaintRightPanel(props)`
// call would bind the panel's hooks to this wrapper's component instance.
import type { ComponentProps } from 'preact';
import { createElement } from 'preact';
import { memo } from 'preact/compat';
import { countRender } from '../performance/renderCounters';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';

function PhysicsPaintRightPanelRenderCounted(props: ComponentProps<typeof PhysicsPaintRightPanel>) {
  countRender('rightPanel');
  return createElement(PhysicsPaintRightPanel, props);
}

export const MemoizedPhysicsPaintRightPanel = memo(PhysicsPaintRightPanelRenderCounted);

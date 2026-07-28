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
import { memo } from 'preact/compat';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';

export const MemoizedPhysicsPaintRightPanel = memo(PhysicsPaintRightPanel);

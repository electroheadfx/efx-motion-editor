/**
 * LOOP-persist audit WARNING-1 (D-06/D-14 + VID-04): coverage-gap warnings
 * must render even when the export has already failed. A fail-closed error
 * (VID-04's named clip) previously hid gap names that were already computed.
 *
 * Render test materializes the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx): the component function is invoked directly and
 * its vnodes are walked for the warning text.
 */
import { describe, expect, it, vi } from 'vitest';

const progress = vi.hoisted(() => ({
  value: {
    status: 'idle' as string,
    currentFrame: 0,
    totalFrames: 0,
    estimatedSecondsRemaining: null as number | null,
    errorMessage: null as string | null,
    warnings: [] as string[],
    resumeFromFrame: null as number | null,
  },
}));

vi.mock('../../stores/exportStore', () => ({
  exportStore: {
    progress,
    cancel: vi.fn(),
  },
}));
vi.mock('../../lib/ipc', () => ({ exportOpenInFinder: vi.fn() }));
vi.mock('../../lib/exportEngine', () => ({ resumeExport: vi.fn() }));
vi.mock('../../stores/uiStore', () => ({ uiStore: {} }));

import { ExportProgress } from './ExportProgress';

type VNode = { props?: Record<string, unknown>; children?: unknown };

function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const vnode = node as VNode;
  if (vnode.props?.children != null) collectText(vnode.props.children, out);
  return out;
}

describe('ExportProgress coverage-gap warnings (WARNING-1)', () => {
  it('renders gap warnings alongside a fail-closed error (status=error)', () => {
    progress.value = {
      status: 'error',
      currentFrame: 3,
      totalFrames: 16,
      estimatedSecondsRemaining: null,
      errorMessage: 'Vidéo SUPP could not be prepared',
      warnings: ['Sequence "Shot A" runs to 17 but its clip ends at 16'],
      resumeFromFrame: null,
    };

    const tree = ExportProgress({}) as unknown;
    const text = collectText(tree).join('\n');

    expect(text).toContain('Vidéo SUPP could not be prepared');
    expect(text).toContain('runs to 17 but its clip ends at 16');
    expect(text).toContain('Coverage gaps');
  });

  it('still renders gap warnings on a successful export', () => {
    progress.value = {
      status: 'complete',
      currentFrame: 16,
      totalFrames: 16,
      estimatedSecondsRemaining: null,
      errorMessage: null,
      warnings: ['Sequence "Shot A" runs to 17 but its clip ends at 16'],
      resumeFromFrame: null,
    };

    const text = collectText(ExportProgress({}) as unknown).join('\n');
    expect(text).toContain('runs to 17 but its clip ends at 16');
  });

  it('renders no warning block when there are no gaps', () => {
    progress.value = {
      status: 'error',
      currentFrame: 0,
      totalFrames: 0,
      estimatedSecondsRemaining: null,
      errorMessage: 'boom',
      warnings: [],
      resumeFromFrame: null,
    };

    const text = collectText(ExportProgress({}) as unknown).join('\n');
    expect(text).not.toContain('Coverage gaps');
  });
});

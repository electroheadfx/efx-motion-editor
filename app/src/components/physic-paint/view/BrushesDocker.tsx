// ============================================================
//  BrushesDocker — Krita-style category-grouped tip list
//  (AQUA-03 / D-07). Vertical list, toolbar add/import, category
//  filter + search, collapsible categories with counts, footer.
//
//  RED stub: empty shell so the contract pins fail until the
//  docker body lands. UI-state seams exist so the suite loads.
// ============================================================

import { signal } from '@preact/signals';

const search = signal('');
const category = signal<'all' | 'round' | 'flat' | 'texture' | 'experimental' | 'custom'>('all');
const importFailure = signal(false);

export function setBrushesDockerSearch(value: string): void {
  search.value = value;
}

export function setBrushesDockerCategory(
  value: 'all' | 'round' | 'flat' | 'texture' | 'experimental' | 'custom',
): void {
  category.value = value;
}

export function setBrushesDockerImportFailure(value: boolean): void {
  importFailure.value = value;
}

export function resetBrushesDockerUi(): void {
  search.value = '';
  category.value = 'all';
  importFailure.value = false;
}

export interface BrushesDockerProps {
  missingTipIds?: readonly string[];
}

export function BrushesDocker(_props: BrushesDockerProps = {}) {
  return <div data-testid="brushes-docker" />;
}

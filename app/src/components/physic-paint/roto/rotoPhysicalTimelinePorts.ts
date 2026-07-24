/**
 * Stable read-only physical timeline port bundle.
 *
 * This module defines the stable read/selection/projection boundary consumed by
 * Studio and later action bundles. It exposes immutable getters/Signals for
 * ordered real records, semantic cells, selected keyId/current record/current
 * appFrame, canonical interpolation, physical content revision, and launch/layer
 * context.
 *
 * Per D-01/D-10: Studio and later action plans consume this one port bundle
 * instead of rebuilding getter sets. The port bundle sources all state from the
 * store's validated physical records and the shared physical projection seam
 * (`projectPhysicPaintRotoPhysicalTimeline`), never from source/display
 * projection, generated cache metadata, or view-owned timing logic.
 *
 * Locked decisions honored:
 * - D-01: stable `keyId` plus direct `appFrame` is the only real-key authority.
 * - D-02: canonical interpolation state; generated cells are runtime-derived.
 * - D-03: no source/display projection, compatibility alias, or fallback.
 * - D-10: one shared physical projection for all current-state consumers.
 * - D-11/D-12: production-only pre-UAT; no regression artifact or server process.
 */

import type { ReadonlySignal } from '@preact/signals';
import type {
  PhysicPaintRotoRealKeyRecord,
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoKeyIdentity,
} from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoPhysicalCell } from './physicsPaintRotoPhysicalResolver';

/**
 * Semantic current-cell state for the physical timeline. Real cells expose
 * `keyId` and direct `appFrame`; generated cells expose their direct frame plus
 * adjacent key IDs; empty cells expose only their direct frame.
 */
export type RotoPhysicalTimelineCell = PhysicPaintRotoPhysicalCell;

/**
 * Immutable physical timeline view: the shared read-only result shape consumed
 * by Studio, selectors, and presentation components.
 */
export interface RotoPhysicalTimelineView {
  /** Ordered real-key records by ascending physical `appFrame`. */
  readonly orderedRealKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  /** Bounded `0 .. capacity - 1` physical cell projection (real/generated/empty). */
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  /** Strict-interior generated cells only; empty when interpolation is disabled. */
  readonly generatedCells: readonly RotoPhysicalTimelineCell[];
  /** Identity IDs in deterministic ascending physical-frame order. */
  readonly orderedKeyIds: readonly string[];
  /** Current semantic cell at the navigation frame. */
  readonly currentCell: RotoPhysicalTimelineCell;
  /** Selected stable `keyId`, or null when no real key is selected. */
  readonly selectedKeyId: string | null;
  /** Selected real-key record, or null when selection is empty/generated/empty. */
  readonly selectedRealKey: PhysicPaintRotoRealKeyRecord | null;
  /** Direct physical `appFrame` of the selected real key, or null. */
  readonly selectedAppFrame: number | null;
  /** Current direct physical navigation frame. */
  readonly currentAppFrame: number;
  /** Canonical interpolation state. */
  readonly interpolation: PhysicPaintRotoInterpolationState;
  /** Bounded physical frame capacity. */
  readonly capacity: number;
}

/**
 * Stable read-only port bundle over the store projection and selectors. Studio
 * and later action plans consume this one interface instead of rebuilding
 * getter sets.
 */
export interface RotoPhysicalTimelinePorts {
  /** Reactive physical timeline view Signal. */
  readonly view: ReadonlySignal<RotoPhysicalTimelineView>;
  /** Reactive selected keyId Signal. */
  readonly selectedKeyId: ReadonlySignal<string | null>;
  /** Reactive current physical navigation frame Signal. */
  readonly currentAppFrame: ReadonlySignal<number>;
  /** Reactive canonical interpolation state Signal. */
  readonly interpolation: ReadonlySignal<PhysicPaintRotoInterpolationState>;
  /** Reactive physical content revision Signal (bumps on accepted store replacement). */
  readonly revision: ReadonlySignal<number>;
  /** Immutable ordered real-key records at read time. */
  readonly getOrderedRealKeyRecords: () => readonly PhysicPaintRotoRealKeyRecord[];
  /** Immutable real-key record by stable `keyId`, or null when absent. */
  readonly getRealKeyRecord: (keyId: string) => PhysicPaintRotoRealKeyRecord | null;
  /** Immutable real-key record by direct `appFrame`, or null when absent. */
  readonly getRealKeyRecordByAppFrame: (appFrame: number) => PhysicPaintRotoRealKeyRecord | null;
  /** Immutable semantic cell at the current navigation frame. */
  readonly getCurrentCell: () => RotoPhysicalTimelineCell;
  /** Immutable physical timeline view at read time. */
  readonly getView: () => RotoPhysicalTimelineView;
  /** Layer identity for this port bundle. */
  readonly layerId: string;
}

/**
 * Input for creating a {@link RotoPhysicalTimelinePorts} bundle.
 */
export interface RotoPhysicalTimelinePortsInput {
  readonly layerId: string;
  readonly view: ReadonlySignal<RotoPhysicalTimelineView>;
  readonly selectedKeyId: ReadonlySignal<string | null>;
  readonly currentAppFrame: ReadonlySignal<number>;
  readonly interpolation: ReadonlySignal<PhysicPaintRotoInterpolationState>;
  readonly revision: ReadonlySignal<number>;
  readonly getOrderedRealKeyRecords: () => readonly PhysicPaintRotoRealKeyRecord[];
  readonly getRealKeyRecord: (keyId: string) => PhysicPaintRotoRealKeyRecord | null;
  readonly getRealKeyRecordByAppFrame: (appFrame: number) => PhysicPaintRotoRealKeyRecord | null;
  readonly getCurrentCell: () => RotoPhysicalTimelineCell;
  readonly getView: () => RotoPhysicalTimelineView;
}

/**
 * Create a stable read-only {@link RotoPhysicalTimelinePorts} bundle from the
 * given reactive inputs. The port bundle is a thin pass-through: it holds no
 * mutable state of its own and derives everything from the supplied Signals and
 * getters.
 */
export function createRotoPhysicalTimelinePorts(input: RotoPhysicalTimelinePortsInput): RotoPhysicalTimelinePorts {
  return {
    layerId: input.layerId,
    view: input.view,
    selectedKeyId: input.selectedKeyId,
    currentAppFrame: input.currentAppFrame,
    interpolation: input.interpolation,
    revision: input.revision,
    getOrderedRealKeyRecords: input.getOrderedRealKeyRecords,
    getRealKeyRecord: input.getRealKeyRecord,
    getRealKeyRecordByAppFrame: input.getRealKeyRecordByAppFrame,
    getCurrentCell: input.getCurrentCell,
    getView: input.getView,
  };
}

/**
 * Extract stable {@link PhysicPaintRotoKeyIdentity} array from ordered real-key
 * records. Used by callers that need to feed identities into the shared
 * projection seam.
 */
export function toPhysicPaintRotoKeyIdentities(records: readonly PhysicPaintRotoRealKeyRecord[]): PhysicPaintRotoKeyIdentity[] {
  return records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
}
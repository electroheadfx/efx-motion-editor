/**
 * 261107 UAT — animate mode is ONE selected display channel.
 *
 * The selected channel is the only signal the canvas gizmo reads, so these
 * writers must stay compare-then-write and the remembered channel must
 * survive every exit (the Motion tool re-selects it).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  exitRailMotionEditing,
  railMotionLastSelectedChannel,
  railMotionSelectedChannel,
  selectRailMotionChannel,
  toggleRailMotionChannelSelection,
} from './railMotionEditingMode';

describe('rail motion editing mode', () => {
  beforeEach(() => {
    railMotionSelectedChannel.value = null;
    railMotionLastSelectedChannel.value = null;
  });

  it('selects a channel and remembers it for the Motion tool', () => {
    selectRailMotionChannel('scale');

    expect(railMotionSelectedChannel.value).toBe('scale');
    expect(railMotionLastSelectedChannel.value).toBe('scale');
  });

  it('switching channels keeps the newest as the remembered one', () => {
    selectRailMotionChannel('position');
    selectRailMotionChannel('rotation');

    expect(railMotionSelectedChannel.value).toBe('rotation');
    expect(railMotionLastSelectedChannel.value).toBe('rotation');
  });

  it('clicking the selected property again leaves animate mode but stays remembered', () => {
    toggleRailMotionChannelSelection('opacity');
    expect(railMotionSelectedChannel.value).toBe('opacity');

    toggleRailMotionChannelSelection('opacity');
    expect(railMotionSelectedChannel.value).toBeNull();
    expect(railMotionLastSelectedChannel.value).toBe('opacity');
  });

  it('exiting animate mode never forgets the last property', () => {
    selectRailMotionChannel('position');
    exitRailMotionEditing();

    expect(railMotionSelectedChannel.value).toBeNull();
    expect(railMotionLastSelectedChannel.value).toBe('position');
  });
});

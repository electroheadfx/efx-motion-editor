import {useState} from 'preact/hooks';
import {ShortcutsModal} from '../../overlay/ShortcutsModal';
import {aquarelleSelectMode} from './aquarelleStrokeSelection';
import {
  PHYSICS_PAINT_CONTEXT_COPY,
  PHYSICS_PAINT_SHORTCUT_GROUPS,
  PHYSICS_PAINT_SHORTCUT_TAB_LABELS,
  resolvePhysicsPaintShortcutsContext,
  resolvePhysicsPaintShortcutsInitialTab,
} from './physicsPaintShortcutsHelp';

export interface PhysicsPaintShortcutsModalProps {
  onClose: () => void;
}

export function PhysicsPaintShortcutsModal({onClose}: PhysicsPaintShortcutsModalProps) {
  // Frozen for this open: the modal only mounts while shortcutsVisible is true.
  const [context] = useState(() =>
    resolvePhysicsPaintShortcutsContext({moveEditMode: aquarelleSelectMode.peek()}),
  );
  const [initialTab] = useState(() => resolvePhysicsPaintShortcutsInitialTab(context));
  const contextCopy = PHYSICS_PAINT_CONTEXT_COPY[context];

  return (
    <ShortcutsModal
      groups={PHYSICS_PAINT_SHORTCUT_GROUPS}
      tabLabels={PHYSICS_PAINT_SHORTCUT_TAB_LABELS}
      initialTab={initialTab}
      title="Keyboard Shortcuts"
      contextLine={`Detected: ${contextCopy.label} — ${contextCopy.detail}`}
      ariaLabel="Physics Paint shortcuts"
      onClose={onClose}
    />
  );
}

import {useState} from 'preact/hooks';
import {paintStore} from '../../stores/paintStore';
import {uiStore} from '../../stores/uiStore';
import {ShortcutsModal} from './ShortcutsModal';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_TAB_LABELS,
  SHORTCUTS_CONTEXT_COPY,
  resolveShortcutsContext,
  resolveShortcutsInitialTab,
} from './shortcutsHelp';

export function ShortcutsOverlay() {
  // Detected once per open: the overlay only mounts while the store flag is true,
  // so one .peek() read in an initializer is exactly the "frozen for this open" law.
  const [context] = useState(() =>
    resolveShortcutsContext({
      paintMode: paintStore.paintMode.peek(),
      mouseRegion: uiStore.mouseRegion.peek(),
    }),
  );
  const [initialTab] = useState(() => resolveShortcutsInitialTab(context));
  const contextCopy = SHORTCUTS_CONTEXT_COPY[context];

  return (
    <ShortcutsModal
      groups={SHORTCUT_GROUPS}
      tabLabels={SHORTCUT_TAB_LABELS}
      initialTab={initialTab}
      title="Keyboard Shortcuts"
      contextLine={`Detected: ${contextCopy.label} — ${contextCopy.detail}`}
      ariaLabel="Keyboard shortcuts"
      onClose={() => uiStore.closeShortcutsOverlay()}
    />
  );
}

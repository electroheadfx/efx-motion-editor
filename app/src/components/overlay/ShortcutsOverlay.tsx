import {useEffect, useState} from 'preact/hooks';
import {paintStore} from '../../stores/paintStore';
import {uiStore} from '../../stores/uiStore';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_TAB_COUNT,
  SHORTCUT_TAB_LABELS,
  SHORTCUTS_CONTEXT_COPY,
  resolveShortcutsContext,
  resolveShortcutsInitialTab,
  resolveShortcutsTabNumber,
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
  const [activeTab, setActiveTab] = useState(() => resolveShortcutsInitialTab(context));
  const [focusedRow, setFocusedRow] = useState(0);
  const contextCopy = SHORTCUTS_CONTEXT_COPY[context];

  // Reset focusedRow when returning to Sections tab
  useEffect(() => {
    if (activeTab === 0) setFocusedRow(0);
  }, [activeTab]);

  // Keyboard navigation — capture phase + stopPropagation to block app shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        uiStore.closeShortcutsOverlay();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setFocusedRow((prev) => (prev + 1) % SHORTCUT_GROUPS.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setFocusedRow((prev) => (prev - 1 + SHORTCUT_GROUPS.length) % SHORTCUT_GROUPS.length);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeTab === 0) {
          setActiveTab(focusedRow + 1);
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((prev) => (prev + 1) % SHORTCUT_TAB_COUNT);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((prev) => (prev - 1 + SHORTCUT_TAB_COUNT) % SHORTCUT_TAB_COUNT);
        return;
      }
      // Number keys 1-N jump to their group tab (N = the group count)
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num)) {
        const tab = resolveShortcutsTabNumber(num);
        if (tab !== null) {
          e.preventDefault();
          e.stopPropagation();
          setActiveTab(tab);
          return;
        }
      }
      // Block all other keys from reaching app while overlay is open
      e.stopPropagation();
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTab, focusedRow]);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        // Close on backdrop click (not on modal content click)
        if (e.target === e.currentTarget) {
          uiStore.closeShortcutsOverlay();
        }
      }}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        class="relative bg-(--color-bg-toolbar) border border-(--color-border-subtle) rounded-lg shadow-xl max-w-[600px] w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-5">
          <div class="flex flex-col">
            <h2 class="text-base font-semibold text-(--color-text-heading)">
              Keyboard Shortcuts
            </h2>
            <p class="text-xs text-(--color-text-muted)">
              Detected: {contextCopy.label} — {contextCopy.detail}
            </p>
          </div>
          <button
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-(--color-border-subtle) transition-colors cursor-pointer"
            onClick={() => uiStore.closeShortcutsOverlay()}
            title="Close"
          >
            <span class="text-sm text-(--color-text-muted)">{'\u2715'}</span>
          </button>
        </div>

        {/* Tab bar */}
        <div class="flex flex-wrap border-b border-(--color-border-subtle)">
          {SHORTCUT_TAB_LABELS.map((label, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={label}
                class={`px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'text-(--color-text-heading) border-b-2 border-(--color-accent)'
                    : 'text-(--color-text-muted) hover:text-(--color-text-secondary)'
                }`}
                onClick={() => setActiveTab(index)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div class="pt-4 overflow-y-auto" style={{ minHeight: '320px' }}>
          {activeTab === 0 ? (
            // Sections index tab: clickable group list with entry counts
            <div class="flex flex-col gap-1">
              {SHORTCUT_GROUPS.map((group, i) => (
                <button
                  key={group.title}
                  class={`flex items-center justify-between px-3 py-2 rounded text-sm transition-colors cursor-pointer ${
                    focusedRow === i
                      ? 'bg-(--color-bg-hover-item) text-(--color-text-heading)'
                      : 'text-(--color-text-button) hover:bg-(--color-bg-hover-item) hover:text-(--color-text-heading)'
                  }`}
                  onClick={() => setActiveTab(i + 1)}
                >
                  <span>{group.title}</span>
                  <span class="text-xs text-(--color-text-muted)">
                    {group.entries.length} {group.entries.length === 1 ? 'shortcut' : 'shortcuts'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            // Group tab: show entries for SHORTCUT_GROUPS[activeTab - 1]
            <div class="flex flex-col gap-2">
              {SHORTCUT_GROUPS[activeTab - 1].entries.map((entry) => (
                <div key={entry.keys} class="flex items-center justify-between gap-3 py-1">
                  <span class="text-sm text-(--color-text-button)">{entry.description}</span>
                  <kbd class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded bg-(--color-bg-hover-item) border border-(--color-border-kbd) text-xs font-mono text-(--color-text-link)">
                    {entry.keys}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

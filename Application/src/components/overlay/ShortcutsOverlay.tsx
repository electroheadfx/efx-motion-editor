import {useEffect, useState} from 'preact/hooks';
import {uiStore} from '../../stores/uiStore';

/** Shortcut entry: key symbol(s) and description */
interface ShortcutEntry {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Playback',
    entries: [
      {keys: '\u2423 Space', description: 'Play / Pause'},
      {keys: '\u2190 \u2192', description: 'Step frame'},
      {keys: 'J', description: 'Set reverse / increase speed'},
      {keys: 'K', description: 'Reset speed to 1x forward'},
      {keys: 'L', description: 'Set forward / increase speed'},
    ],
  },
  {
    title: 'File',
    entries: [
      {keys: '\u2318S', description: 'Save project'},
      {keys: '\u2318N', description: 'New project'},
      {keys: '\u2318O', description: 'Open project'},
    ],
  },
  {
    title: 'Editing',
    entries: [
      {keys: '\u2318Z', description: 'Undo'},
      {keys: '\u21E7\u2318Z', description: 'Redo'},
      {keys: '\u232B', description: 'Delete selected'},
    ],
  },
  {
    title: 'Navigation',
    entries: [
      {keys: 'Home', description: 'Go to start of timeline'},
      {keys: 'End', description: 'Go to end of timeline'},
      {keys: 'PgUp', description: 'Jump to previous sequence'},
      {keys: 'PgDn', description: 'Jump to next sequence'},
      {keys: '\u21E7\u2318T', description: 'Cycle theme'},
      {keys: '?', description: 'Toggle this help'},
    ],
  },
  {
    title: 'Canvas',
    entries: [
      {keys: '=', description: 'Zoom in'},
      {keys: '\u2212', description: 'Zoom out'},
      {keys: '\u23180', description: 'Fit to window'},
      {keys: 'F', description: 'Toggle fit lock'},
      {keys: '\u2190\u2191\u2193\u2192', description: 'Nudge layer 1px'},
      {keys: '\u21E7\u2190\u2191\u2193\u2192', description: 'Nudge layer 10px'},
      {keys: 'Esc', description: 'Deselect layer'},
      {keys: '\u2325Click', description: 'Cycle overlapping layers'},
    ],
  },
  {
    title: 'Blur',
    entries: [
      { keys: 'B', description: 'Toggle HQ blur preview' },
      { keys: '\u21E7B', description: 'Toggle bypass all blur' },
    ],
  },
  {
    title: 'Keyframes',
    entries: [
      { keys: 'I', description: 'Add keyframe at current frame' },
    ],
  },
];

/** Total number of tabs: Sections index (0) + 7 group tabs (1-7) */
const TAB_COUNT = 8;

/** Tab labels: index 0 = Sections, indices 1-7 = group titles */
const TAB_LABELS = ['Sections', ...SHORTCUT_GROUPS.map((g) => g.title)];

export function ShortcutsOverlay() {
  const [activeTab, setActiveTab] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        uiStore.closeShortcutsOverlay();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        setActiveTab((prev) => (prev + 1) % TAB_COUNT);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveTab((prev) => (prev - 1 + TAB_COUNT) % TAB_COUNT);
        return;
      }
      // Number keys 1-7: direct jump to group tab
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7) {
        e.preventDefault();
        setActiveTab(num);
        return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        class="relative bg-[var(--color-bg-toolbar)] border border-[var(--color-border-subtle)] rounded-lg shadow-xl max-w-[600px] w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-[var(--color-text-heading)]">
            Keyboard Shortcuts
          </h2>
          <button
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
            onClick={() => uiStore.closeShortcutsOverlay()}
            title="Close"
          >
            <span class="text-sm text-[var(--color-text-muted)]">{'\u2715'}</span>
          </button>
        </div>

        {/* Tab bar */}
        <div class="flex flex-wrap border-b border-[var(--color-border-subtle)]">
          {TAB_LABELS.map((label, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={label}
                class={`px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--color-text-heading)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
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
            // Sections index tab (placeholder - implemented in Task 2)
            <div class="flex flex-col gap-1">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} class="px-3 py-2 text-sm text-[var(--color-text-button)]">
                  {group.title}
                </div>
              ))}
            </div>
          ) : (
            // Group tab: show entries for SHORTCUT_GROUPS[activeTab - 1]
            <div class="flex flex-col gap-2">
              {SHORTCUT_GROUPS[activeTab - 1].entries.map((entry) => (
                <div key={entry.keys} class="flex items-center justify-between gap-3 py-1">
                  <span class="text-sm text-[var(--color-text-button)]">{entry.description}</span>
                  <kbd class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-bg-hover-item)] border border-[var(--color-border-kbd)] text-xs font-mono text-[var(--color-text-link)]">
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

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
      {keys: '\u21E7\u2423', description: 'Full-speed playback (no UI feedback)'},
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
      {keys: 'Home / \u21E7\u2318\u2190', description: 'Go to start of timeline'},
      {keys: 'End / \u21E7\u2318\u2192', description: 'Go to end of timeline'},
      {keys: 'PgUp / \u2318\u2190 / \u2191', description: 'Jump to previous sequence'},
      {keys: 'PgDn / \u2318\u2192 / \u2193', description: 'Jump to next sequence'},
      {keys: '\u21E7\u2318T', description: 'Cycle theme'},
      {keys: '?', description: 'Toggle this help'},
    ],
  },
  {
    title: 'Canvas',
    entries: [
      {keys: '= / +', description: 'Zoom in (when mouse over canvas)'},
      {keys: '\u2212', description: 'Zoom out (when mouse over canvas)'},
      {keys: '\u23180', description: 'Fit to window'},
      {keys: 'F', description: 'Toggle fit lock'},
      {keys: '\u2318Scroll', description: 'Zoom at cursor'},
      {keys: '\u2190\u2191\u2193\u2192', description: 'Nudge layer 1px'},
      {keys: '\u21E7\u2190\u2191\u2193\u2192', description: 'Nudge layer 10px'},
      {keys: '\u21E7\u2318F', description: 'Toggle fullscreen canvas'},
      {keys: 'Esc', description: 'Deselect layer'},
      {keys: '\u2325Click', description: 'Cycle overlapping layers'},
    ],
  },
  {
    title: 'Timeline',
    entries: [
      {keys: '= / +', description: 'Zoom in (when mouse over timeline)'},
      {keys: '\u2212', description: 'Zoom out (when mouse over timeline)'},
      {keys: '\u2303Scroll', description: 'Zoom at cursor'},
      {keys: '\u2318Scroll', description: 'Vertical scroll'},
      {keys: 'Scroll', description: 'Natural scroll (trackpad)'},
      {keys: '\u21E7Scroll', description: 'Vertical scroll'},
    ],
  },
  {
    title: 'Blur',
    entries: [
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

/** Total number of tabs: Sections index (0) + 8 group tabs (1-8) */
const TAB_COUNT = 9;

/** Tab labels: index 0 = Sections, indices 1-7 = group titles */
const TAB_LABELS = ['Sections', ...SHORTCUT_GROUPS.map((g) => g.title)];

export function ShortcutsOverlay() {
  const [activeTab, setActiveTab] = useState(0);
  const [focusedRow, setFocusedRow] = useState(0);

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
        setActiveTab((prev) => (prev + 1) % TAB_COUNT);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab((prev) => (prev - 1 + TAB_COUNT) % TAB_COUNT);
        return;
      }
      // Number keys 1-8: direct jump to group tab
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab(num);
        return;
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
          <h2 class="text-base font-semibold text-(--color-text-heading)">
            Keyboard Shortcuts
          </h2>
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
          {TAB_LABELS.map((label, index) => {
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

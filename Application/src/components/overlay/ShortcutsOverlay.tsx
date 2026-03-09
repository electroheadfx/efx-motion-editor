import {useEffect} from 'preact/hooks';
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
    entries: [{keys: '?', description: 'Toggle this help'}],
  },
];

export function ShortcutsOverlay() {
  // Dismiss with Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        uiStore.closeShortcutsOverlay();
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
        class="relative bg-[#1C1C1C] border border-[#333333] rounded-lg shadow-xl max-w-[600px] w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-[#E0E0E0]">
            Keyboard Shortcuts
          </h2>
          <button
            class="flex items-center justify-center w-7 h-7 rounded hover:bg-[#333333] transition-colors cursor-pointer"
            onClick={() => uiStore.closeShortcutsOverlay()}
            title="Close"
          >
            <span class="text-sm text-[#999999]">{'\u2715'}</span>
          </button>
        </div>

        {/* 2-column grid of shortcut groups */}
        <div class="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 class="text-[11px] font-semibold text-[#888888] tracking-wider uppercase mb-2.5">
                {group.title}
              </h3>
              <div class="flex flex-col gap-1.5">
                {group.entries.map((entry) => (
                  <div
                    key={entry.keys}
                    class="flex items-center justify-between gap-3 py-1"
                  >
                    <span class="text-sm text-[#CCCCCC]">
                      {entry.description}
                    </span>
                    <kbd class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded bg-[#2A2A2A] border border-[#444444] text-xs font-mono text-[#AAAAAA]">
                      {entry.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

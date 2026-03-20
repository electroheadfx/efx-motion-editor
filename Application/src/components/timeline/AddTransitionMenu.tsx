import {useState, useEffect, useRef} from 'preact/hooks';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';

/** Popover menu for adding transitions to the active content sequence */
export function AddTransitionMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Determine active content sequence and available transitions
  const activeSeqId = sequenceStore.activeSequenceId.value;
  const allSeqs = sequenceStore.sequences.value;
  const activeSeq = activeSeqId ? allSeqs.find(s => s.id === activeSeqId) : null;
  const isContentSeq = activeSeq?.kind === 'content';

  // Cross dissolve: only when next content sequence exists
  const contentSeqs = allSeqs.filter(s => s.kind === 'content');
  const currentIndex = isContentSeq ? contentSeqs.findIndex(s => s.id === activeSeqId) : -1;
  const hasNextSeq = currentIndex >= 0 && currentIndex < contentSeqs.length - 1;

  const canFadeIn = isContentSeq && !activeSeq!.fadeIn;
  const canFadeOut = isContentSeq && !activeSeq!.fadeOut;
  const canCrossDissolve = isContentSeq && hasNextSeq && !activeSeq!.crossDissolve;
  const hasAnyOption = canFadeIn || canFadeOut || canCrossDissolve;

  // Compute 20% of sequence total frames as default duration
  const totalFrames = activeSeq
    ? activeSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0)
    : 0;
  const defaultDuration = Math.max(1, Math.round(totalFrames * 0.2));

  const handleAdd = (type: 'fade-in' | 'fade-out' | 'cross-dissolve') => {
    setMenuOpen(false);
    if (!activeSeqId) return;
    sequenceStore.addTransition(activeSeqId, {
      type,
      duration: defaultDuration,
      mode: 'transparency',
      color: '#000000',
      curve: 'ease-in-out',
    });
    // Auto-select the newly added transition
    uiStore.selectTransition({ sequenceId: activeSeqId, type });
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        class={`rounded px-2 py-[5px] transition-colors ${
          isContentSeq && hasAnyOption
            ? 'bg-[var(--color-bg-input)] hover:bg-[var(--color-border-subtle)]'
            : 'bg-[var(--color-bg-input)] opacity-40 cursor-default'
        }`}
        onClick={() => {
          if (isContentSeq && hasAnyOption) setMenuOpen(!menuOpen);
        }}
        title={!isContentSeq ? 'Select a content sequence first' : !hasAnyOption ? 'All transitions already added' : 'Add transition'}
      >
        <span class="text-[10px] text-[var(--color-text-secondary)]">+ Transition</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 bottom-8 z-50 bg-[var(--color-bg-menu)] border border-[var(--color-border-subtle)] rounded-md shadow-xl py-1 min-w-[160px]">
          {canFadeIn && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-button)] hover:bg-[var(--color-hover-overlay)] flex items-center gap-2"
              onClick={() => handleAdd('fade-in')}
            >
              Fade In
            </button>
          )}
          {canFadeOut && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-button)] hover:bg-[var(--color-hover-overlay)] flex items-center gap-2"
              onClick={() => handleAdd('fade-out')}
            >
              Fade Out
            </button>
          )}
          {canCrossDissolve && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-button)] hover:bg-[var(--color-hover-overlay)] flex items-center gap-2"
              onClick={() => handleAdd('cross-dissolve')}
            >
              Cross Dissolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}

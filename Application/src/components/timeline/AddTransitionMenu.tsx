import {useState, useEffect, useRef} from 'preact/hooks';
import {Layers} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';

/** Popover menu for adding transitions to content or FX sequences */
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

  const allSeqs = sequenceStore.sequences.value;

  // Content sequence: via activeSequenceId
  const activeSeqId = sequenceStore.activeSequenceId.value;
  const activeSeq = activeSeqId ? allSeqs.find(s => s.id === activeSeqId) : null;
  const isContentSeq = activeSeq?.kind === 'content';

  // FX/content-overlay sequence: via selected layer
  const selectedLayerId = layerStore.selectedLayerId.value;
  let fxSeq: typeof allSeqs[0] | null = null;
  if (selectedLayerId) {
    for (const seq of allSeqs) {
      if ((seq.kind === 'fx' || seq.kind === 'content-overlay') && seq.layers.some(l => l.id === selectedLayerId)) {
        fxSeq = seq;
        break;
      }
    }
  }

  // Determine target sequence (FX selection takes priority over content)
  const targetSeq = fxSeq ?? (isContentSeq ? activeSeq : null);
  const targetSeqId = targetSeq?.id ?? null;
  const isFxTarget = targetSeq != null && targetSeq.kind !== 'content';

  // Cross dissolve: only for content sequences with a next content sequence
  const contentSeqs = allSeqs.filter(s => s.kind === 'content');
  const currentIndex = isContentSeq ? contentSeqs.findIndex(s => s.id === activeSeqId) : -1;
  const hasNextSeq = currentIndex >= 0 && currentIndex < contentSeqs.length - 1;

  const canFadeIn = targetSeq != null && !targetSeq.fadeIn;
  const canFadeOut = targetSeq != null && !targetSeq.fadeOut;
  const canCrossDissolve = isContentSeq && hasNextSeq && !activeSeq!.crossDissolve && !activeSeq!.glTransition;
  const hasAnyOption = canFadeIn || canFadeOut || canCrossDissolve;

  // Default duration: 20% of sequence total frames
  let totalFrames = 0;
  if (targetSeq) {
    if (targetSeq.kind === 'content') {
      totalFrames = targetSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
    } else {
      totalFrames = (targetSeq.outFrame ?? 100) - (targetSeq.inFrame ?? 0);
    }
  }
  const defaultDuration = Math.max(1, Math.round(totalFrames * 0.2));

  const handleAdd = (type: 'fade-in' | 'fade-out' | 'cross-dissolve') => {
    setMenuOpen(false);
    if (!targetSeqId) return;
    sequenceStore.addTransition(targetSeqId, {
      type,
      duration: defaultDuration,
      mode: 'transparency',
      color: '#000000',
      curve: 'ease-in-out',
    });
    uiStore.selectTransition({ sequenceId: targetSeqId, type });
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        class={`rounded px-2 py-[5px] transition-colors ${
          targetSeq && hasAnyOption
            ? 'bg-(--color-bg-input) hover:bg-(--color-border-subtle)'
            : 'bg-(--color-bg-input) opacity-40 cursor-default'
        }`}
        onClick={() => {
          if (targetSeq && hasAnyOption) setMenuOpen(!menuOpen);
        }}
        title={!targetSeq ? 'Select a sequence first' : !hasAnyOption ? 'All transitions already added' : 'Add transition'}
      >
        <span class="text-[10px] text-(--color-text-secondary) flex items-center gap-1"><Layers size={11} /> Transition</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 bottom-8 z-50 bg-(--color-bg-menu) border border-(--color-border-subtle) rounded-md shadow-xl py-1 min-w-[160px]">
          {isFxTarget && (
            <div class="px-3 py-1 text-[9px] text-(--color-text-dim) font-semibold">{targetSeq!.name}</div>
          )}
          {canFadeIn && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
              onClick={() => handleAdd('fade-in')}
            >
              Fade In
            </button>
          )}
          {canFadeOut && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
              onClick={() => handleAdd('fade-out')}
            >
              Fade Out
            </button>
          )}
          {canCrossDissolve && (
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
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

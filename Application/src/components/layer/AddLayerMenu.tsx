import {useState, useEffect, useRef} from 'preact/hooks';
import {uiStore} from '../../stores/uiStore';

/** Simple intent-dispatching menu for adding layers */
export function AddLayerMenu() {
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

  const handleStaticImage = () => {
    setMenuOpen(false);
    uiStore.setAddLayerIntent({ type: 'static-image' });
    uiStore.setEditorMode('imported');
  };
  const handleImageSequence = () => {
    setMenuOpen(false);
    uiStore.setAddLayerIntent({ type: 'image-sequence' });
    uiStore.setEditorMode('imported');
  };
  const handleVideo = () => {
    setMenuOpen(false);
    uiStore.setAddLayerIntent({ type: 'video' });
    uiStore.setEditorMode('imported');
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        class="flex items-center transition-colors hover:brightness-110"
        style={{ gap: '4px', padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--sidebar-input-bg)' }}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sidebar-text-button)' }}>+</span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--sidebar-text-button)' }}>Add</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 top-7 z-50 bg-(--color-bg-menu) border border-(--color-border-subtle) rounded-md shadow-xl py-1 min-w-[160px]">
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={handleStaticImage}
          >
            <span class="w-2 h-2 rounded-sm bg-[#14B8A6] shrink-0" />
            Static Image
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={handleImageSequence}
          >
            <span class="w-2 h-2 rounded-sm bg-[#3B82F6] shrink-0" />
            Image Sequence
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={handleVideo}
          >
            <span class="w-2 h-2 rounded-sm bg-[#8B5CF6] shrink-0" />
            Video
          </button>
        </div>
      )}
    </div>
  );
}

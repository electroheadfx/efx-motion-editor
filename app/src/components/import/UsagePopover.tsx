import {useEffect} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import type {UsageLocation} from '../../lib/assetUsage';

interface UsagePopoverProps {
  assetId: string;
  assetName: string;
  assetPath: string;
  assetType: 'image' | 'video' | 'audio';
  locations: UsageLocation[];
  count: number;
  position: {x: number; y: number};
  onClose: () => void;
  onRemoveRef: () => void;
  onDeleteFile: () => void;
}

export function UsagePopover({assetId: _assetId, assetName: _assetName, assetPath: _assetPath, assetType: _assetType, locations, count, position, onClose, onRemoveRef, onDeleteFile}: UsagePopoverProps) {
  // Props forwarded for extensibility but not rendered directly
  void _assetId; void _assetName; void _assetPath; void _assetType;
  // Click-outside dismiss (matches existing context menu pattern)
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Clamp position to viewport
  const left = Math.min(position.x, window.innerWidth - 280);
  const top = Math.min(position.y, window.innerHeight - 300);

  return createPortal(
    <div
      class="fixed z-50"
      style={{
        top,
        left,
        backgroundColor: 'var(--sidebar-panel-bg)',
        border: '1px solid var(--sidebar-border-unselected)',
        borderRadius: '6px',
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        minWidth: '200px',
        maxWidth: '280px',
      }}
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        class="text-[11px] font-semibold"
        style={{
          color: 'var(--sidebar-text-primary)',
          padding: '8px 12px',
        }}
      >
        {count > 0 ? `Used in ${count} location${count !== 1 ? 's' : ''}` : 'Not used anywhere'}
      </div>

      {/* Location list */}
      {count > 0 && (
        <div
          style={{
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          {locations.map((loc, i) => (
            <div
              key={`${loc.sequenceId}-${loc.type}-${i}`}
              class="text-[12px]"
              style={{
                color: 'var(--sidebar-text-secondary)',
                padding: '4px 12px',
              }}
            >
              {loc.sequenceName} &gt; {loc.detail}
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--sidebar-border-unselected)',
          margin: '4px 0',
        }}
      />

      {/* Remove Reference button */}
      <button
        class="w-full text-left text-[12px] hover:bg-[#ffffff10]"
        style={{
          color: 'var(--sidebar-text-button)',
          padding: '8px 12px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
        }}
        onClick={onRemoveRef}
      >
        Remove Reference
      </button>

      {/* Delete File button */}
      <button
        class="w-full text-left text-[12px] hover:bg-[#ffffff10]"
        style={{
          color: 'var(--color-error-text)',
          padding: '8px 12px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
        }}
        onClick={onDeleteFile}
      >
        Delete File
      </button>
    </div>,
    document.body,
  );
}

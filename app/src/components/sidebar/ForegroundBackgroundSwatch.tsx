import {paintStore} from '../../stores/paintStore';

/**
 * Photoshop-style foreground/background swatch (quick-261004-hwa).
 *
 * Two overlapping squares: back (background) offset down-right behind,
 * front (foreground) on top offset up-left. Front is the active picker target.
 * Session-only colors — no persistence, no second picker.
 */
export function ForegroundBackgroundSwatch({ onActiveColorChanged }: {
  /** Called with the new foreground hex after swap or promote so the engine's brush color can follow. */
  onActiveColorChanged?: (color: string) => void;
} = {}) {
  const fg = paintStore.foregroundColor.value;
  const bg = paintStore.backgroundColorSwatch.value;

  const squareBase: Record<string, string> = {
    width: '18px',
    height: '18px',
    padding: '0',
    borderRadius: '3px',
    border: '1px solid var(--color-border-subtle)',
    cursor: 'pointer',
  };

  return (
    <div class="relative shrink-0" style={{width: '32px', height: '32px'}}>
      {/* Background slot — behind, offset down-right */}
      <button
        type="button"
        class="absolute"
        style={{
          ...squareBase,
          backgroundColor: bg,
          right: '0',
          bottom: '0',
          zIndex: 1,
        }}
        title="Background color"
        onClick={() => {
          paintStore.setActiveFromBackground();
          onActiveColorChanged?.(paintStore.foregroundColor.peek());
        }}
      />
      {/* Foreground slot — on top, offset up-left */}
      <button
        type="button"
        class="absolute"
        style={{
          ...squareBase,
          backgroundColor: fg,
          left: '0',
          top: '0',
          zIndex: 2,
        }}
        title="Foreground color"
        onClick={() => onActiveColorChanged?.(paintStore.foregroundColor.peek())}
      />
    </div>
  );
}

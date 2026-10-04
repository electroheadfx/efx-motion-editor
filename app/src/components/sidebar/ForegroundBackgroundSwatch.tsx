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
    width: '24px',
    height: '24px',
    padding: '0',
    borderRadius: '3px',
    cursor: 'pointer',
  };

  return (
    <div class="relative shrink-0" style={{width: '34px', height: '34px'}}>
      {/* Background slot — behind, offset down-right so it peeks out at the corner */}
      <button
        type="button"
        class="absolute"
        style={{
          ...squareBase,
          backgroundColor: bg,
          right: '0',
          bottom: '0',
          border: '1px solid #aaa',
          zIndex: 1,
        }}
        title="Background color"
        onClick={() => {
          paintStore.setActiveFromBackground();
          onActiveColorChanged?.(paintStore.foregroundColor.peek());
        }}
      />
      {/* Foreground slot — on top, offset up-left; white border marks it as the active/picker target */}
      <button
        type="button"
        class="absolute"
        style={{
          ...squareBase,
          backgroundColor: fg,
          left: '0',
          top: '0',
          border: '2px solid #fff',
          zIndex: 2,
        }}
        title="Foreground color"
        onClick={() => onActiveColorChanged?.(paintStore.foregroundColor.peek())}
      />
    </div>
  );
}

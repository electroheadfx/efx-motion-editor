import {useRef, useEffect, useState} from 'preact/hooks';
import '@efxlab/motion-canvas-player';

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('initializing...');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = document.createElement('motion-canvas-player');
    player.setAttribute('auto', '');
    player.setAttribute('responsive', '');
    player.setAttribute('background', '#000000');
    player.style.width = '100%';
    player.style.height = '100%';
    container.prepend(player);

    // Monitor player state changes via MutationObserver on class/attribute
    const checkState = () => {
      const shadow = player.shadowRoot;
      if (!shadow) {
        setStatus('no shadow root');
        return;
      }
      const overlay = shadow.querySelector('.overlay');
      if (!overlay) {
        setStatus('no overlay found');
        return;
      }
      const classes = overlay.className;
      if (classes.includes('state-error')) setStatus('ERROR: player failed to load');
      else if (classes.includes('state-loading')) setStatus('loading...');
      else if (classes.includes('state-ready')) setStatus('ready');
      else setStatus(`state: ${classes}`);
    };

    // Set src after appending to DOM
    setStatus('setting src...');
    player.setAttribute('src', '/src/project.ts?project');

    // Check state periodically for a few seconds
    const interval = setInterval(checkState, 500);
    setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      container.removeChild(player);
    };
  }, []);

  return (
    <div class="relative w-full">
      <div
        ref={containerRef}
        class="relative w-full aspect-video bg-black rounded overflow-hidden"
      />
      <div class="text-xs text-[var(--color-text-secondary)] mt-1 text-center">
        Player: {status}
      </div>
    </div>
  );
}

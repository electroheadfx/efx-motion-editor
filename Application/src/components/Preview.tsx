import {useRef, useEffect} from 'preact/hooks';
import '@efxlab/motion-canvas-player';

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create the player element programmatically to ensure attributes
    // are set after the custom element is connected to the DOM
    const player = document.createElement('motion-canvas-player');
    player.setAttribute('auto', '');
    player.setAttribute('responsive', '');
    player.setAttribute('background', '#000000');
    container.appendChild(player);

    // Set src after element is in DOM so updateSource fires correctly
    player.setAttribute('src', '/src/project.ts?project');

    return () => {
      container.removeChild(player);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      class="relative w-full aspect-video bg-black rounded overflow-hidden"
    />
  );
}

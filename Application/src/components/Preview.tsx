import {useRef} from 'preact/hooks';
import '@efxlab/motion-canvas-player';

export function Preview() {
  const playerRef = useRef<HTMLElement>(null);

  return (
    <div class="relative w-full aspect-video bg-black rounded overflow-hidden">
      <motion-canvas-player
        ref={playerRef}
        src="/src/project.ts?project"
        auto
        responsive
        background="#000000"
      />
    </div>
  );
}

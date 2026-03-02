/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import {makeScene2D, Rect, Txt} from '@efxlab/motion-canvas-2d';
import {waitFor} from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  view.add(
    <Rect
      width={1920}
      height={1080}
      fill="#1a1a2e"
    >
      <Txt
        text="EFX Motion Canvas"
        fontSize={72}
        fontFamily="Arial"
        fill="#e0e0e0"
      />
    </Rect>,
  );
  yield* waitFor(5);
});

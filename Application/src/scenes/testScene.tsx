/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import {makeScene2D, Rect, Txt} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  const rectRef = createRef<Rect>();
  view.add(
    <Rect
      ref={rectRef}
      width={800}
      height={400}
      fill="#4466ff"
      radius={20}
    >
      <Txt text="EFX Motion Editor" fill="#ffffff" fontSize={48} fontWeight={700} />
    </Rect>,
  );
  yield* waitFor(5);
});

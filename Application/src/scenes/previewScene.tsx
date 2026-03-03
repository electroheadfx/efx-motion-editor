/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import {makeScene2D, Img, Rect} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  const imgRef = createRef<Img>();
  view.add(
    <Rect width={'100%'} height={'100%'} fill="#000000">
      <Img ref={imgRef} width={'100%'} height={'100%'} />
    </Rect>,
  );
  yield* waitFor(Infinity);
});

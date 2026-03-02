/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import {makeScene2D, Img} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';

export default makeScene2D(function* (view) {
  const imageRef = createRef<Img>();
  view.add(
    <Img
      ref={imageRef}
      src="https://picsum.photos/600/400?random=1"
      width={1920}
      height={1080}
    />,
  );
  yield* waitFor(5);
});

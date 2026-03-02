/** @jsxImportSource @efxlab/motion-canvas-2d/lib */
import {makeScene2D, Img} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';
import testImage from '../assets/test-image.jpg';

export default makeScene2D(function* (view) {
  const imageRef = createRef<Img>();
  view.add(
    <Img
      ref={imageRef}
      src={testImage}
      width={1920}
      height={1080}
    />,
  );
  yield* waitFor(1);
});

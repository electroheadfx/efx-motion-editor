export function getRotoNavigationTargets(input: {
  currentFrame: number;
  framesToApply: number;
  savedFrames: readonly { frame: number }[];
  playFrames: readonly { appFrame: number }[];
}) {
  const highestSavedFrame = input.savedFrames.reduce((max, frame) => Math.max(max, frame.frame), 0);
  const playEndFrame = input.playFrames.reduce((max, frame) => Math.max(max, frame.appFrame), 0);
  return {
    first: 0,
    previous: Math.max(0, input.currentFrame - 1),
    next: input.currentFrame + 1,
    last: Math.max(input.currentFrame, highestSavedFrame, playEndFrame, input.framesToApply - 1),
  };
}

export function createRotoNavigationActions(input: {
  getTargets: () => ReturnType<typeof getRotoNavigationTargets>;
  requestNavigation: (frame: number) => Promise<boolean>;
}) {
  const request = (target: keyof ReturnType<typeof getRotoNavigationTargets>) => {
    void input.requestNavigation(input.getTargets()[target]);
  };
  return {
    goToFirstFrame: () => request('first'),
    goToPreviousFrame: () => request('previous'),
    goToNextFrame: () => request('next'),
    goToLastFrame: () => request('last'),
  };
}

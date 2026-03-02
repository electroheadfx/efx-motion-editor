export interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
}

export interface KeyPhoto {
  id: string;
  imagePath: string;
  holdFrames: number;
}

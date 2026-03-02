export type LayerType = 'static-image' | 'image-sequence' | 'video';
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
}

export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
}

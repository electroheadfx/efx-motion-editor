export type LayerType = 'static-image' | 'image-sequence' | 'video';
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';

/** Source data varies by layer type */
export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  | { type: 'image-sequence'; imageIds: string[] }  // Base layer: empty array (uses sequence's keyPhotos/frameMap). Overlay layers: imported image IDs sorted by filename, indexed as frame % imageIds.length
  | { type: 'video'; videoPath: string };  // Relative path within project

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSourceData;
  isBase?: boolean;  // true for auto-generated base layer (non-deletable)
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

/** Create a default LayerTransform with identity values */
export function defaultTransform(): LayerTransform {
  return { x: 0, y: 0, scale: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 };
}

/** Create the auto-generated base layer for a sequence */
export function createBaseLayer(): Layer {
  return {
    id: 'base',
    name: 'Key Photos',
    type: 'image-sequence',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'image-sequence', imageIds: [] },
    isBase: true,
  };
}

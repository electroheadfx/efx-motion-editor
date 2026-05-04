# Files

## File: app/src/components/canvas/coordinateMapper.ts
````typescript
export interface Point {
  x: number;
  y: number;
}
⋮----
export function clientToCanvas(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
  paddingTop = 0,
  paddingBottom = 0,
): Point
⋮----
export function canvasToClient(
  projX: number,
  projY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
  paddingTop = 0,
  paddingBottom = 0,
): Point
⋮----
export function screenToProjectDistance(
  screenDist: number,
  zoom: number,
): number
````

## File: app/src/components/canvas/hitTest.ts
````typescript
import type {Layer} from '../../types/layer';
import type {Point} from './coordinateMapper';
import {getLayerBounds, pointInPolygon} from './transformHandles';
import {isFxLayer} from '../../types/layer';
⋮----
export function hitTestLayers(
  point: Point,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null,
): string | null
⋮----
export function hitTestLayersCycle(
  point: Point,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null,
  currentSelectedId: string | null,
): string | null
````

## File: app/src/components/canvas/MotionPath.tsx
````typescript
import {signal} from '@preact/signals';
import type {Keyframe} from '../../types/layer';
import {interpolateAt} from '../../lib/keyframeEngine';
import {keyframeStore} from '../../stores/keyframeStore';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {trackLayouts} from '../../lib/frameMap';
import type {KeyframeCircle} from './motionPathHitTest';
⋮----
export function hasMotion(keyframes: Keyframe[]): boolean
⋮----
export function sampleMotionDots(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
):
⋮----
function findLayerStartFrame(layerId: string): number
````

## File: app/src/components/canvas/motionPathHitTest.ts
````typescript
import type {Point} from './coordinateMapper';
⋮----
export interface KeyframeCircle {
  x: number;
  y: number;
  frame: number;
}
⋮----
export function hitTestKeyframeCircles(
  point: Point,
  circles: KeyframeCircle[],
  zoom: number,
  hitScreenSize: number = 12,
): number | null
````

## File: app/src/components/canvas/OnionSkinOverlay.tsx
````typescript
import {useEffect, useRef} from 'preact/hooks';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {projectStore} from '../../stores/projectStore';
import {renderPaintFrame} from '../../lib/paintRenderer';
⋮----
export function OnionSkinOverlay()
````

## File: app/src/components/canvas/transformHandles.ts
````typescript
import type {Layer} from '../../types/layer';
import type {Point} from './coordinateMapper';
⋮----
export type HandleType =
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-br'
  | 'corner-bl'
  | 'edge-top'
  | 'edge-right'
  | 'edge-bottom'
  | 'edge-left'
  | 'rotate';
⋮----
export interface HandlePosition {
  type: HandleType;
  x: number;
  y: number;
}
⋮----
export interface LayerBounds {
  corners: Point[];
  center: Point;
  drawW: number;
  drawH: number;
}
⋮----
export function getLayerBounds(
  layer: Layer,
  sourceWidth: number,
  sourceHeight: number,
  canvasW: number,
  canvasH: number,
): LayerBounds
⋮----
export function getHandlePositions(
  bounds: LayerBounds,
  _zoom: number,
): HandlePosition[]
⋮----
export function hitTestHandles(
  point: Point,
  handles: HandlePosition[],
  zoom: number,
  handleScreenSize: number = 10,
): HandleType | null
⋮----
export function getRotationZone(
  point: Point,
  bounds: LayerBounds,
  zoom: number,
): boolean
⋮----
function baseAngleForHandle(handle: HandleType): number
⋮----
export function getCursorForHandle(
  handle: HandleType | null,
  isRotationZone: boolean,
  rotation: number,
): string
⋮----
export function pointInPolygon(point: Point, polygon: Point[]): boolean
````

## File: app/src/components/canvas/TransformOverlay.tsx
````typescript
import {useRef} from 'preact/hooks';
import type {RefObject} from 'preact';
import type {Layer, LayerTransform} from '../../types/layer';
import {isFxLayer} from '../../types/layer';
import {layerStore} from '../../stores/layerStore';
import {paintStore} from '../../stores/paintStore';
import {uiStore} from '../../stores/uiStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {timelineStore} from '../../stores/timelineStore';
import {startCoalescing, stopCoalescing} from '../../lib/history';
import {blurStore} from '../../stores/blurStore';
import {clientToCanvas} from './coordinateMapper';
import {
  getLayerBounds,
  getHandlePositions,
  hitTestHandles,
  getRotationZone,
  getCursorForHandle,
  pointInPolygon,
} from './transformHandles';
import type {HandleType, LayerBounds} from './transformHandles';
import {hitTestLayers, hitTestLayersCycle} from './hitTest';
import {keyframeStore} from '../../stores/keyframeStore';
import {hitTestKeyframeCircles} from './motionPathHitTest';
import {motionPathCircles} from './MotionPath';
import {playbackEngine} from '../../lib/playbackEngine';
import {sequenceStore} from '../../stores/sequenceStore';
import {trackLayouts} from '../../lib/frameMap';
import type {KeyframeValues} from '../../types/layer';
⋮----
interface TransformOverlayProps {
  containerRef: RefObject<HTMLDivElement>;
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null;
  isSpaceHeld: RefObject<boolean>;
  onPanStart: (e: PointerEvent) => void;
}
⋮----
type DragMode = 'none' | 'pending' | 'pan-pending' | 'move' | 'scale' | 'rotate' | 'kf-pending' | 'kf-drag';
⋮----
interface DragState {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startLayerTransform: LayerTransform;
  handleType?: HandleType;
  layerId?: string;
  startBounds?: LayerBounds;
  _restoreBlur?: boolean;
  kfIndex?: number;
  kfStartValues?: KeyframeValues;
}
⋮----
function findLayerStartFrame(layerId: string): number
⋮----
function applyInterpolatedTransform(layer: Layer): Layer
⋮----
function getLayerById(layerId: string): Layer | undefined
⋮----
updateCursor(e);
⋮----
applyScale(e, currentState);
````

## File: app/src/components/export/ExportPreview.tsx
````typescript
import {useEffect, useRef} from 'preact/hooks';
import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import {totalFrames, frameMap, crossDissolveOverlaps} from '../../lib/frameMap';
import {sequenceStore} from '../../stores/sequenceStore';
import {PreviewRenderer} from '../../lib/previewRenderer';
import {renderGlobalFrame, preloadExportImages} from '../../lib/exportRenderer';
import {soloStore} from '../../stores/soloStore';
import {open} from '@tauri-apps/plugin-dialog';
⋮----
const handlePickFolder = async () =>
````

## File: app/src/components/export/ExportProgress.tsx
````typescript
import { exportStore } from '../../stores/exportStore';
import { exportOpenInFinder } from '../../lib/ipc';
import { resumeExport } from '../../lib/exportEngine';
import { uiStore } from '../../stores/uiStore';
⋮----
function formatEta(seconds: number | null): string
⋮----
// Don't render if idle
⋮----
exportStore.resetProgress();
uiStore.setEditorMode('editor');
````

## File: app/src/components/export/FormatSelector.tsx
````typescript
import {useEffect} from 'preact/hooks';
import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import {audioStore} from '../../stores/audioStore';
import {motionBlurStore} from '../../stores/motionBlurStore';
import {sequenceStore} from '../../stores/sequenceStore';
import type {ExportFormat, ExportResolution} from '../../types/export';
⋮----
onClick=
⋮----
onInput=
````

## File: app/src/components/import/DropZone.tsx
````typescript
import {isDraggingOver} from '../../lib/dragDrop';
⋮----
export function DropZone()
````

## File: app/src/components/import/ImportGrid.tsx
````typescript
import {useRef, useState, useCallback, useEffect} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {computed} from '@preact/signals';
import {Film, Music} from 'lucide-preact';
import {imageStore, type VideoAsset} from '../../stores/imageStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {audioStore} from '../../stores/audioStore';
import {assetUrl} from '../../lib/ipc';
import {UsageBadge} from './UsageBadge';
import {UsagePopover} from './UsagePopover';
import {getAllAssetUsages} from '../../lib/assetUsage';
import {cascadeRemoveAsset, cascadeDeleteFile} from '../../lib/assetRemoval';
⋮----
interface ImportGridProps {
  onSelect?: (imageId: string) => void;
  multiSelect?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (imageId: string) => void;
  assetFilter?: 'all' | 'images-only' | 'videos-only' | 'audio-only';
  onVideoSelect?: (videoId: string) => void;
  onAudioSelect?: (audioAssetId: string) => void;
}
⋮----
export function ImportGrid(
⋮----
const close = ()
⋮----
const onMeta = () =>
````

## File: app/src/components/import/UsageBadge.tsx
````typescript
import type {FunctionalComponent} from 'preact';
⋮----
interface UsageBadgeProps {
  count: number;
  onClick: (e: MouseEvent) => void;
  layout?: 'thumbnail' | 'inline';
}
⋮----
export const UsageBadge: FunctionalComponent<UsageBadgeProps> = (
⋮----
onMouseLeave=
````

## File: app/src/components/import/UsagePopover.tsx
````typescript
import {useEffect} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import type {UsageLocation} from '../../lib/assetUsage';
⋮----
interface UsagePopoverProps {
  assetId: string;
  assetName: string;
  assetPath: string;
  assetType: 'image' | 'video' | 'audio';
  locations: UsageLocation[];
  count: number;
  position: {x: number; y: number};
  onClose: () => void;
  onRemoveRef: () => void;
  onDeleteFile: () => void;
}
⋮----
const handler = ()
⋮----
onMouseDown=
````

## File: app/src/components/layer/AddLayerMenu.tsx
````typescript
import {useState, useEffect, useRef} from 'preact/hooks';
import {uiStore} from '../../stores/uiStore';
import {isolationStore} from '../../stores/isolationStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {totalFrames, trackLayouts} from '../../lib/frameMap';
⋮----
function handleClick(e: MouseEvent)
⋮----
const handleStaticImage = () =>
const handleImageSequence = () =>
const handleVideo = () =>
⋮----
onClick=
````

## File: app/src/components/layer/LayerList.tsx
````typescript
import {useRef, useEffect} from 'preact/hooks';
import Sortable from 'sortablejs';
import {GripVertical, Eye, EyeOff, X, Lock} from 'lucide-preact';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {audioStore} from '../../stores/audioStore';
import type {Layer} from '../../types/layer';
⋮----
onMove(evt)
onEnd(evt)
⋮----
const handleSelect = () =>
⋮----
const handleToggleVisibility = (e: MouseEvent) =>
⋮----
const handleDelete = (e: MouseEvent) =>
````

## File: app/src/components/layout/EditorShell.tsx
````typescript
import { useCallback, useEffect } from 'preact/hooks';
import { Toolbar } from './Toolbar';
import { LeftPanel } from './LeftPanel';
import { CanvasArea } from './CanvasArea';
import { TimelinePanel } from './TimelinePanel';
import { ImportedView } from '../views/ImportedView';
import { SettingsView } from '../views/SettingsView';
import { ExportView } from '../views/ExportView';
import { ShaderBrowser } from '../shader-browser/ShaderBrowser';
import { DropZone } from '../import/DropZone';
import { ShortcutsOverlay } from '../overlay/ShortcutsOverlay';
import { FullscreenOverlay } from '../overlay/FullscreenOverlay';
import { CollapseHandle } from '../sidebar/CollapseHandle';
import { initFullscreenListener } from '../../lib/fullscreenManager';
import { useFileDrop } from '../../lib/dragDrop';
import { imageStore } from '../../stores/imageStore';
import { layerStore } from '../../stores/layerStore';
import { projectStore } from '../../stores/projectStore';
import { uiStore } from '../../stores/uiStore';
import { paintStore } from '../../stores/paintStore';
import { tempProjectDir } from '../../lib/projectDir';
````

## File: app/src/components/layout/ThemeSwitcher.tsx
````typescript
import { currentTheme, setTheme, type Theme } from '../../lib/themeManager';
⋮----
export function ThemeSwitcher()
⋮----
onClick=
````

## File: app/src/components/layout/TimelinePanel.tsx
````typescript
import {useRef, useCallback, useEffect} from 'preact/hooks';
import {Play, Pause, SkipBack, SkipForward, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Plus, Minus, Shrink, Repeat, Repeat1, Music, Magnet, Headphones} from 'lucide-preact';
import {timelineStore} from '../../stores/timelineStore';
import {uiStore} from '../../stores/uiStore';
import {isolationStore} from '../../stores/isolationStore';
import {soloStore} from '../../stores/soloStore';
import {audioStore} from '../../stores/audioStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {findPrevSequenceStart, findNextSequenceStart} from '../../lib/sequenceNav';
import {totalFrames, trackLayouts} from '../../lib/frameMap';
import {TimelineCanvas} from '../timeline/TimelineCanvas';
import {TimelineScrollbar} from '../timeline/TimelineScrollbar';
import {AddLayerMenu} from '../timeline/AddFxMenu';
import {AddTransitionMenu} from '../timeline/AddTransitionMenu';
import {AddAudioButton} from '../timeline/AddAudioButton';
import {BASE_FRAME_WIDTH} from '../timeline/TimelineRenderer';
⋮----
onMouseLeave=
⋮----
````

## File: app/src/components/layout/TitleBar.tsx
````typescript
import {projectStore} from '../../stores/projectStore';
⋮----
export function TitleBar()
````

## File: app/src/components/layout/Toolbar.tsx
````typescript
import {open, save} from '@tauri-apps/plugin-dialog';
import {useState, useRef, useEffect} from 'preact/hooks';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {guardUnsavedChanges} from '../../lib/unsavedGuard';
import {NewProjectDialog} from '../project/NewProjectDialog';
import {blurStore} from '../../stores/blurStore';
import {motionBlurStore} from '../../stores/motionBlurStore';
import {ThemeSwitcher} from './ThemeSwitcher';
import { FilePlus, FolderOpen, Save as SaveIcon, Ban, Images, Settings, Download, Zap, ChevronDown } from 'lucide-preact';
⋮----
const handler = (e: MouseEvent) =>
⋮----
const handleNew = async () =>
⋮----
const handleOpen = async () =>
⋮----
const handleSave = async () =>
⋮----
onClick=
⋮----
onInput=
````

## File: app/src/components/overlay/FullscreenOverlay.tsx
````typescript
import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {isFullscreen, exitFullscreen} from '../../lib/fullscreenManager';
import {playbackEngine, isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';
import {projectStore} from '../../stores/projectStore';
import {Preview} from '../Preview';
⋮----
export function FullscreenOverlay()
⋮----
const handleKeyDown = (e: KeyboardEvent) =>
⋮----
function formatTime(seconds: number): string
````

## File: app/src/components/overlay/FullSpeedBadge.tsx
````typescript
import {isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';
⋮----
export function FullSpeedBadge()
````

## File: app/src/components/overlay/ShortcutsOverlay.tsx
````typescript
import {useEffect, useState} from 'preact/hooks';
import {uiStore} from '../../stores/uiStore';
⋮----
interface ShortcutEntry {
  keys: string;
  description: string;
}
⋮----
interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}
⋮----
function handleKeyDown(e: KeyboardEvent)
⋮----
onClick=
````

## File: app/src/components/overlay/SpeedBadge.tsx
````typescript
import {currentSpeedLabel, showSpeedBadge} from '../../lib/jklShuttle';
⋮----
export function SpeedBadge()
````

## File: app/src/components/project/NewProjectDialog.tsx
````typescript
import {useState, useEffect, useRef} from 'preact/hooks';
import {open as openDialog} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';
⋮----
interface NewProjectDialogProps {
  onClose: () => void;
}
⋮----
const handleChooseFolder = async () =>
⋮----
const handleCreate = async () =>
⋮----
const handleKeyDown = (e: KeyboardEvent) =>
⋮----
onClick=
````

## File: app/src/components/project/WelcomeScreen.tsx
````typescript
import {useState, useEffect} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {pathExists} from '../../lib/ipc';
import {getRecentProjects, removeRecentProject, updateRecentProjectPath, type RecentProject} from '../../lib/appConfig';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {NewProjectDialog} from './NewProjectDialog';
⋮----
interface RecentProjectEntry extends RecentProject {
  available: boolean;
}
⋮----
function FeaturePill(
⋮----
onClick=
````

## File: app/src/components/sequence/KeyPhotoStrip.tsx
````typescript
import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import Sortable from 'sortablejs';
import {Camera, Square, Blend, Pipette, X, Plus, Minus, Music} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {imageStore} from '../../stores/imageStore';
import {audioStore} from '../../stores/audioStore';
import {assetUrl} from '../../lib/ipc';
import {trackLayouts} from '../../lib/frameMap';
import {playbackEngine} from '../../lib/playbackEngine';
import {getTopLayerId} from '../../lib/layerSelection';
import {getActiveKeyPhotoIndex} from '../../lib/keyPhotoNav';
import {snapHoldFramesToBeat} from '../../lib/beatMarkerEngine';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {buildGradientCSS} from '../shared/GradientBar';
import type {GradientData} from '../../types/sequence';
⋮----
export function KeyPhotoStrip()
⋮----
onClick=
⋮----
onEnd(evt)
⋮----
sequenceStore.clearKeyPhotoSelection();
⋮----
function handleClick(e: MouseEvent)
⋮----
function handleKey(e: KeyboardEvent)
⋮----
e.stopPropagation();
sequenceStore.toggleKeyEntryTransparent(sequenceId, keyPhotoId);
⋮----
setPickerPos(
setPickerOpen(!pickerOpen);
⋮----
onGradientLiveChange=
⋮----
onClose=
````

## File: app/src/components/sequence/SequenceList.tsx
````typescript
import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import Sortable from 'sortablejs';
import {GripVertical, Ellipsis, Clapperboard, Layers} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {isolationStore} from '../../stores/isolationStore';
import {uiStore} from '../../stores/uiStore';
import {audioStore} from '../../stores/audioStore';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';
import {trackLayouts} from '../../lib/frameMap';
import {playbackEngine} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';
import {getTopLayerId} from '../../lib/layerSelection';
import {KeyPhotoStripInline, AddKeyPhotoButton} from './KeyPhotoStrip';
import type {Sequence} from '../../types/sequence';
import {isKeySolid, isKeyTransparent} from '../../types/sequence';
⋮----
onEnd(evt)
⋮----
function handleClick(e: MouseEvent)
⋮----
e.stopPropagation();
startRename();
⋮----
handleDelete();
````

## File: app/src/components/shader-browser/ShaderBrowser.tsx
````typescript
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { X, Sparkles, Image, ArrowRightLeft, LayoutGrid } from 'lucide-preact';
import { uiStore } from '../../stores/uiStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { totalFrames } from '../../lib/frameMap';
import { renderShaderPreview, renderGlslFxImage, renderGlslTransition } from '../../lib/glslRuntime';
import { getAllShaders, getShadersByCategory, getDefaultParams } from '../../lib/shaderLibrary';
import { getCapturedCanvas } from '../../lib/shaderPreviewCapture';
import { imageStore } from '../../stores/imageStore';
import { assetUrl } from '../../lib/ipc';
import { defaultTransform } from '../../types/layer';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import type { ShaderDefinition, ShaderCategory } from '../../lib/shaderLibrary';
import type { Layer, LayerSourceData, BlendMode } from '../../types/layer';
import type { GlTransition } from '../../types/sequence';
⋮----
function getTransitionImageIds():
⋮----
function drawImageOrFallback(
  canvas: HTMLCanvasElement, imageId: string | null,
  gradFrom: string, gradTo: string,
): Promise<void>
⋮----
function ensureTransitionCache(fromId: string | null, toId: string | null)
⋮----
function getTransitionPreviewImages():
⋮----
function getTransitionDetailImages():
⋮----
type TabId = ShaderCategory | 'transition' | 'all';
⋮----
interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Sparkles;
  disabled?: boolean;
}
⋮----
const animate = () =>
⋮----
const renderFx = () =>
⋮----
onClick=
⋮----
const updateParam = (key: string, value: number) =>
⋮----
const updateParams = (updates: Record<string, number>) =>
⋮----
const rgbToHex = (r: number, g: number, b: number): string =>
⋮----
const toHex = (v: number)
⋮----
const hexToRgb = (hex: string): [number, number, number] =>
⋮----
{/* Preview */}
⋮----
onClose=
⋮----
{/* Apply button */}
⋮----
// ---- Main Browser Component ----
⋮----
// D-03: Compute whether Apply should be enabled for transition shaders
⋮----
// D-01, D-03: Transition apply targets active sequence + next adjacent
⋮----
if (idx < 0 || idx >= contentSeqs.length - 1) return; // D-03: disabled if no next sequence
⋮----
// Preserve existing duration/curve when swapping shaders
⋮----
// Existing generator/fx-image logic
⋮----
// Close browser (D-08)
⋮----
{/* Header */}
⋮----
{/* Tab bar -- DaVinci Resolve-style pills */}
````

## File: app/src/components/shared/ColorPickerModal.tsx
````typescript
import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {X} from 'lucide-preact';
import type {GradientData, GradientStop} from '../../types/sequence';
import {createDefaultGradient} from '../../types/sequence';
import {GradientBar, buildGradientCSS} from './GradientBar';
import {hexToRgba, rgbaToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb} from '../../lib/colorUtils';
⋮----
type ColorMode = 'hex' | 'rgba' | 'hsl';
type FillMode = 'solid' | 'gradient';
⋮----
export interface ColorPickerModalProps {
  color: string;
  onLiveChange?: (color: string) => void;
  onCommit: (color: string) => void;
  onClose: () => void;
  mouseX?: number;
  mouseY?: number;
  gradient?: GradientData;
  onGradientChange?: (gradient: GradientData) => void;
  onGradientLiveChange?: (gradient: GradientData) => void;
  showGradientMode?: boolean;
}
⋮----
function handleKey(e: KeyboardEvent)
⋮----
const modeButtonClass = (m: ColorMode)
⋮----
const fillModeButtonClass = (m: FillMode)
⋮----
onClick=
⋮----
class=
````

## File: app/src/components/shared/GradientBar.tsx
````typescript
import {useRef, useCallback} from 'preact/hooks';
import type {GradientStop} from '../../types/sequence';
⋮----
interface GradientBarProps {
  stops: GradientStop[];
  gradientType: 'linear' | 'radial' | 'conic';
  angle?: number;
  centerX?: number;
  centerY?: number;
  onStopsChange: (stops: GradientStop[]) => void;
  onStopSelect: (index: number) => void;
  selectedStopIndex: number;
}
⋮----
export function buildGradientCSS(
  stops: GradientStop[],
  type: string,
  angle?: number,
  cx?: number,
  cy?: number,
): string
⋮----
function sampleGradientColor(stops: GradientStop[], position: number): string
⋮----
function lerpColor(hex1: string, hex2: string, t: number): string
⋮----
const parse = (h: string) =>
⋮----
const toHex = (n: number)
⋮----
export function GradientBar({
  stops,
  gradientType,
  angle,
  centerX,
  centerY,
  onStopsChange,
  onStopSelect,
  selectedStopIndex,
}: GradientBarProps)
⋮----
onPointerDown=
````

## File: app/src/components/shared/NumericInput.tsx
````typescript
import { useState, useCallback } from 'preact/hooks';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
⋮----
// Show up to 3 decimals, strip trailing zeros
⋮----
const onMove = (ev: PointerEvent) =>
⋮----
const onUp = () =>
````

## File: app/src/components/shared/SectionLabel.tsx
````typescript
export function SectionLabel(
````

## File: app/src/components/sidebar/AudioProperties.tsx
````typescript
import {useState} from 'preact/hooks';
import {Volume2, VolumeX, Loader2} from 'lucide-preact';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readFile} from '@tauri-apps/plugin-fs';
import {NumericInput} from '../shared/NumericInput';
import {SectionLabel} from '../shared/SectionLabel';
import {audioStore} from '../../stores/audioStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {projectStore} from '../../stores/projectStore';
import {startCoalescing, stopCoalescing, pushAction} from '../../lib/history';
import {autoArrangeHoldFrames, type ArrangeStrategy} from '../../lib/beatMarkerEngine';
import type {AudioTrack, FadeCurve} from '../../types/audio';
⋮----
interface AudioPropertiesProps {
  track: AudioTrack;
}
⋮----
const handleReplace = async () =>
⋮----
audioStore.updateTrack(track.id,
⋮----
onPointerUp=
⋮----
const handleApply = () =>
⋮----
onClick=
````

## File: app/src/components/sidebar/CollapseHandle.tsx
````typescript
import { useRef } from 'preact/hooks';
import { GripVertical } from 'lucide-preact';
import { uiStore } from '../../stores/uiStore';
import { setSidebarWidth } from '../../lib/appConfig';
⋮----
export function CollapseHandle()
⋮----
const handlePointerDown = (e: PointerEvent) =>
⋮----
const onMove = (ev: PointerEvent) =>
⋮----
const onUp = () =>
````

## File: app/src/components/sidebar/CollapsibleSection.tsx
````typescript
import type { Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { ChevronDown } from 'lucide-preact';
⋮----
interface CollapsibleSectionProps {
  title: string;
  collapsed: Signal<boolean>;
  headerActions?: ComponentChildren;
  children: ComponentChildren;
  onCollapse?: (collapsed: boolean) => void;
}
⋮----
export function CollapsibleSection(
⋮----
const handleToggle = () =>
⋮----
<div onClick=
````

## File: app/src/components/sidebar/InlineInterpolation.tsx
````typescript
import { keyframeStore } from '../../stores/keyframeStore';
import { layerStore } from '../../stores/layerStore';
import type { EasingType } from '../../types/layer';
⋮----
const handleSelect = (easing: EasingType) =>
⋮----
onClick=
````

## File: app/src/components/sidebar/KeyframeNavBar.tsx
````typescript
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-preact';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { trackLayouts } from '../../lib/frameMap';
import { playbackEngine } from '../../lib/playbackEngine';
import { getKeyframeNav } from '../../lib/keyframeNav';
import type { Layer } from '../../types/layer';
⋮----
interface KeyframeNavBarProps {
  layer: Layer;
}
⋮----
function getLocalFrameForLayer(layerId: string, globalFrame: number): number
⋮----
function getSequenceStartFrame(layerId: string): number
⋮----
export function KeyframeNavBar(
⋮----
const handlePrev = () =>
⋮----
const handleNext = () =>
⋮----
const handleAddOrUpdate = () =>
⋮----
const handleDelete = () =>
````

## File: app/src/components/sidebar/PanelResizer.tsx
````typescript
import { GripHorizontal } from 'lucide-preact';
⋮----
interface PanelResizerProps {
  onResize: (deltaY: number) => void;
  onResizeEnd: () => void;
}
⋮----
const handlePointerDown = (e: PointerEvent) =>
⋮----
const onMove = (ev: PointerEvent) =>
⋮----
const onUp = () =>
````

## File: app/src/components/sidebar/SidebarFxProperties.tsx
````typescript
import { useEffect, useState, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import { KeyframeNavBar } from './KeyframeNavBar';
import { InlineInterpolation } from './InlineInterpolation';
import { layerStore } from '../../stores/layerStore';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isGeneratorLayer } from '../../types/layer';
import { COLOR_GRADE_PRESETS, PRESET_NAMES } from '../../lib/fxPresets';
import { getShaderById } from '../../lib/shaderLibrary';
import type { ShaderDefinition } from '../../lib/shaderLibrary';
import { renderShaderPreview, renderGlslFxImage } from '../../lib/glslRuntime';
import { capturePreviewCanvas, getCapturedCanvas } from '../../lib/shaderPreviewCapture';
import type { Layer, LayerSourceData, BlendMode } from '../../types/layer';
⋮----
function capitalize(s: string): string
⋮----
function updateSource(layerId: string, layer: Layer, updates: Record<string, unknown>)
⋮----
interface FxSectionKfProps {
  onFxEdit?: (field: string, value: number) => void;
  fxValues?: Record<string, number>;
}
⋮----
onClick=
⋮----
const v = (field: string, fallback: number)
const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer,
⋮----
<NumericInput label="Density" value=
⋮----
<NumericInput label="Size" value=
⋮----
<NumericInput label="Intensity" value=
⋮----
<NumericInput label="Count" value=
⋮----
<NumericInput label="Speed" value=
⋮----
<NumericInput label="Min" value=
⋮----
<NumericInput label="Max" value=
⋮----
<NumericInput label="Thick" value=
⋮----
<NumericInput label="Softness" value=
⋮----
const handlePresetChange = (presetName: string) =>
⋮----
const handleParamChange = (field: string, value: number | string) =>
⋮----
<NumericInput label="Bright" value=
⋮----
<NumericInput label="Contrast" value=
⋮----
<NumericInput label="Sat" value=
⋮----
<NumericInput label="Hue" value=
⋮----
<NumericInput label="Fade" value=
⋮----
onClose=
⋮----
<NumericInput label="Radius" value=
⋮----
const animate = () =>
⋮----
onClick={(e) => { e.stopPropagation(); e.preventDefault(); import('@tauri-apps/api/core').then(m => m.invoke('export_open_in_finder', { path: shader.url! })); }}
              >Shadertoy</a>
            )}
          </div>
        </div>
        {}
        {shader.params.length > 0 && (
          <div class="px-5 py-4 space-y-3">
            <div class="text-[9px] text-(--color-text-dim) font-semibold">PARAMETERS</div>
⋮----
{/* Close button */}
⋮----
/** Convert RGB floats (0-1) to hex string */
⋮----
const toHex = (v: number)
⋮----
/** Mode label for the B&W filter */
⋮----
if (p.hidden) continue;
⋮----
onChange=
⋮----
<button
              class="text-(--color-text-muted) hover:text-(--color-text-button) transition-colors p-0.5"
              title={fxIsVisible ? 'Hide layer' : 'Show layer'}
onClick=
⋮----
startCoalescing();
⋮----
onInput=
⋮----
layerStore.updateLayer(layer.id, {
                  blendMode: (e.target as HTMLSelectElement).value as BlendMode,
                });
````

## File: app/src/components/sidebar/SidebarResizer.tsx
````typescript
import { uiStore } from '../../stores/uiStore';
import { setSidebarWidth } from '../../lib/appConfig';
⋮----
export function SidebarResizer()
⋮----
const handlePointerDown = (e: PointerEvent) =>
⋮----
const onMove = (ev: PointerEvent) =>
⋮----
const onUp = () =>
````

## File: app/src/components/sidebar/SidebarScrollArea.tsx
````typescript
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
⋮----
interface SidebarScrollAreaProps {
  children: ComponentChildren;
  class?: string;
}
⋮----
export function SidebarScrollArea(
onMouseEnter=
onMouseLeave=
````

## File: app/src/components/sidebar/TransitionProperties.tsx
````typescript
import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore, type TransitionSelection } from '../../stores/uiStore';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import { getShaderById } from '../../lib/shaderLibrary';
import type { FadeMode } from '../../types/sequence';
import type { EasingType } from '../../types/layer';
⋮----
interface TransitionPropertiesProps {
  selection: NonNullable<TransitionSelection>;
}
⋮----
sequenceStore.updateGlTransition(selection.sequenceId,
⋮----
sequenceStore.updateTransition(selection.sequenceId, selType,
⋮----
onClick=
⋮----
setColorPickerPos(
setColorPickerOpen(true);
⋮----
sequenceStore.removeTransition(selection.sequenceId, selType);
uiStore.selectTransition(null);
````

## File: app/src/components/timeline/AddAudioButton.tsx
````typescript
import {Music} from 'lucide-preact';
import {uiStore} from '../../stores/uiStore';
⋮----
export function AddAudioButton()
⋮----
const handleAddAudio = () =>
````

## File: app/src/components/timeline/AddTransitionMenu.tsx
````typescript
import {useState, useEffect, useRef} from 'preact/hooks';
import {Layers} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
⋮----
export function AddTransitionMenu()
⋮----
function handleClick(e: MouseEvent)
⋮----
const handleAdd = (type: 'fade-in' | 'fade-out' | 'cross-dissolve') =>
````

## File: app/src/components/timeline/ThumbnailCache.ts
````typescript
export class ThumbnailCache
⋮----
get(imageId: string, thumbnailUrl: string): HTMLImageElement | null
⋮----
clear()
````

## File: app/src/components/timeline/TimelineCanvas.tsx
````typescript
import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {TimelineRenderer, invalidateColorCache} from './TimelineRenderer';
import {TimelineInteraction} from './TimelineInteraction';
import {timelineStore} from '../../stores/timelineStore';
import {trackLayouts, fxTrackLayouts, audioTrackLayouts} from '../../lib/frameMap';
import {imageStore} from '../../stores/imageStore';
import {layerStore} from '../../stores/layerStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {keyframeStore} from '../../stores/keyframeStore';
import {audioStore} from '../../stores/audioStore';
⋮----
import {currentTheme} from '../../lib/themeManager';
import {isFullSpeed} from '../../lib/playbackEngine';
import {isolationStore} from '../../stores/isolationStore';
import {uiStore} from '../../stores/uiStore';
⋮----
export function TimelineCanvas()
````

## File: app/src/components/timeline/TimelineInteraction.ts
````typescript
import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {keyframeStore} from '../../stores/keyframeStore';
import {audioStore} from '../../stores/audioStore';
import {paintStore} from '../../stores/paintStore';
import {trackLayouts, fxTrackLayouts, audioTrackLayouts} from '../../lib/frameMap';
import {startCoalescing, stopCoalescing} from '../../lib/history';
import {snapToBeat} from '../../lib/beatMarkerEngine';
import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, RULER_HEIGHT, FX_TRACK_HEIGHT, TRACK_HEIGHT} from './TimelineRenderer';
import type {TimelineRenderer} from './TimelineRenderer';
import {isolationStore} from '../../stores/isolationStore';
⋮----
export class TimelineInteraction
⋮----
private fxDragStartFrame = 0; // frame at pointer-down
⋮----
// FX header reorder drag state (FX-10)
⋮----
// Keyframe hover state
⋮----
// Keyframe diamond drag state (KF-09)
⋮----
private kfDragFromFrame = 0;  // sequence-local frame
private kfDragSequenceStartFrame = 0;  // global start of the owning sequence
⋮----
// Audio track drag state (INT-03, INT-04, INT-05)
⋮----
// Audio track reorder state (INT-06)
⋮----
// Audio track height resize state (INT-07)
⋮----
// Bound handlers for cleanup
⋮----
attach(canvas: HTMLCanvasElement, renderer: TimelineRenderer)
⋮----
detach()
⋮----
private getFrame(clientX: number): number
⋮----
private snapFrame(frame: number): number
⋮----
private isOnPlayhead(clientX: number): boolean
⋮----
private isInRuler(clientY: number): boolean
⋮----
private isInFxArea(clientY: number): boolean
⋮----
private fxTrackIndexFromY(clientY: number): number
⋮----
private fxDropIndexFromY(clientY: number): number
⋮----
private selectFxSequenceLayer(sequenceId: string): void
⋮----
private sequenceFromFrame(frame: number): string | null
⋮----
private clearFxLayerSelection(): void
⋮----
private getAudioSectionY(): number
⋮----
private isInAudioArea(clientY: number): boolean
⋮----
private audioTrackHitFromY(clientY: number):
⋮----
private audioDragModeFromX(
    clientX: number,
    audioTrack: { offsetFrame: number; inFrame: number; outFrame: number },
): 'move' | 'resize-left' | 'resize-right' | null
⋮----
private audioDropIndexFromY(clientY: number): number
⋮----
private nameLabelHitTest(clientX: number, clientY: number): string | null
⋮----
private fxDragModeFromX(clientX: number, fxTrack:
⋮----
private keyframeHitTest(clientX: number, clientY: number):
⋮----
private transitionHitTest(
    localX: number,
    localY: number,
):
⋮----
deleteSelectedKeyframes(): void
⋮----
private onPointerDown(e: PointerEvent)
⋮----
private onPointerMove(e: PointerEvent)
⋮----
private onPointerUp(e: PointerEvent)
⋮----
private onWheel(e: WheelEvent)
⋮----
private onGestureStart(e: Event)
⋮----
private onGestureChange(e: Event)
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}
````

## File: app/src/components/timeline/TimelineRenderer.ts
````typescript
import type {TrackLayout, FxTrackLayout, AudioTrackLayout} from '../../types/timeline';
import type {imageStore as ImageStoreType} from '../../stores/imageStore';
import {computeDownbeatFrames} from '../../lib/beatMarkerEngine';
import {createCanvasGradient} from '../../lib/previewRenderer';
import {ThumbnailCache} from './ThumbnailCache';
⋮----
function getThemeColors(): Record<string, string>
⋮----
export function invalidateColorCache(): void
⋮----
export interface FxDragState {
  fromIndex: number;
  toIndex: number;
  currentY: number;
}
⋮----
export interface DrawState {
  frame: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  tracks: TrackLayout[];
  fxTracks: FxTrackLayout[];
  imageStore: typeof ImageStoreType;
  totalFrames: number;
  selectedFxSequenceId?: string | null;
  selectedContentSequenceId?: string | null;
  selectedLayerKeyframes?: { frame: number; easing: string }[];
  selectedKeyframeFrames?: Set<number>;
  selectedLayerSequenceId?: string | null;
  hidePlayhead?: boolean;
  isolatedSequenceIds?: Set<string>;
  hoveredNameLabelSequenceId?: string | null;
  selectedTransition?: { sequenceId: string; type: 'fade-in' | 'fade-out' | 'cross-dissolve' | 'gl-transition' } | null;
  audioTracks?: AudioTrackLayout[];
  selectedAudioTrackId?: string | null;
  beatMarkersVisible?: boolean;
  snapToBeatsEnabled?: boolean;
}
⋮----
export class TimelineRenderer
⋮----
constructor(private canvas: HTMLCanvasElement)
⋮----
private setupCanvas()
⋮----
resize()
⋮----
draw(state: DrawState)
⋮----
private drawTransitionOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    trackY: number,
    trackH: number,
    type: 'fade-in' | 'fade-out' | 'cross-dissolve',
    isSelected: boolean,
    fullHeight = false,
): void
⋮----
private drawGlTransitionOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    trackY: number,
    trackH: number,
    isSelected: boolean,
): void
⋮----
private resolveTrackColor(fxTrack: FxTrackLayout): string
⋮----
private drawFxTrack(
    ctx: CanvasRenderingContext2D,
    fxTrack: FxTrackLayout,
    y: number,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    isSelected = false,
    imageStore?: typeof ImageStoreType,
    state?: DrawState,
): void
⋮----
// Only draw if icon is within visible bar area
⋮----
thumbOffsetX = iconW + 4; // shift name text right
⋮----
// Name text inside the bar (shifted right when thumbnail is present)
⋮----
private drawCheckerboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cellSize = 4): void
⋮----
private drawLinearTrack(
    ctx: CanvasRenderingContext2D,
    state: DrawState,
    tracks: TrackLayout[],
    frameWidth: number,
    scrollX: number,
    w: number,
    fxOffset: number,
    colors: Record<string, string>,
): void
⋮----
private drawBeatMarkers(
    ctx: CanvasRenderingContext2D,
    beatMarkers: number[],
    downbeats: Set<number>,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    yTop: number,
    yBottom: number,
): void
⋮----
private drawAudioTrack(
    ctx: CanvasRenderingContext2D,
    track: AudioTrackLayout,
    y: number,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    colors: Record<string, string>,
): void
⋮----
private drawRuler(
    ctx: CanvasRenderingContext2D,
    frameWidth: number,
    scrollX: number,
    width: number,
    totalFrames: number,
)
⋮----
frameFromX(clientX: number, canvasRect: DOMRect, scrollX: number, zoom: number, totalFrames: number): number
⋮----
getDisplayWidth(): number
⋮----
getFxTrackCount(): number
⋮----
getScrollY(): number
⋮----
getContentTrackY(): number
⋮----
getNameLabelRect(
    track: TrackLayout,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    trackY: number,
):
⋮----
setFxDragState(state: FxDragState | null)
⋮----
setSelectedFxSequenceId(id: string | null)
⋮----
setHoveredKeyframe(frame: number | null)
⋮----
setHoveredNameLabel(sequenceId: string | null)
⋮----
private drawLosange(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
): void
⋮----
private drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
): void
⋮----
private drawHalfCircleLeft(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
): void
⋮----
private drawHalfCircleRight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
): void
⋮----
private drawKeyframeIcon(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number,
    easing: string,
    isSelected: boolean,
    isHovered: boolean,
): void
⋮----
private drawKeyframeDiamonds(
    ctx: CanvasRenderingContext2D,
    state: DrawState,
    w: number,
): void
⋮----
destroy()
⋮----
private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string
````

## File: app/src/components/timeline/TimelineScrollbar.tsx
````typescript
import { useRef, useCallback } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { timelineStore } from '../../stores/timelineStore';
⋮----
export function TimelineScrollbar()
````

## File: app/src/components/views/ExportView.tsx
````typescript
import {useEffect} from 'preact/hooks';
import {FormatSelector} from '../export/FormatSelector';
import {ExportPreview} from '../export/ExportPreview';
import {ExportProgress} from '../export/ExportProgress';
import {uiStore} from '../../stores/uiStore';
import {exportStore} from '../../stores/exportStore';
import {startExport} from '../../lib/exportEngine';
⋮----
export function ExportView()
````

## File: app/src/components/views/ImportedView.tsx
````typescript
import {useState, useCallback, useEffect} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readFile} from '@tauri-apps/plugin-fs';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {audioStore} from '../../stores/audioStore';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {defaultTransform} from '../../types/layer';
import type {Layer} from '../../types/layer';
import {ImportGrid} from '../import/ImportGrid';
import {tempProjectDir} from '../../lib/projectDir';
import {totalFrames} from '../../lib/frameMap';
⋮----
const handleSelectForKeyPhoto = (imageId: string) =>
⋮----
const handleImport = async () =>
⋮----
try { await mkdir(audioDir, { recursive: true }); } catch { /* exists */ }
⋮----
// Only add asset if not already imported (same path = same file)
⋮----
try { await mkdir(videosDir, { recursive: true }); } catch { /* exists */ }
⋮----
// Image import flow (existing behavior)
````

## File: app/src/components/views/SettingsView.tsx
````typescript
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {ThemeSwitcher} from '../layout/ThemeSwitcher';
⋮----
onClick=
````

## File: app/src/components/AssetProtocolTest.tsx
````typescript
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { assetUrl } from '../lib/ipc';
⋮----
const handleLoad = () =>
const handleError = () =>
````

## File: app/src/components/Preview.tsx
````typescript
import {useRef, useEffect} from 'preact/hooks';
import {effect} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {blurStore} from '../stores/blurStore';
import {paintStore} from '../stores/paintStore';
import {soloStore} from '../stores/soloStore';
import {frameMap, crossDissolveOverlaps} from '../lib/frameMap';
import {PreviewRenderer} from '../lib/previewRenderer';
import {renderGlobalFrame} from '../lib/exportRenderer';
⋮----
export function Preview()
⋮----
function renderFromFrameMap(globalFrame: number)
⋮----
function tick()
````

## File: app/src/lib/appConfig.ts
````typescript
import { LazyStore } from '@tauri-apps/plugin-store';
import { configGetTheme, configSetTheme, configGetCanvasBg, configSetCanvasBg, configGetSidebarWidth, configSetSidebarWidth, configGetPanelHeights, configSetPanelHeights, configGetLoopEnabled, configSetLoopEnabled } from './ipc';
⋮----
export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}
⋮----
export interface AppConfig {
  windowWidth: number;
  windowHeight: number;
  lastProjectPath: string | null;
}
⋮----
export async function getRecentProjects(): Promise<RecentProject[]>
⋮----
export async function addRecentProject(project: RecentProject): Promise<void>
⋮----
export async function removeRecentProject(path: string): Promise<void>
⋮----
export async function updateRecentProjectPath(oldPath: string, newPath: string): Promise<void>
⋮----
export async function getAppConfig(): Promise<AppConfig>
⋮----
export async function setLastProjectPath(path: string | null): Promise<void>
⋮----
export async function setWindowSize(width: number, height: number): Promise<void>
⋮----
export async function getTheme(): Promise<string | null>
⋮----
export async function setThemePreference(theme: string): Promise<void>
⋮----
export async function getCanvasBg(theme: string): Promise<string | null>
⋮----
export async function setCanvasBg(theme: string, color: string): Promise<void>
⋮----
export async function getSidebarWidth(): Promise<number>
⋮----
export async function setSidebarWidth(width: number): Promise<void>
⋮----
export async function getPanelHeights(): Promise<[number, number]>
⋮----
export async function setPanelHeights(seqHeight: number, layersHeight: number): Promise<void>
⋮----
export async function getPanelFlex(): Promise<[number, number]>
⋮----
export async function setPanelFlex(seq: number, prop: number): Promise<void>
⋮----
export async function getLoopEnabled(): Promise<boolean>
⋮----
export async function setLoopEnabled(enabled: boolean): Promise<void>
````

## File: app/src/lib/assetRemoval.ts
````typescript
import {batch} from '@preact/signals';
import {remove as removeFile} from '@tauri-apps/plugin-fs';
import {imageStore} from '../stores/imageStore';
import {sequenceStore} from '../stores/sequenceStore';
import {audioStore} from '../stores/audioStore';
import {pushAction} from './history';
import type {UsageLocation} from './assetUsage';
import type {Sequence} from '../types/sequence';
import type {AudioTrack} from '../types/audio';
import type {ImportedImage} from '../types/image';
import type {VideoAsset, AudioAsset} from '../stores/imageStore';
⋮----
interface StoreSnapshots {
  seqs: Sequence[];
  seqActive: string | null;
  audioTracks: AudioTrack[];
  audioSelected: string | null;
  imgs: ImportedImage[];
  vids: VideoAsset[];
  auds: AudioAsset[];
}
⋮----
function captureSnapshots(): StoreSnapshots
⋮----
function restoreSnapshots(snap: StoreSnapshots): void
⋮----
function performCascadeMutations(assetId: string, assetType: 'image' | 'video' | 'audio'): void
⋮----
export function cascadeRemoveAsset(
  assetId: string,
  assetType: 'image' | 'video' | 'audio',
  assetName: string,
  locations: UsageLocation[],
): boolean
⋮----
export async function cascadeDeleteFile(
  assetId: string,
  assetType: 'image' | 'video' | 'audio',
  assetName: string,
  assetPath: string,
  locations: UsageLocation[],
  thumbnailPath?: string,
): Promise<boolean>
````

## File: app/src/lib/assetUsage.ts
````typescript
import type {Sequence} from '../types/sequence';
import type {AudioTrack} from '../types/audio';
⋮----
export interface UsageLocation {
  sequenceId: string;
  sequenceName: string;
  type: 'key-photo' | 'layer' | 'audio-track';
  detail: string;
}
⋮----
export interface AssetUsage {
  assetId: string;
  assetType: 'image' | 'video' | 'audio';
  locations: UsageLocation[];
  count: number;
}
⋮----
export function getImageUsage(imageId: string, sequences: Sequence[]): AssetUsage
⋮----
export function getVideoUsage(videoAssetId: string, sequences: Sequence[]): AssetUsage
⋮----
export function getAudioUsage(audioAssetId: string, audioTracks: AudioTrack[]): AssetUsage
⋮----
export function getAllAssetUsages(
  images: Array<{id: string}>,
  videoAssets: Array<{id: string}>,
  audioAssets: Array<{id: string}>,
  sequences: Sequence[],
  audioTracks: AudioTrack[],
): Map<string, AssetUsage>
````

## File: app/src/lib/audioEngine.ts
````typescript
import type {AudioTrack, FadeCurve} from '../types/audio';
⋮----
class AudioEngine
⋮----
ensureContext(): AudioContext
⋮----
async decode(trackId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer>
⋮----
getBuffer(trackId: string): AudioBuffer | undefined
⋮----
play(trackId: string, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): void
⋮----
playDelayed(trackId: string, delaySec: number, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): void
⋮----
stop(trackId: string): void
⋮----
stopAll(): void
⋮----
setVolume(trackId: string, volume: number): void
⋮----
removeTrack(trackId: string): void
⋮----
private applyFadeSchedule(
    gain: GainNode,
    track: AudioTrack,
    audioStartTime: number,
    sourceOffset: number,
    fps: number,
): void
⋮----
private applyRamp(gain: GainNode, targetValue: number, endTime: number, curve: FadeCurve): void
````

## File: app/src/lib/audioExportMixer.ts
````typescript
import type { AudioTrack, FadeCurve } from '../types/audio';
import { audioEngine } from './audioEngine';
import audioBufferToWav from 'audiobuffer-to-wav';
⋮----
function applyRamp(
  gain: GainNode,
  targetValue: number,
  endTime: number,
  curve: FadeCurve,
): void
⋮----
function applyExportFadeSchedule(
  gain: GainNode,
  track: AudioTrack,
  fps: number,
  _sampleRate: number,
): void
⋮----
export async function renderMixedAudio(
  tracks: AudioTrack[],
  fps: number,
  totalDurationSec: number,
  signal?: AbortSignal,
): Promise<ArrayBuffer>
````

## File: app/src/lib/audioPeaksCache.ts
````typescript
import {signal} from '@preact/signals';
import type {WaveformPeaks} from '../types/audio';
⋮----
get(id: string)
set(id: string, peaks: WaveformPeaks)
delete(id: string)
clear()
````

## File: app/src/lib/audioWaveform.ts
````typescript
import type {WaveformPeaks} from '../types/audio';
⋮----
function extractPeaks(mono: Float32Array, totalLength: number, peakCount: number): Float32Array
⋮----
export function computeWaveformPeaks(buffer: AudioBuffer): WaveformPeaks
````

## File: app/src/lib/autoSave.ts
````typescript
import {effect} from '@preact/signals';
import {projectStore} from '../stores/projectStore';
import {sequenceStore} from '../stores/sequenceStore';
import {imageStore} from '../stores/imageStore';
⋮----
function scheduleSave()
⋮----
export function startAutoSave(): void
⋮----
export function stopAutoSave(): void
````

## File: app/src/lib/beatMarkerEngine.ts
````typescript
export function computeBeatMarkers(
  bpm: number,
  beatOffsetFrames: number,
  fps: number,
  totalFrames: number,
): number[]
⋮----
export function computeDownbeatFrames(
  beatMarkers: number[],
  beatsPerBar: number = 4,
): Set<number>
⋮----
export function snapToBeat(
  frame: number,
  beatMarkers: number[],
  thresholdFrames: number,
): number | null
⋮----
export function snapHoldFramesToBeat(
  startFrame: number,
  currentHoldFrames: number,
  beatMarkers: number[],
  thresholdFrames: number,
): number | null
⋮----
export type ArrangeStrategy = 'every-beat' | 'every-2-beats' | 'every-bar';
⋮----
export function autoArrangeHoldFrames(
  numKeyPhotos: number,
  beatMarkers: number[],
  strategy: ArrangeStrategy,
  fps: number,
  bpm: number,
): number[]
````

## File: app/src/lib/bezierPath.ts
````typescript
import fitCurve from 'fit-curve';
import { Bezier } from 'bezier-js';
import type { BezierAnchor, PaintShape } from '../types/paint';
⋮----
export function cubicBezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number,
):
⋮----
function findNearestPressure(
  points: [number, number, number][],
  pos: number[],
): number
⋮----
export function pointsToBezierAnchors(
  points: [number, number, number][],
  tolerance: number = 4.0,
): BezierAnchor[]
⋮----
function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angle: number,
):
⋮----
function rotateAnchor(
  anchor: BezierAnchor,
  cx: number, cy: number,
  angle: number,
): BezierAnchor
⋮----
export function shapeToAnchors(
  shape: PaintShape,
):
⋮----
export function sampleBezierPath(
  anchors: BezierAnchor[],
  spacing: number = 2.0,
  closedPath: boolean = false,
): [number, number, number][]
⋮----
export function insertAnchorOnSegment(
  anchors: BezierAnchor[],
  segmentIndex: number,
  t: number,
): BezierAnchor[]
⋮----
export function deleteAnchor(
  anchors: BezierAnchor[],
  idx: number,
): BezierAnchor[]
⋮----
export function updateCoupledHandle(
  anchor: BezierAnchor,
  draggedSide: 'in' | 'out',
  newPos: { x: number; y: number },
  isAltHeld: boolean,
): void
⋮----
export function dragSegment(
  anchorA: BezierAnchor,
  anchorB: BezierAnchor,
  t: number,
  targetPos: { x: number; y: number },
): void
⋮----
export function findNearestSegment(
  anchors: BezierAnchor[],
  point: { x: number; y: number },
  closedPath: boolean = false,
):
⋮----
export function hitTestAnchor(
  anchors: BezierAnchor[],
  point: { x: number; y: number },
  radius: number,
):
````

## File: app/src/lib/bpmDetector.ts
````typescript
export interface BpmResult {
  bpm: number;
  confidence: number;
}
⋮----
export interface BpmOptions {
  minBPM?: number;
  maxBPM?: number;
}
⋮----
export function detectBPM(
  channelData: Float32Array,
  sampleRate: number,
  options?: BpmOptions,
): BpmResult
````

## File: app/src/lib/brushPreviewData.ts
````typescript
import type { BrushStyle } from '../types/paint';
````

## File: app/src/lib/colorUtils.ts
````typescript
export function hexToRgba(hex: string):
⋮----
export function rgbaToHex(r: number, g: number, b: number, _a?: number): string
⋮----
const toHex = (n: number)
⋮----
export function rgbToHsl(r: number, g: number, b: number):
⋮----
export function hslToRgb(h: number, s: number, l: number):
⋮----
const hue2rgb = (p: number, q: number, t: number) =>
⋮----
export function rgbToHsv(r: number, g: number, b: number):
⋮----
export function hsvToRgb(h: number, s: number, v: number):
⋮----
export function rgbToCmyk(r: number, g: number, b: number):
⋮----
export function cmykToRgb(c: number, m: number, y: number, k: number):
````

## File: app/src/lib/dragDrop.ts
````typescript
import {getCurrentWebview} from '@tauri-apps/api/webview';
import {useEffect} from 'preact/hooks';
import {signal} from '@preact/signals';
⋮----
function isImagePath(p: string): boolean
⋮----
export function useFileDrop(
  onDrop: (paths: string[]) => void,
  onReject?: (rejected: string[]) => void,
)
````

## File: app/src/lib/exportEngine.ts
````typescript
import { PreviewRenderer } from './previewRenderer';
import { renderGlobalFrame, renderFrameWithMotionBlur, preloadExportImages } from './exportRenderer';
import { frameMap, crossDissolveOverlaps } from './frameMap';
import { sequenceStore } from '../stores/sequenceStore';
import { projectStore } from '../stores/projectStore';
import { exportStore } from '../stores/exportStore';
import { audioStore } from '../stores/audioStore';
import { soloStore } from '../stores/soloStore';
import { audioEngine } from './audioEngine';
import { exportCreateDir, exportWritePng, exportCheckFfmpeg, exportDownloadFfmpeg, exportEncodeVideo, exportCleanupPngs, exportCleanupFile } from './ipc';
import { generateJsonSidecar, generateFcpxml } from './exportSidecar';
import { renderMixedAudio } from './audioExportMixer';
⋮----
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>
⋮----
async function blobToUint8Array(blob: Blob): Promise<Uint8Array>
⋮----
function formatFrameFilename(
  projectName: string,
  frameNumber: number,
  totalFrames: number,
  pattern: string,
): string
⋮----
export async function startExport(startFromFrame = 0): Promise<void>
⋮----
export async function resumeExport(): Promise<void>
````

## File: app/src/lib/exportRenderer.ts
````typescript
import {PreviewRenderer} from './previewRenderer';
import {interpolateAt} from './keyframeEngine';
import {computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity, computeTransitionProgress} from './transitionEngine';
import {renderGlslTransition} from './glslRuntime';
import {getShaderById} from './shaderLibrary';
import {motionBlurStore} from '../stores/motionBlurStore';
import {isFxLayer} from '../types/layer';
import type {LayerSourceData} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import type {Sequence} from '../types/sequence';
import type {CrossDissolveOverlap} from './frameMap';
⋮----
function buildSequenceFrames(seq: Sequence): FrameEntry[]
⋮----
function interpolateLayers(seq: Sequence, localFrame: number)
⋮----
function _getOrCreateTransitionOffscreen(w: number, h: number, label: 'A' | 'B'): HTMLCanvasElement
⋮----
export function renderGlobalFrame(
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
  soloActive: boolean = false,
): void
⋮----
export function renderFrameWithMotionBlur(
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  globalFrame: number,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
  subFrames: number,
  shutterAngle: number,
  soloActive: boolean = false,
): void
⋮----
export function preloadExportImages(
  renderer: PreviewRenderer,
  fm: FrameEntry[],
  signal?: AbortSignal,
): Promise<void>
⋮----
const finish = () =>
const fail = (reason: string) =>
⋮----
// Abort signal support (for cancel during preload)
⋮----
const isResolved = (id: string)
⋮----
const check = () =>
````

## File: app/src/lib/exportSidecar.ts
````typescript
import type { Sequence } from '../types/sequence';
⋮----
interface SidecarInput {
  projectName: string;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  resolution: number;
  format: string;
  namingPattern: string;
  sequences: Sequence[];
}
⋮----
export function generateJsonSidecar(input: SidecarInput): string
⋮----
export function generateFcpxml(
  projectName: string,
  fps: number,
  width: number,
  height: number,
  totalFrames: number,
  videoFilename: string,
): string
````

## File: app/src/lib/frameMap.ts
````typescript
import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import {audioStore} from '../stores/audioStore';
import {audioPeaksCache, peaksCacheRevision} from './audioPeaksCache';
import type {FrameEntry, TrackLayout, FxTrackLayout, AudioTrackLayout, KeyPhotoRange} from '../types/timeline';
import type {GlTransition} from '../types/sequence';
import type {Layer, LayerType, EasingType} from '../types/layer';
⋮----
function fxColorForLayerType(type: LayerType): string
⋮----
function getThumbnailImageId(layer: Layer | undefined): string | undefined
⋮----
export interface CrossDissolveOverlap {
  outgoingSequenceId: string;
  incomingSequenceId: string;
  overlapStart: number;
  overlapEnd: number;
  duration: number;
  curve: EasingType;
  outgoingLocalFrameStart: number;
  incomingLocalFrameStart: number;
  glTransition?: GlTransition;
}
````

## File: app/src/lib/fullscreenManager.ts
````typescript
import {signal} from '@preact/signals';
import {playbackEngine} from './playbackEngine';
import {timelineStore} from '../stores/timelineStore';
⋮----
export function enterFullscreen(): void
⋮----
export function exitFullscreen(): void
⋮----
export function toggleFullscreen(): void
⋮----
export function initFullscreenListener(): void
````

## File: app/src/lib/fxBlur.ts
````typescript
import {canvasRGB, canvasRGBA} from 'stackblur-canvas';
import {applyGPUBlur} from './glBlur';
⋮----
export function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number
⋮----
export function applyBlur(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): void
````

## File: app/src/lib/fxColorGrade.ts
````typescript
export interface ColorGradeParams {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  fade: number;
  tintColor: string;
  fadeBlend?: string;
}
⋮----
function getOffscreen(w: number, h: number):
⋮----
export function applyColorGrade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: ColorGradeParams,
): void
````

## File: app/src/lib/fxGenerators.ts
````typescript
import { Random } from '@efxlab/motion-canvas-core';
import type { LayerSourceData } from '../types/layer';
⋮----
type GrainSource = Extract<LayerSourceData, { type: 'generator-grain' }>;
type ParticlesSource = Extract<LayerSourceData, { type: 'generator-particles' }>;
type LinesSource = Extract<LayerSourceData, { type: 'generator-lines' }>;
type DotsSource = Extract<LayerSourceData, { type: 'generator-dots' }>;
type VignetteSource = Extract<LayerSourceData, { type: 'generator-vignette' }>;
⋮----
function effectiveSeed(lockSeed: boolean, seed: number, frame: number): number
⋮----
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: GrainSource,
  frame: number,
): void
⋮----
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: ParticlesSource,
  frame: number,
): void
⋮----
export function drawLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: LinesSource,
  frame: number,
): void
⋮----
export function drawDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: DotsSource,
  frame: number,
): void
⋮----
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: VignetteSource,
): void
````

## File: app/src/lib/fxPresets.ts
````typescript
import type { ColorGradeParams } from './fxColorGrade';
````

## File: app/src/lib/glBlur.ts
````typescript
function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number
⋮----
interface BlurResources {
  program: WebGLProgram;
  texSource: WebGLTexture;
  texIntermediate: WebGLTexture;
  fbo: WebGLFramebuffer;
  vao: WebGLVertexArrayObject;
  uTexture: WebGLUniformLocation;
  uDirection: WebGLUniformLocation;
  uRadius: WebGLUniformLocation;
  uPreserveAlpha: WebGLUniformLocation;
  width: number;
  height: number;
}
⋮----
function getGL(): WebGL2RenderingContext | null
⋮----
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null
⋮----
function createResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): BlurResources | null
⋮----
function ensureResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): BlurResources | null
⋮----
export function applyGPUBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radiusNorm: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): boolean
````

## File: app/src/lib/glMotionBlur.ts
````typescript
interface MotionBlurResources {
  program: WebGLProgram;
  texSource: WebGLTexture;
  texFBO: WebGLTexture;
  fbo: WebGLFramebuffer;
  vao: WebGLVertexArrayObject;
  uIChannel0: WebGLUniformLocation;
  uIResolution: WebGLUniformLocation;
  uVelocity: WebGLUniformLocation;
  uStrength: WebGLUniformLocation;
  uSamples: WebGLUniformLocation;
  width: number;
  height: number;
}
⋮----
function getGL(): WebGL2RenderingContext | null
⋮----
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null
⋮----
function createResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): MotionBlurResources | null
⋮----
function ensureResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): MotionBlurResources | null
⋮----
export function applyMotionBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  velocity: { dx: number; dy: number },
  strength: number,
  samples: number,
  width: number,
  height: number,
): boolean
````

## File: app/src/lib/glslRuntime.ts
````typescript
import type { ShaderDefinition, ShaderParamDef } from './shaderLibrary';
⋮----
function buildFragmentSource(shader: ShaderDefinition): string
⋮----
// ---- Cached program state ----
⋮----
interface CachedProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  paramDefs: ShaderParamDef[];
}
⋮----
// ---- Runtime state ----
⋮----
// ---- GL helpers ----
⋮----
function getGL(): WebGL2RenderingContext | null
⋮----
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null
⋮----
function getOrCreateProgram(gl: WebGL2RenderingContext, shader: ShaderDefinition): CachedProgram | null
⋮----
function ensureCanvasSize(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, w: number, h: number)
⋮----
function bindUniforms(
  gl: WebGL2RenderingContext,
  cached: CachedProgram,
  width: number,
  height: number,
  time: number,
  frame: number,
  params: Record<string, number>,
)
⋮----
function buildTransitionFragmentSource(shader: ShaderDefinition): string
⋮----
function getOrCreateTransitionProgram(gl: WebGL2RenderingContext, shader: ShaderDefinition): CachedProgram | null
⋮----
// Collect uniform locations
⋮----
export function renderGlslGenerator(
  shader: ShaderDefinition,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
  frame: number,
): HTMLCanvasElement | null
⋮----
export function renderGlslFxImage(
  shader: ShaderDefinition,
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
  frame: number,
): HTMLCanvasElement | null
⋮----
export function renderGlslTransition(
  shader: ShaderDefinition,
  fromCanvas: HTMLCanvasElement,
  toCanvas: HTMLCanvasElement,
  progress: number,
  ratio: number,
  params: Record<string, number>,
  width: number,
  height: number,
): HTMLCanvasElement | null
⋮----
export function renderShaderPreview(
  shader: ShaderDefinition,
  targetCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
): boolean
⋮----
export function disposeGlslRuntime()
````

## File: app/src/lib/history.ts
````typescript
import {batch} from '@preact/signals';
import {historyStore} from '../stores/historyStore';
import type {HistoryEntry} from '../types/history';
⋮----
export function pushAction(entry: HistoryEntry): void
⋮----
export function undo(): void
⋮----
export function redo(): void
⋮----
export function startCoalescing(): void
⋮----
export function stopCoalescing(): void
⋮----
export function resetHistory(): void
⋮----
export function canUndo(): boolean
⋮----
export function canRedo(): boolean
````

## File: app/src/lib/ipc.ts
````typescript
import { invoke } from '@tauri-apps/api/core';
import type { ProjectData, MceProject } from '../types/project';
import type { ImageInfo, ImportResult } from '../types/image';
⋮----
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };
⋮----
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>>
⋮----
export function assetUrl(filePath: string, bustKey?: string): string
⋮----
// --- Project commands ---
export async function projectGetDefault(): Promise<Result<ProjectData>>
⋮----
export async function projectCreate(name: string, fps: number, dirPath: string): Promise<Result<MceProject>>
⋮----
export async function projectSave(project: MceProject, filePath: string): Promise<Result<null>>
⋮----
export async function projectOpen(filePath: string): Promise<Result<MceProject>>
⋮----
export async function projectMigrateTempImages(tempDir: string, projectDir: string): Promise<Result<string[]>>
⋮----
export async function pathExists(filePath: string): Promise<Result<boolean>>
⋮----
export async function imageGetInfo(path: string): Promise<Result<ImageInfo>>
⋮----
export async function importImages(paths: string[], projectDir: string): Promise<Result<ImportResult>>
⋮----
export async function configGetTheme(): Promise<Result<string | null>>
⋮----
export async function configSetTheme(theme: string): Promise<Result<null>>
⋮----
export async function configGetCanvasBg(theme: string): Promise<Result<string | null>>
⋮----
export async function configSetCanvasBg(theme: string, color: string): Promise<Result<null>>
⋮----
export function configGetSidebarWidth()
⋮----
export function configSetSidebarWidth(width: number)
⋮----
export function configGetPanelHeights()
⋮----
export function configSetPanelHeights(seqHeight: number, layersHeight: number)
⋮----
export function configGetLoopEnabled()
⋮----
export function configSetLoopEnabled(enabled: boolean)
⋮----
export function configGetExportFolder()
⋮----
export function configSetExportFolder(folder: string)
⋮----
export function configGetExportNamingPattern()
⋮----
export function configSetExportNamingPattern(pattern: string)
⋮----
export function configGetVideoQuality()
⋮----
export function configSetVideoQuality(quality: Record<string, unknown>)
⋮----
export function exportCreateDir(baseDir: string)
⋮----
export function exportWritePng(dirPath: string, filename: string, data: number[])
⋮----
export function exportCountExistingFrames(dirPath: string)
⋮----
export function exportOpenInFinder(path: string)
⋮----
export function exportCheckFfmpeg()
⋮----
export function exportDownloadFfmpeg()
⋮----
export function exportCleanupPngs(dirPath: string)
⋮----
export function exportCleanupFile(filePath: string)
⋮----
export function exportEncodeVideo(
  pngDir: string,
  globPattern: string,
  outputPath: string,
  codec: string,
  fps: number,
  h264Crf: number,
  av1Crf: number,
  proresProfile: string,
  audioPath?: string | null,
)
````

## File: app/src/lib/jklShuttle.ts
````typescript
import {signal, computed} from '@preact/signals';
⋮----
/** Whether the speed badge should be visible */
⋮----
// --- Internal state ---
⋮----
// --- Exported functions ---
⋮----
/**
 * Press L: set forward direction / increase forward speed.
 * If already forward: increment speed tier (cap at max).
 * If currently reverse: reset speed tier to 0, set direction to forward.
 * Does NOT start or stop playback.
 */
export function pressL(): void
⋮----
// Already forward: accelerate
⋮----
// Currently reverse: switch to forward, reset speed
⋮----
/**
 * Press J: set reverse direction / increase reverse speed.
 * If already reverse: increment speed tier (cap at max).
 * If currently forward: reset speed tier to 0, set direction to reverse.
 * Does NOT start or stop playback.
 */
export function pressJ(): void
⋮----
// Already reverse: accelerate
⋮----
// Currently forward: switch to reverse, reset speed
⋮----
/**
 * Press K: reset speed to 1x forward.
 * Resets speed tier to 0 and direction to forward (1).
 * Does NOT stop playback (Space owns play/stop).
 */
export function pressK(): void
⋮----
/**
 * Reset shuttle state completely.
 * Used when playback stops (e.g. Space pressed to stop).
 */
export function resetShuttle(): void
⋮----
// --- Internal helpers ---
⋮----
function updateLabel(): void
⋮----
// Default state (1x forward): no label
⋮----
// Forward, speed > 1x
⋮----
// Reverse, 1x
⋮----
function flashBadge(): void
````

## File: app/src/lib/keyframeEngine.ts
````typescript
import type { Keyframe, KeyframeValues, EasingType } from '../types/layer';
import { extractKeyframeValues } from '../types/layer';
⋮----
export function applyEasing(t: number, easing: EasingType): number
⋮----
export function lerp(a: number, b: number, t: number): number
⋮----
function lerpSourceOverrides(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
  t: number,
): Record<string, number> | undefined
⋮----
export function lerpValues(a: KeyframeValues, b: KeyframeValues, t: number): KeyframeValues
⋮----
function _copySourceOverrides(v: KeyframeValues): void
⋮----
function _interpolateAtMutable(keyframes: Keyframe[], frame: number): KeyframeValues | null
⋮----
export function interpolateAt(keyframes: Keyframe[], frame: number): KeyframeValues | null
````

## File: app/src/lib/keyframeNav.ts
````typescript
export interface KeyframeNavResult {
  prevFrame: number | null;
  nextFrame: number | null;
  isOnKf: boolean;
  canPrev: boolean;
  canNext: boolean;
}
⋮----
export function getKeyframeNav(
  keyframes: ReadonlyArray<{ frame: number }>,
  currentFrame: number,
): KeyframeNavResult
````

## File: app/src/lib/keyPhotoNav.ts
````typescript
export interface KeyPhotoRange {
  keyPhotoId: string;
  startFrame: number;
  endFrame: number;
}
⋮----
export function getActiveKeyPhotoIndex(ranges: KeyPhotoRange[], frame: number): number
````

## File: app/src/lib/layerSelection.ts
````typescript
export function getTopLayerId(seq:
````

## File: app/src/lib/motionBlurEngine.ts
````typescript
import type {KeyframeValues} from '../types/layer';
⋮----
export interface LayerVelocity {
  dx: number;
  dy: number;
  dRotation: number;
  dScale: number;
}
⋮----
export function computeLayerVelocity(
  current: KeyframeValues,
  previous: KeyframeValues,
): LayerVelocity
⋮----
export function isStationary(v: LayerVelocity): boolean
⋮----
export class VelocityCache
⋮----
computeForLayer(
    layerId: string,
    currentValues: KeyframeValues,
    currentFrame: number,
): LayerVelocity | null
⋮----
clear()
````

## File: app/src/lib/paintFloodFill.ts
````typescript
export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number = 10,
): void
⋮----
export function hexToRgba(hex: string, opacity: number): [number, number, number, number]
````

## File: app/src/lib/panelResize.ts
````typescript
interface PanelSizes {
  seqHeight: number;
  layHeight: number;
  totalAvailable: number;
}
⋮----
type ResizerId = 'seq-lay' | 'lay-prop';
⋮----
interface ResizeResult {
  seqHeight: number;
  layHeight: number;
}
⋮----
export function calcResize(current: PanelSizes, deltaY: number, resizer: ResizerId): ResizeResult
⋮----
export interface FlexSizes {
  seqFlex: number;
  layFlex: number;
  propFlex: number;
  totalPixelHeight: number;
}
⋮----
export interface FlexResizeResult {
  seqFlex: number;
  layFlex: number;
  propFlex: number;
}
⋮----
export function calcFlexResize(
  current: FlexSizes,
  deltaY: number,
  resizer: ResizerId,
): FlexResizeResult
⋮----
export interface FlexSizes2 {
  seqFlex: number;
  propFlex: number;
  totalPixelHeight: number;
}
⋮----
export interface FlexResizeResult2 {
  seqFlex: number;
  propFlex: number;
}
⋮----
export function calcFlexResize2(
  current: FlexSizes2,
  deltaY: number,
): FlexResizeResult2
````

## File: app/src/lib/playbackEngine.ts
````typescript
import {signal} from '@preact/signals';
import {timelineStore} from '../stores/timelineStore';
import {sequenceStore} from '../stores/sequenceStore';
import {uiStore} from '../stores/uiStore';
import {projectStore} from '../stores/projectStore';
import {audioStore} from '../stores/audioStore';
import {audioEngine} from './audioEngine';
import {totalFrames, frameMap, trackLayouts} from './frameMap';
import {shuttleDirection, shuttleSpeed, resetShuttle} from './jklShuttle';
import {isolationStore} from '../stores/isolationStore';
⋮----
export class PlaybackEngine
⋮----
setPlayerRef(el: HTMLElement | null)
⋮----
start()
⋮----
stop()
⋮----
toggle()
⋮----
toggleFullSpeed()
⋮----
seekToFrame(frame: number)
⋮----
stepForward()
⋮----
stepBackward()
⋮----
private syncActiveSequence()
⋮----
private syncPlayer()
⋮----
private getIsolatedRanges(isolatedIds: Set<string>): Array<
⋮----
private nextIsolatedFrame(frame: number, ranges: Array<
⋮----
private prevIsolatedFrame(frame: number, ranges: Array<
⋮----
private startAudioPlayback(): void
⋮----
private getInternalPlayer(): any
````

## File: app/src/lib/previewBridge.ts
````typescript
import {signal} from '@preact/signals';
````

## File: app/src/lib/projectDir.ts
````typescript
import {appDataDir} from '@tauri-apps/api/path';
import {signal} from '@preact/signals';
⋮----
export async function initTempProjectDir(): Promise<void>
````

## File: app/src/lib/sequenceNav.ts
````typescript
import type {TrackLayout} from '../types/timeline';
⋮----
export function findPrevSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null
⋮----
export function findNextSequenceStart(layouts: TrackLayout[], currentFrame: number): number | null
````

## File: app/src/lib/shaderLibrary.ts
````typescript
export type ShaderCategory = 'generator' | 'fx-image' | 'transition';
⋮----
export interface ShaderParamDef {
  key: string;
  label: string;
  type: 'float' | 'color' | 'bool';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  colorGroup?: string;
  hidden?: boolean;
}
⋮----
export interface ShaderDefinition {
  id: string;
  name: string;
  category: ShaderCategory;
  description: string;
  author?: string;
  license?: string;
  url?: string;
  fragmentSource: string;
  params: ShaderParamDef[];
  defaultBlend?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
}
⋮----
import { starNest } from './shaders/generators/starNest';
import { spiralLitClouds } from './shaders/generators/spiralLitClouds';
import { driveHome } from './shaders/generators/driveHome';
import { clouds3dFly } from './shaders/generators/clouds3dFly';
import { sunWithStars } from './shaders/generators/sunWithStars';
import { neonDoodleFuzz } from './shaders/generators/neonDoodleFuzz';
import { seascape } from './shaders/generators/seascape';
import { oceanWater } from './shaders/generators/oceanWater';
import { indefinite } from './shaders/generators/indefinite';
import { zippyZaps } from './shaders/generators/zippyZaps';
⋮----
import { cameraPixelFilters } from './shaders/fx-image/cameraPixelFilters';
import { superFilmGrain } from './shaders/fx-image/superFilmGrain';
import { colorFusion } from './shaders/fx-image/colorFusion';
import { fastBlur } from './shaders/fx-image/fastBlur';
import { colorTemperature } from './shaders/fx-image/colorTemperature';
import { screenNoise } from './shaders/fx-image/screenNoise';
import { filmoraShake } from './shaders/fx-image/filmoraShake';
⋮----
import { directional } from './shaders/transitions/directional';
import { directionalwipe } from './shaders/transitions/directionalwipe';
import { wipeLeft } from './shaders/transitions/wipeLeft';
import { wipeDown } from './shaders/transitions/wipeDown';
import { dissolve } from './shaders/transitions/dissolve';
import { fadecolor } from './shaders/transitions/fadecolor';
import { fadegrayscale } from './shaders/transitions/fadegrayscale';
import { swap } from './shaders/transitions/swap';
import { windowSlice } from './shaders/transitions/windowSlice';
import { slides } from './shaders/transitions/slides';
import { crossZoom } from './shaders/transitions/crossZoom';
import { zoomInCircles } from './shaders/transitions/zoomInCircles';
import { simpleZoom } from './shaders/transitions/simpleZoom';
import { crosswarp } from './shaders/transitions/crosswarp';
import { cube } from './shaders/transitions/cube';
import { pixelize } from './shaders/transitions/pixelize';
import { dreamy } from './shaders/transitions/dreamy';
import { glitchMemories } from './shaders/transitions/glitchMemories';
⋮----
export function getAllShaders(): ShaderDefinition[]
⋮----
export function getShadersByCategory(category: ShaderCategory): ShaderDefinition[]
⋮----
export function getShaderById(id: string): ShaderDefinition | undefined
⋮----
export function getDefaultParams(shader: ShaderDefinition): Record<string, number>
````

## File: app/src/lib/shaderPreviewCapture.ts
````typescript
export function capturePreviewCanvas(): void
⋮----
export function getCapturedCanvas(): HTMLCanvasElement | null
````

## File: app/src/lib/shortcuts.ts
````typescript
import {tinykeys} from 'tinykeys';
import {playbackEngine} from './playbackEngine';
import {isFullscreen, enterFullscreen, exitFullscreen} from './fullscreenManager';
import {pressJ, pressK, pressL} from './jklShuttle';
import {findPrevSequenceStart, findNextSequenceStart} from './sequenceNav';
import {trackLayouts} from './frameMap';
import {undo, redo} from './history';
import {guardUnsavedChanges} from './unsavedGuard';
import {cycleTheme} from './themeManager';
import {projectStore} from '../stores/projectStore';
import {uiStore} from '../stores/uiStore';
import {layerStore} from '../stores/layerStore';
import {sequenceStore} from '../stores/sequenceStore';
import {canvasStore} from '../stores/canvasStore';
import {blurStore} from '../stores/blurStore';
import {paintStore} from '../stores/paintStore';
import {isolationStore} from '../stores/isolationStore';
import {soloStore} from '../stores/soloStore';
import {motionBlurStore} from '../stores/motionBlurStore';
import {keyframeStore} from '../stores/keyframeStore';
import {audioStore} from '../stores/audioStore';
import {audioEngine} from './audioEngine';
import {timelineStore} from '../stores/timelineStore';
import {isFxLayer} from '../types/layer';
import {save, open} from '@tauri-apps/plugin-dialog';
⋮----
function isPaintEditMode(): boolean
⋮----
function shouldSuppressShortcut(event: KeyboardEvent): boolean
⋮----
export async function handleSave(): Promise<void>
⋮----
export async function handleNewProject(): Promise<void>
⋮----
export async function handleOpenProject(): Promise<void>
⋮----
export async function handleCloseProject(): Promise<void>
⋮----
function handleDelete(): void
⋮----
function nudgeIfSelected(axis: 'x' | 'y', delta: number): void
⋮----
function handleArrow(axis: 'x' | 'y', delta: number): void
⋮----
export function mountShortcuts(): () => void
````

## File: app/src/lib/themeManager.ts
````typescript
import { signal } from '@preact/signals';
import { getTheme, setThemePreference, getCanvasBg, setCanvasBg } from './appConfig';
⋮----
export type Theme = 'dark' | 'medium' | 'light';
⋮----
async function applyCanvasBg(theme: Theme): Promise<void>
⋮----
export function applyTheme(theme: Theme): void
⋮----
export function cycleTheme(): void
⋮----
export async function setTheme(theme: Theme): Promise<void>
⋮----
export async function initTheme(): Promise<void>
⋮----
export async function setCanvasBackground(color: string): Promise<void>
````

## File: app/src/lib/transitionEngine.ts
````typescript
import { applyEasing } from './keyframeEngine';
import type { Transition } from '../types/sequence';
import type { EasingType } from '../types/layer';
⋮----
export function computeFadeOpacity(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number
⋮----
export function computeSolidFadeAlpha(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number
⋮----
export function computeTransitionProgress(
  globalFrame: number,
  overlapStart: number,
  overlapDuration: number,
  curve: EasingType,
): number
⋮----
export function computeCrossDissolveOpacity(
  globalFrame: number,
  overlapStart: number,
  overlapDuration: number,
  curve: EasingType,
): [outgoingOpacity: number, incomingOpacity: number]
````

## File: app/src/lib/unsavedGuard.ts
````typescript
import {message, save} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../stores/projectStore';
⋮----
export type GuardResult = 'saved' | 'discarded' | 'cancelled';
⋮----
export async function guardUnsavedChanges(): Promise<GuardResult>
````

## File: app/src/scenes/previewScene.meta
````
{
  "version": 0
}
````

## File: app/src/scenes/previewScene.tsx
````typescript
import {makeScene2D, Img, Rect} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';
````

## File: app/src/scenes/testScene.meta
````
{
  "version": 0,
  "timeEvents": [],
  "seed": 458109027
}
````

## File: app/src/scenes/testScene.tsx
````typescript
import {makeScene2D, Rect, Txt} from '@efxlab/motion-canvas-2d';
import {createRef, waitFor} from '@efxlab/motion-canvas-core';
````

## File: app/src/stores/audioStore.ts
````typescript
import {signal, batch} from '@preact/signals';
import type {AudioTrack} from '../types/audio';
import {pushAction} from '../lib/history';
import {detectBPM} from '../lib/bpmDetector';
import {computeBeatMarkers} from '../lib/beatMarkerEngine';
import {audioEngine} from '../lib/audioEngine';
⋮----
export function _setAudioMarkDirtyCallback(fn: () => void)
function markDirty()
⋮----
function snapshot()
⋮----
function restore(snap:
⋮----
addTrack(track: AudioTrack): void
⋮----
removeTrack(trackId: string): void
⋮----
updateTrack(trackId: string, updates: Partial<AudioTrack>): void
⋮----
selectTrack(trackId: string | null): void
⋮----
setVolume(trackId: string, volume: number): void
⋮----
setMuted(trackId: string, muted: boolean): void
⋮----
setOffset(trackId: string, offsetFrame: number): void
⋮----
setInOut(trackId: string, inFrame: number, outFrame: number): void
⋮----
setFades(trackId: string, fadeInFrames: number, fadeOutFrames: number): void
⋮----
reorderTracks(fromIndex: number, toIndex: number): void
⋮----
setTrackHeight(trackId: string, height: number): void
⋮----
setSlipOffset(trackId: string, slipOffset: number): void
⋮----
updateTrackSilent(trackId: string, updates: Partial<AudioTrack>): void
⋮----
async detectAndSetBPM(trackId: string, fps: number, totalFramesCount?: number): Promise<void>
⋮----
recalculateBeatMarkers(trackId: string, fps: number, totalFramesCount?: number): void
⋮----
toggleBeatMarkers(): void
⋮----
toggleSnapToBeats(): void
⋮----
reset(): void
⋮----
getTrack(trackId: string): AudioTrack | undefined
````

## File: app/src/stores/blurStore.ts
````typescript
import {signal} from '@preact/signals';
⋮----
toggleBypass()
⋮----
isBypassed(): boolean
⋮----
reset()
````

## File: app/src/stores/canvasStore.ts
````typescript
import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';
⋮----
function clampPan()
⋮----
zoomIn()
⋮----
zoomOut()
⋮----
setSmoothZoom(newZoom: number, _cursorX?: number, _cursorY?: number)
⋮----
setPan(x: number, y: number)
⋮----
fitToWindow()
⋮----
toggleFitLock()
⋮----
updateContainerSize(w: number, h: number)
⋮----
reset()
````

## File: app/src/stores/exportStore.ts
````typescript
import {signal, computed} from '@preact/signals';
import type {ExportFormat, ExportResolution, ExportSettings, ExportProgress} from '../types/export';
import {configGetExportFolder, configSetExportFolder, configGetExportNamingPattern, configSetExportNamingPattern, configGetVideoQuality, configSetVideoQuality} from '../lib/ipc';
⋮----
setFormat(f: ExportFormat)
setResolution(r: ExportResolution)
setOutputFolder(path: string | null)
setNamingPattern(pattern: string)
setIncludeAudio(v: boolean)
setMotionBlurEnabled(v: boolean)
setMotionBlurShutterAngle(v: number)
setMotionBlurSubFrames(v: number)
setSelectedSequenceOnly(v: boolean)
setVideoQuality(q: typeof videoQuality.value)
⋮----
updateProgress(partial: Partial<ExportProgress>)
⋮----
resetProgress()
⋮----
cancel()
isCancelled()
⋮----
async initFromConfig()
````

## File: app/src/stores/historyStore.ts
````typescript
import {signal} from '@preact/signals';
import type {HistoryEntry} from '../types/history';
````

## File: app/src/stores/imageStore.ts
````typescript
import {signal, computed, batch} from '@preact/signals';
import type {ImportedImage} from '../types/image';
import type {MceImageRef} from '../types/project';
import {importImages as ipcImportImages, assetUrl} from '../lib/ipc';
⋮----
export interface VideoAsset {
  id: string;
  name: string;
  path: string;
  relativePath?: string;
}
⋮----
export interface AudioAsset {
  id: string;
  name: string;
  path: string;
}
⋮----
export function _setImageMarkDirtyCallback(fn: () => void)
⋮----
async importFiles(paths: string[], projectDir: string)
⋮----
addVideoAsset(asset: VideoAsset)
⋮----
addAudioAsset(asset: AudioAsset)
⋮----
removeVideoAsset(id: string)
⋮----
removeAudioAsset(id: string)
⋮----
getDisplayUrl(image: ImportedImage, preferFullRes: boolean = false): string
⋮----
loadFullRes(id: string)
⋮----
touchFullRes(id: string)
⋮----
remove(id: string)
⋮----
getById(id: string): ImportedImage | undefined
⋮----
loadFromMceImages(mceImages: MceImageRef[], projectRoot: string)
⋮----
toMceImages(projectRoot: string): MceImageRef[]
⋮----
updateProjectPaths(oldRoot: string, newRoot: string)
⋮----
reset()
````

## File: app/src/stores/isolationStore.ts
````typescript
import { signal, computed } from '@preact/signals';
import { getLoopEnabled, setLoopEnabled } from '../lib/appConfig';
⋮----
toggleIsolation(sequenceId: string)
⋮----
isIsolated(sequenceId: string): boolean
⋮----
clearIsolation()
⋮----
removeSequence(sequenceId: string)
⋮----
toggleLoop()
⋮----
setLoopEnabled(v: boolean)
⋮----
async loadLoopPreference()
````

## File: app/src/stores/keyframeStore.ts
````typescript
import {signal, computed, effect} from '@preact/signals';
import type {Keyframe, KeyframeValues, EasingType} from '../types/layer';
import {extractKeyframeValues} from '../types/layer';
import {interpolateAt} from '../lib/keyframeEngine';
import {layerStore} from './layerStore';
import {timelineStore} from './timelineStore';
import {sequenceStore} from './sequenceStore';
import {trackLayouts} from '../lib/frameMap';
⋮----
function findLayerContext(layerId: string):
⋮----
function getSelectedAnimatableLayer()
⋮----
function getLocalFrame(): number
⋮----
addKeyframe(layerId: string, globalFrame: number)
⋮----
removeKeyframes(layerId: string, frames: number[])
⋮----
moveKeyframe(layerId: string, fromFrame: number, toFrame: number)
⋮----
setEasing(layerId: string, frame: number, easing: EasingType)
⋮----
clearSelection()
⋮----
selectKeyframe(frame: number, additive: boolean)
⋮----
setTransientValue(field: Exclude<keyof KeyframeValues, 'sourceOverrides'>, value: number)
⋮----
setTransientSourceValue(field: string, value: number)
⋮----
clearTransientOverrides()
⋮----
upsertKeyframeValues(layerId: string, globalFrame: number, field: Exclude<keyof KeyframeValues, 'sourceOverrides'>, value: number)
⋮----
upsertKeyframeTransform(layerId: string, globalFrame: number, updates: Partial<KeyframeValues>)
````

## File: app/src/stores/layerStore.ts
````typescript
import {signal, computed} from '@preact/signals';
import {sequenceStore} from './sequenceStore';
import type {Layer} from '../types/layer';
⋮----
add(layer: Layer)
⋮----
remove(id: string)
⋮----
updateLayer(id: string, updates: Partial<Layer>)
⋮----
reorder(fromIndex: number, toIndex: number)
⋮----
setSelected(id: string | null)
⋮----
reset()
````

## File: app/src/stores/motionBlurStore.ts
````typescript
import {signal} from '@preact/signals';
⋮----
toggleEnabled()
⋮----
setShutterAngle(angle: number)
⋮----
setPreviewQuality(q: 'off' | 'low' | 'medium')
⋮----
isEnabled(): boolean
⋮----
getStrength(): number
⋮----
getSamples(): number
⋮----
reset()
````

## File: app/src/stores/sequenceStore.ts
````typescript
import {signal, batch} from '@preact/signals';
import type {Sequence, KeyPhoto, Transition, TransitionType, GlTransition, GradientData} from '../types/sequence';
import type {Layer} from '../types/layer';
import {createBaseLayer} from '../types/layer';
import {pushAction} from '../lib/history';
import {isolationStore} from './isolationStore';
⋮----
function genId(): string
⋮----
export function _setMarkDirtyCallback(fn: () => void)
function markDirty()
⋮----
function snapshot()
⋮----
function restore(snap:
⋮----
createSequence(name: string): Sequence
⋮----
add(seq: Sequence)
⋮----
remove(id: string)
⋮----
duplicate(id: string): Sequence | null
⋮----
renameSequence(id: string, name: string)
⋮----
reorderSequences(oldIndex: number, newIndex: number)
⋮----
createFxSequence(name: string, layer: Layer, totalFrames: number, opts?:
⋮----
createContentOverlaySequence(name: string, layer: Layer, totalFrames: number, opts?:
⋮----
toggleFxSequenceVisibility(id: string)
⋮----
reorderFxSequences(fromIndex: number, toIndex: number)
⋮----
updateFxSequenceRange(id: string, inFrame: number, outFrame: number)
⋮----
getContentSequences(): Sequence[]
⋮----
getFxSequences(): Sequence[]
⋮----
getOverlaySequences(): Sequence[]
⋮----
rename(id: string, name: string)
⋮----
setSequenceFps(id: string, fps: number)
⋮----
setSequenceResolution(id: string, width: number, height: number)
⋮----
addKeyPhoto(sequenceId: string, imageId: string, holdFrames: number = 4)
⋮----
removeKeyPhoto(sequenceId: string, keyPhotoId: string)
⋮----
reorderKeyPhotos(
    sequenceId: string,
    oldIndex: number,
    newIndex: number,
)
⋮----
updateHoldFrames(
    sequenceId: string,
    keyPhotoId: string,
    holdFrames: number,
)
⋮----
addKeySolid(sequenceId: string, solidColor: string = '#000000', holdFrames: number = 4)
⋮----
imageId: '',  // no image for solids
⋮----
updateKeySolidColor(sequenceId: string, keyPhotoId: string, solidColor: string)
⋮----
updateKeySolidColorLive(sequenceId: string, keyPhotoId: string, solidColor: string)
⋮----
updateKeyGradient(sequenceId: string, keyPhotoId: string, gradient: GradientData | undefined)
⋮----
updateKeyGradientLive(sequenceId: string, keyPhotoId: string, gradient: GradientData)
⋮----
toggleKeyEntryTransparent(sequenceId: string, keyPhotoId: string)
⋮----
addLayer(layer: Layer)
⋮----
addLayerToSequence(sequenceId: string, layer: Layer)
⋮----
removeLayer(layerId: string)
⋮----
updateLayer(layerId: string, updates: Partial<Layer>)
⋮----
updateLayerInSequence(layerId: string, updates: Partial<Layer>)
⋮----
removeLayerFromSequence(layerId: string)
⋮----
reorderLayers(fromIndex: number, toIndex: number)
⋮----
addTransition(sequenceId: string, transition: Transition)
⋮----
removeTransition(sequenceId: string, type: TransitionType)
⋮----
updateTransition(sequenceId: string, type: TransitionType, updates: Partial<Transition>)
⋮----
setGlTransition(sequenceId: string, glTransition: GlTransition)
⋮----
removeGlTransition(sequenceId: string)
⋮----
updateGlTransitionParams(sequenceId: string, params: Record<string, number>)
⋮----
updateGlTransition(sequenceId: string, updates: Partial<GlTransition>)
⋮----
setActive(id: string | null)
⋮----
selectKeyPhoto(id: string | null)
⋮----
clearKeyPhotoSelection()
⋮----
getById(id: string)
⋮----
getActiveSequence()
⋮----
updateKeyPhotoSilent(seqId: string, keyPhotoId: string, updates: Partial<KeyPhoto>): void
⋮----
reset()
````

## File: app/src/stores/soloStore.ts
````typescript
import { signal, computed } from '@preact/signals';
⋮----
toggleSolo()
⋮----
setSolo(v: boolean)
````

## File: app/src/stores/timelineStore.ts
````typescript
import {signal, computed, effect} from '@preact/signals';
import {projectStore} from './projectStore';
import {totalFrames as totalFramesSignal, fxTrackLayouts} from '../lib/frameMap';
⋮----
setTimelineDragging(v: boolean)
seek(frame: number)
setPlaying(v: boolean)
togglePlaying()
stepForward()
stepBackward()
setZoom(v: number)
zoomIn()
zoomOut()
setScrollX(v: number)
setScrollY(v: number)
setViewportWidth(v: number)
setViewportHeight(v: number)
⋮----
ensureFrameVisible(frame: number)
⋮----
ensureFrameVisiblePaged(frame: number)
⋮----
ensureTrackVisible(_sequenceId: string)
syncDisplayFrame()
reset()
````

## File: app/src/stores/uiStore.ts
````typescript
import {signal} from '@preact/signals';
import type {PanelId} from '../types/ui';
⋮----
export type EditorMode = 'editor' | 'imported' | 'settings' | 'export' | 'shader-browser';
⋮----
export type AddLayerIntent =
  | null
  | {
      type: 'static-image' | 'image-sequence' | 'video' | 'audio';
      target?: 'content-overlay' | 'audio-track';
      changeSourceFor?: { layerId: string; sequenceId: string };
      targetSequenceId?: string;
      isolatedInFrame?: number;
      isolatedOutFrame?: number;
    };
⋮----
export type TransitionSelection = {
  sequenceId: string;
  type: 'fade-in' | 'fade-out' | 'cross-dissolve' | 'gl-transition';
} | null;
⋮----
selectSequence(id: string | null)
selectLayer(id: string | null)
selectTransition(sel: TransitionSelection)
selectPanel(id: PanelId | null)
setSidebarWidth(w: number)
setPropertiesPanelWidth(w: number)
⋮----
toggleShortcutsOverlay()
closeShortcutsOverlay()
⋮----
setEditorMode(mode: EditorMode)
setPendingNewSequenceId(id: string | null)
setAddLayerIntent(intent: AddLayerIntent)
toggleSidebar()
setMouseRegion(region: 'canvas' | 'timeline' | 'other')
⋮----
openLayerView(sequenceId: string)
closeLayerView()
⋮----
setSequencesPanelHeight(h: number)
setLayersPanelHeight(h: number)
⋮----
setSeqPanelFlex(v: number)
setPropPanelFlex(v: number)
⋮----
collapsePanel(panel: 'seq' | 'prop')
⋮----
expandPanel(panel: 'seq' | 'prop')
⋮----
async initSidebarLayout()
⋮----
reset()
````

## File: app/src/types/audio.ts
````typescript
export type FadeCurve = 'linear' | 'exponential' | 'logarithmic';
⋮----
export interface AudioTrack {
  id: string;
  audioAssetId: string;
  name: string;
  filePath: string;
  relativePath: string;
  originalFilename: string;
  offsetFrame: number;
  inFrame: number;
  outFrame: number;
  volume: number;
  muted: boolean;
  fadeInFrames: number;
  fadeOutFrames: number;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
  sampleRate: number;
  duration: number;
  channelCount: number;
  order: number;
  trackHeight: number;
  slipOffset: number;
  totalFramesInFile: number;
  bpm: number | null;
  beatOffsetFrames: number;
  beatMarkers: number[];
  showBeatMarkers: boolean;
}
⋮----
export interface MceAudioTrack {
  id: string;
  audio_asset_id?: string;
  name: string;
  relative_path: string;
  original_filename: string;
  offset_frame: number;
  in_frame: number;
  out_frame: number;
  volume: number;
  muted: boolean;
  fade_in_frames: number;
  fade_out_frames: number;
  fade_in_curve: string;
  fade_out_curve: string;
  sample_rate: number;
  duration: number;
  channel_count: number;
  order: number;
  track_height: number;
  slip_offset: number;
  total_frames_in_file: number;
  bpm?: number | null;
  beat_offset_frames?: number;
  beat_markers?: number[];
  show_beat_markers?: boolean;
}
⋮----
export interface WaveformPeaks {
  tier1: Float32Array;
  tier2: Float32Array;
  tier3: Float32Array;
}
````

## File: app/src/types/audiobuffer-to-wav.d.ts
````typescript
export default function audioBufferToWav(buffer: AudioBuffer, options?:
````

## File: app/src/types/bezier-js.d.ts
````typescript
interface Point {
    x: number;
    y: number;
    t?: number;
    d?: number;
  }
⋮----
interface BezierCurve {
    points: Point[];
  }
⋮----
interface SplitResult {
    left: BezierCurve;
    right: BezierCurve;
  }
⋮----
export class Bezier
⋮----
constructor(
      x1: number, y1: number,
      x2: number, y2: number,
      x3: number, y3: number,
      x4: number, y4: number,
    );
⋮----
split(t: number): SplitResult;
⋮----
project(point:
⋮----
get(t: number): Point;
⋮----
length(): number;
````

## File: app/src/types/export.ts
````typescript
export type ExportFormat = 'png' | 'prores' | 'h264' | 'av1';
⋮----
export type ExportResolution = 0.15 | 0.25 | 0.5 | 1 | 2;
⋮----
export interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  outputFolder: string | null;
  namingPattern: string;
  videoQuality: {
    h264Crf: number;
    av1Crf: number;
    proresProfile: 'proxy' | 'lt' | 'standard' | 'hq';
  };
  includeAudio: boolean;
  motionBlur: {
    enabled: boolean;
    shutterAngle: number;
    subFrames: number;
  };
  selectedSequenceOnly: boolean;
}
⋮----
export interface ExportProgress {
  status: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error' | 'cancelled';
  currentFrame: number;
  totalFrames: number;
  estimatedSecondsRemaining: number | null;
  errorMessage: string | null;
  resumeFromFrame: number | null;
  outputPath: string | null;
}
````

## File: app/src/types/fit-curve.d.ts
````typescript
export default function fitCurve(
    points: number[][],
    maxError: number,
  ): number[][][];
````

## File: app/src/types/history.ts
````typescript
export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}
````

## File: app/src/types/image.ts
````typescript
export interface ImageInfo {
  path: string;
  width: number;
  height: number;
  format: string;
}
⋮----
export interface ImportedImage {
  id: string;
  original_path: string;
  project_path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  format: string;
}
⋮----
export interface ImportResult {
  imported: ImportedImage[];
  errors: ImportError[];
}
⋮----
export interface ImportError {
  path: string;
  error: string;
}
````

## File: app/src/types/motion-canvas.d.ts
````typescript
interface IntrinsicElements {
    'motion-canvas-player': {
      src?: string;
      auto?: boolean;
      responsive?: boolean;
      'aspect-ratio'?: string;
      width?: number;
      height?: number;
      quality?: number;
      variables?: string;
      background?: string;
      'no-controls'?: boolean;
      fullscreen?: boolean;
      timescale?: number;
      ratio?: string;
      ref?: any;
      class?: string;
      style?: any;
    };
  }
````

## File: app/src/types/p5brush.d.ts
````typescript
export function createCanvas(
    width: number,
    height: number,
    options?: {
      pixelDensity?: number;
      parent?: string | HTMLElement;
      id?: string;
    },
  ): HTMLCanvasElement;
⋮----
export function load(target?: HTMLCanvasElement | OffscreenCanvas): void;
⋮----
export function render(): void;
export function clear(color?: string): void;
⋮----
export function push(): void;
export function pop(): void;
export function translate(x: number, y: number): void;
export function rotate(angle: number): void;
export function scale(x: number, y?: number): void;
⋮----
export function angleMode(mode: 'degrees' | 'radians'): void;
⋮----
export function seed(n: number): void;
export function noiseSeed(n: number): void;
⋮----
export function set(brushName: string, color: string, weight?: number): void;
export function pick(brushName: string): void;
export function stroke(color: string): void;
export function strokeWeight(weight: number): void;
export function noStroke(): void;
export function add(name: string, params: BrushParams): void;
export function box(): string[];
export function scaleBrushes(scale: number): void;
⋮----
export function line(x1: number, y1: number, x2: number, y2: number): void;
export function flowLine(
    x: number,
    y: number,
    length: number,
    dir: number,
  ): void;
export function spline(
    points: [number, number, number?][],
    curvature?: number,
  ): void;
export function circle(
    x: number,
    y: number,
    radius: number,
    irregularity?: number,
  ): void;
export function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    mode?: string,
  ): void;
⋮----
export function fill(color: string, opacity?: number): void;
export function noFill(): void;
export function fillBleed(intensity: number, direction?: string): void;
export function fillTexture(
    texture?: number,
    border?: number,
    scatter?: boolean,
  ): void;
⋮----
export function beginShape(): void;
export function vertex(x: number, y: number): void;
export function endShape(close?: boolean): void;
export function move(x: number, y: number): void;
⋮----
export function wash(color: string, opacity?: number): void;
export function noWash(): void;
⋮----
export function field(name: string): void;
export function noField(): void;
export function addField(
    name: string,
    generator: (t: number, field: any) => any,
    options?: {angleMode?: 'degrees' | 'radians'},
  ): void;
export function refreshField(time: number): void;
export function listFields(): string[];
export function wiggle(amount: number): void;
⋮----
export function hatch(
    spacing: number,
    angle: number,
    options?: object,
  ): void;
export function hatchStyle(
    brush: string,
    color: string,
    weight: number,
  ): void;
export function noHatch(): void;
⋮----
export function random(min?: number, max?: number): number;
export function noise(x: number, y?: number, z?: number): number;
⋮----
interface BrushParams {
    type?: 'default' | 'spray' | 'marker' | 'custom' | 'image';
    weight?: number;
    scatter?: number;
    sharpness?: number;
    grain?: number;
    opacity?: number;
    spacing?: number;
    pressure?:
      | [number, number]
      | [number, number, number]
      | ((t: number) => number);
    tip?: (surface: any) => void;
    rotate?: 'random' | 'natural';
    markerTip?: boolean;
    noise?: number;
  }
````

## File: app/src/types/sequence.ts
````typescript
import type { Layer, EasingType } from './layer';
⋮----
export type TransitionType = 'fade-in' | 'fade-out' | 'cross-dissolve';
export type FadeMode = 'transparency' | 'solid';
⋮----
export interface Transition {
  type: TransitionType;
  duration: number;
  mode: FadeMode;
  color: string;
  curve: EasingType;
}
⋮----
export interface GlTransition {
  shaderId: string;
  params: Record<string, number>;
  duration: number;
  curve: EasingType;
}
⋮----
export interface GradientStop {
  color: string;
  position: number;
}
⋮----
export interface GradientData {
  type: 'linear' | 'radial' | 'conic';
  stops: GradientStop[];
  angle?: number;
  centerX?: number;
  centerY?: number;
}
⋮----
export interface Sequence {
  id: string;
  kind: 'content' | 'fx' | 'content-overlay';
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
  layers: Layer[];
  inFrame?: number;
  outFrame?: number;
  visible?: boolean;
  fadeIn?: Transition;
  fadeOut?: Transition;
  crossDissolve?: Transition;
  glTransition?: GlTransition;
}
⋮----
export interface KeyPhoto {
  id: string;
  imageId: string;
  holdFrames: number;
  solidColor?: string;
  isTransparent?: boolean;
  gradient?: GradientData;
}
⋮----
export function isKeySolid(kp: KeyPhoto): boolean
export function isKeyTransparent(kp: KeyPhoto): boolean
export function isKeyImage(kp: KeyPhoto): boolean
export function isKeyGradient(kp: KeyPhoto): boolean
⋮----
export function createDefaultGradient(): GradientData
````

## File: app/src/types/timeline.ts
````typescript
import type { LayerType } from './layer';
import type {WaveformPeaks, FadeCurve} from './audio';
import type {GlTransition, GradientData} from './sequence';
⋮----
export interface TimelineState {
  currentFrame: number;
  isPlaying: boolean;
  zoom: number;
  scrollX: number;
}
⋮----
export interface FrameEntry {
  globalFrame: number;
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  localFrame: number;
  solidColor?: string;
  isTransparent?: boolean;
  gradient?: GradientData;
}
⋮----
export interface TrackLayout {
  sequenceId: string;
  sequenceName: string;
  startFrame: number;
  endFrame: number;
  keyPhotoRanges: KeyPhotoRange[];
  fadeIn?: { duration: number };
  fadeOut?: { duration: number };
  crossDissolve?: { duration: number };
  glTransition?: GlTransition;
}
⋮----
export interface FxTrackLayout {
  sequenceId: string;
  sequenceName: string;
  kind: 'fx' | 'content-overlay';
  inFrame: number;
  outFrame: number;
  color: string;
  visible: boolean;
  thumbnailImageId?: string;
  layerType?: LayerType;
  fadeIn?: { duration: number };
  fadeOut?: { duration: number };
}
⋮----
export interface KeyPhotoRange {
  keyPhotoId: string;
  imageId: string;
  startFrame: number;
  endFrame: number;
  holdFrames: number;
  solidColor?: string;
  isTransparent?: boolean;
  gradient?: GradientData;
}
⋮----
export interface AudioTrackLayout {
  trackId: string;
  trackName: string;
  offsetFrame: number;
  inFrame: number;
  outFrame: number;
  muted: boolean;
  volume: number;
  peaks: WaveformPeaks;
  trackHeight: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
  slipOffset: number;
  totalAudioFrames: number;
  selected: boolean;
  beatMarkers: number[];
  showBeatMarkers: boolean;
  bpm: number | null;
}
````

## File: app/src/types/ui.ts
````typescript
export type PanelId = 'timeline' | 'layers' | 'properties' | 'preview' | 'toolbar' | 'sequences';
⋮----
export interface UiState {
  selectedSequenceId: string | null;
  selectedLayerId: string | null;
  selectedPanel: PanelId | null;
  sidebarWidth: number;
  propertiesPanelWidth: number;
}
````

## File: app/src/app.tsx
````typescript
import {computed} from '@preact/signals';
import {EditorShell} from './components/layout/EditorShell';
import {WelcomeScreen} from './components/project/WelcomeScreen';
import {projectStore} from './stores/projectStore';
⋮----
export function App()
````

## File: app/src/index.css
````css
:root,
⋮----
[data-theme="medium"] {
⋮----
[data-theme="light"] {
⋮----
@layer base {
⋮----
html, body, #app {
⋮----
.font-primary {
⋮----
.scrollbar-hidden {
.scrollbar-hidden::-webkit-scrollbar {
⋮----
.paint-action-btn {
.paint-action-btn:hover {
.paint-action-btn:active {
.paint-style-btn-active {
.paint-exit-btn {
.paint-exit-btn:hover {
⋮----
[style*="scrollbar-width: none"]::-webkit-scrollbar {
````

## File: app/src/project.meta
````
{
  "version": 0,
  "shared": {
    "background": null,
    "range": [
      0,
      null
    ],
    "size": {
      "x": 1920,
      "y": 1080
    },
    "audioOffset": 0
  },
  "preview": {
    "fps": 30,
    "resolutionScale": 1
  },
  "rendering": {
    "fps": 60,
    "resolutionScale": 1,
    "colorSpace": "srgb",
    "exporter": {
      "name": "@efxlab/motion-canvas-core/image-sequence",
      "options": {
        "fileType": "image/png",
        "quality": 100,
        "groupByScene": false
      }
    }
  }
}
````

## File: app/src/project.ts
````typescript
import {makeProject} from '@efxlab/motion-canvas-core';
import previewScene from './scenes/previewScene?scene';
````

## File: app/src/vite-env.d.ts
````typescript
interface Window {
  __TAURI_INTERNALS__?: Record<string, unknown>;
}
⋮----
export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: Record<string, (event: KeyboardEvent) => void>,
    options?: {event?: string; timeout?: number},
): ()
````

## File: app/src-tauri/capabilities/default.json
````json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-set-fullscreen",
    "core:app:default",
    "core:path:default",
    "core:event:default",
    "dialog:default",
    "dialog:allow-open",
    "store:default",
    "fs:default",
    "fs:allow-copy-file",
    "fs:allow-mkdir",
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-remove",
    "fs:scope-appdata-recursive",
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "**" }]
    },
    "notification:default"
  ]
}
````

## File: app/src-tauri/src/commands/config.rs
````rust
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::command;
⋮----
struct BuilderConfig {
⋮----
fn config_path() -> PathBuf {
PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
.join(".config/efx-motion/builder-config.yaml")
⋮----
fn default_canvas_bg() -> HashMap<String, String> {
⋮----
map.insert("dark".into(), "#1A1A1A".into());
map.insert("medium".into(), "#2E2E2E".into());
map.insert("light".into(), "#3A3A3A".into());
⋮----
fn read_config() -> BuilderConfig {
let path = config_path();
let mut config: BuilderConfig = if !path.exists() {
⋮----
Ok(contents) => serde_yaml::from_str(&contents).unwrap_or_default(),
⋮----
if config.canvas_bg.is_none() {
config.canvas_bg = Some(default_canvas_bg());
let _ = write_config(&config);
⋮----
fn write_config(config: &BuilderConfig) -> Result<(), String> {
⋮----
if let Some(parent) = path.parent() {
⋮----
.map_err(|e| format!("Failed to create config directory: {e}"))?;
⋮----
serde_yaml::to_string(config).map_err(|e| format!("Failed to serialize config: {e}"))?;
let tmp_path = path.with_extension("yaml.tmp");
⋮----
.map_err(|e| format!("Failed to write config temp file: {e}"))?;
⋮----
.map_err(|e| format!("Failed to rename config temp file: {e}"))?;
Ok(())
⋮----
pub fn config_get_theme() -> Option<String> {
read_config().theme
⋮----
pub fn config_set_theme(theme: String) -> Result<(), String> {
let mut config = read_config();
config.theme = Some(theme);
write_config(&config)
⋮----
pub fn config_get_canvas_bg(theme: String) -> Option<String> {
read_config()
⋮----
.and_then(|map| map.get(&theme).cloned())
⋮----
pub fn config_set_canvas_bg(theme: String, color: String) -> Result<(), String> {
⋮----
let mut map = config.canvas_bg.unwrap_or_default();
map.insert(theme, color);
config.canvas_bg = Some(map);
⋮----
pub fn config_get_sidebar_width() -> Option<f64> {
read_config().sidebar_width
⋮----
pub fn config_set_sidebar_width(width: f64) -> Result<(), String> {
⋮----
config.sidebar_width = Some(width);
⋮----
pub fn config_get_panel_heights() -> Option<(f64, f64)> {
read_config().panel_heights
⋮----
pub fn config_set_panel_heights(seq_height: f64, layers_height: f64) -> Result<(), String> {
⋮----
config.panel_heights = Some((seq_height, layers_height));
⋮----
pub fn config_get_loop_enabled() -> Option<bool> {
read_config().loop_enabled
⋮----
pub fn config_set_loop_enabled(enabled: bool) -> Result<(), String> {
⋮----
config.loop_enabled = Some(enabled);
⋮----
pub fn config_get_export_folder() -> Option<String> {
read_config().export_folder
⋮----
pub fn config_set_export_folder(folder: String) -> Result<(), String> {
⋮----
config.export_folder = Some(folder);
⋮----
pub fn config_get_export_naming_pattern() -> Option<String> {
read_config().export_naming_pattern
⋮----
pub fn config_set_export_naming_pattern(pattern: String) -> Result<(), String> {
⋮----
config.export_naming_pattern = Some(pattern);
⋮----
pub fn config_get_video_quality() -> Option<HashMap<String, serde_json::Value>> {
read_config().video_quality
⋮----
pub fn config_set_video_quality(quality: HashMap<String, serde_json::Value>) -> Result<(), String> {
⋮----
config.video_quality = Some(quality);
````

## File: app/src-tauri/src/commands/export.rs
````rust
use std::path::Path;
use chrono::Local;
use tauri::command;
⋮----
use crate::services::ffmpeg;
⋮----
pub fn export_create_dir(base_dir: String) -> Result<String, String> {
let timestamp = Local::now().format("%Y-%m-%d_%H-%M").to_string();
let export_dir = Path::new(&base_dir).join(format!("export_{}", timestamp));
⋮----
.map_err(|e| format!("Failed to create export directory: {e}"))?;
Ok(export_dir.to_string_lossy().to_string())
⋮----
pub fn export_write_png(dir_path: String, filename: String, data: Vec<u8>) -> Result<(), String> {
let path = Path::new(&dir_path).join(&filename);
let tmp_path = path.with_extension("png.tmp");
⋮----
.map_err(|e| format!("Failed to write PNG: {e}"))?;
⋮----
.map_err(|e| format!("Failed to rename PNG: {e}"))?;
Ok(())
⋮----
pub fn export_count_existing_frames(dir_path: String) -> Result<u32, String> {
⋮----
if !dir.exists() {
return Ok(0);
⋮----
.map_err(|e| format!("Failed to read directory: {e}"))?
.filter_map(|entry| entry.ok())
.filter(|entry| {
⋮----
.path()
.extension()
.map_or(false, |ext| ext == "png")
⋮----
.count();
Ok(count as u32)
⋮----
pub fn export_open_in_finder(path: String) -> Result<(), String> {
⋮----
.arg(&path)
.spawn()
.map_err(|e| format!("Failed to open Finder: {e}"))?;
⋮----
pub fn export_check_ffmpeg() -> Option<String> {
⋮----
pub async fn export_download_ffmpeg() -> Result<String, String> {
⋮----
pub async fn export_encode_video(
⋮----
audio_path.as_deref(),
⋮----
.map_err(|e| format!("FFmpeg task panicked: {e}"))?
⋮----
pub fn export_cleanup_file(file_path: String) -> Result<(), String> {
⋮----
if path.exists() {
⋮----
.map_err(|e| format!("Failed to delete file: {e}"))?;
⋮----
pub fn export_cleanup_pngs(dir_path: String) -> Result<u32, String> {
⋮----
for entry in std::fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {e}"))? {
⋮----
if entry.path().extension().map_or(false, |ext| ext == "png") {
if std::fs::remove_file(entry.path()).is_ok() {
⋮----
Ok(deleted)
````

## File: app/src-tauri/src/commands/image.rs
````rust
use tauri::command;
use tauri::Manager;
⋮----
use crate::services::image_pool;
⋮----
pub fn image_get_info(path: String) -> Result<ImageInfo, String> {
⋮----
if !source.exists() {
return Err(format!("File not found: {}", path));
⋮----
.map_err(|e| e.to_string())?
.with_guessed_format()
⋮----
.decode()
.map_err(|e| e.to_string())?;
⋮----
.extension()
.and_then(|e| e.to_str())
.map(|e| e.to_lowercase())
.unwrap_or_default();
⋮----
Ok(ImageInfo {
⋮----
width: img.width(),
height: img.height(),
⋮----
pub async fn import_images(
⋮----
.unwrap_or_else(|_| std::path::PathBuf::from(&project_dir));
let scope = app.asset_protocol_scope();
let _ = scope.allow_directory(&canonical, true);
⋮----
Ok(img) => imported.push(img),
Err(e) => errors.push(ImportError {
path: path.clone(),
⋮----
.map_err(|e| format!("Import task failed: {}", e))?;
⋮----
Ok(result)
````

## File: app/src-tauri/src/commands/mod.rs
````rust
pub mod config;
pub mod export;
pub mod image;
pub mod project;
````

## File: app/src-tauri/src/commands/project.rs
````rust
use crate::services::project_io;
use tauri::command;
use tauri::Manager;
⋮----
pub fn project_get_default() -> ProjectData {
⋮----
name: "Untitled Project".into(),
⋮----
pub fn project_create(
⋮----
.unwrap_or_else(|_| std::path::PathBuf::from(&dir_path));
let scope = app.asset_protocol_scope();
⋮----
.allow_directory(&canonical, true)
.map_err(|e| format!("Failed to register asset scope: {e}"))?;
⋮----
let now = chrono::Utc::now().to_rfc3339();
Ok(MceProject {
⋮----
created_at: now.clone(),
⋮----
sequences: vec![],
images: vec![],
audio_tracks: vec![],
⋮----
pub fn project_save(project: MceProject, file_path: String) -> Result<(), String> {
⋮----
.parent()
.ok_or_else(|| "Invalid file path: no parent directory".to_string())?
.to_str()
.ok_or_else(|| "Invalid file path: non-UTF8 characters".to_string())?;
⋮----
pub fn project_open(app: tauri::AppHandle, file_path: String) -> Result<MceProject, String> {
⋮----
.ok_or_else(|| "Invalid file path".to_string())?;
⋮----
.unwrap_or_else(|_| project_root.to_path_buf());
⋮----
pub fn path_exists(file_path: String) -> bool {
std::path::Path::new(&file_path).exists()
⋮----
pub fn project_migrate_temp_images(
````

## File: app/src-tauri/src/models/image.rs
````rust
pub struct ImageInfo {
⋮----
pub struct ImportedImage {
⋮----
pub struct ImportResult {
⋮----
pub struct ImportError {
````

## File: app/src-tauri/src/models/mod.rs
````rust
pub mod image;
pub mod project;
pub mod sequence;
````

## File: app/src-tauri/src/models/sequence.rs
````rust

````

## File: app/src-tauri/src/services/ffmpeg.rs
````rust
use std::path::PathBuf;
use std::process::Command;
⋮----
fn ffmpeg_cache_dir() -> PathBuf {
PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
.join(".config/efx-motion/bin")
⋮----
pub fn ffmpeg_path() -> PathBuf {
ffmpeg_cache_dir().join(FFMPEG_FILENAME)
⋮----
pub fn check_ffmpeg() -> Option<String> {
let path = ffmpeg_path();
if !path.exists() {
⋮----
.arg("-version")
.output()
.ok()?;
⋮----
if output.status.success() {
⋮----
let first_line = version.lines().next().unwrap_or("unknown");
Some(first_line.to_string())
⋮----
pub async fn download_ffmpeg() -> Result<String, String> {
let cache_dir = ffmpeg_cache_dir();
⋮----
.map_err(|e| format!("Failed to create FFmpeg cache dir: {e}"))?;
⋮----
let target_path = ffmpeg_path();
let zip_path = target_path.with_extension("zip");
⋮----
.map_err(|e| format!("Failed to download FFmpeg: {e}"))?;
⋮----
if !response.status().is_success() {
return Err(format!(
⋮----
.bytes()
⋮----
.map_err(|e| format!("Failed to read FFmpeg download: {e}"))?;
⋮----
.map_err(|e| format!("Failed to write FFmpeg zip: {e}"))?;
⋮----
.map_err(|e| format!("Failed to open FFmpeg zip: {e}"))?;
⋮----
zip::ZipArchive::new(zip_file).map_err(|e| format!("Failed to read FFmpeg zip: {e}"))?;
⋮----
for i in 0..archive.len() {
⋮----
.by_index(i)
.map_err(|e| format!("Failed to read zip entry: {e}"))?;
let name = file.name().to_string();
if name == FFMPEG_FILENAME || name.ends_with("/ffmpeg") {
⋮----
file.read_to_end(&mut buf)
.map_err(|e| format!("Failed to extract FFmpeg: {e}"))?;
⋮----
.map_err(|e| format!("Failed to write FFmpeg binary: {e}"))?;
⋮----
return Err("FFmpeg binary not found inside downloaded zip".to_string());
⋮----
use std::os::unix::fs::PermissionsExt;
⋮----
.map_err(|e| format!("Failed to set FFmpeg permissions: {e}"))?;
⋮----
.args(["-d", "com.apple.quarantine"])
.arg(&target_path)
.output();
⋮----
check_ffmpeg().ok_or_else(|| "FFmpeg downloaded but not executable".to_string())?;
⋮----
Ok(version)
⋮----
fn prores_profile_num(profile: &str) -> &str {
⋮----
pub struct VideoQualityArgs {
⋮----
pub fn encode_video(
⋮----
let ffmpeg = ffmpeg_path();
if !ffmpeg.exists() {
return Err("FFmpeg binary not found. Download it first.".to_string());
⋮----
let input_pattern = format!("{}/{}", png_dir, glob_pattern);
⋮----
cmd.args(["-y", "-framerate", &fps.to_string()]);
cmd.args(["-i", &input_pattern]);
⋮----
cmd.args(["-i", audio]);
⋮----
cmd.args(["-c:v", "prores_ks"]);
cmd.args(["-profile:v", prores_profile_num(&quality_args.prores_profile)]);
cmd.args(["-pix_fmt", "yuva444p10le"]);
⋮----
cmd.args(["-c:v", "libx264"]);
cmd.args(["-crf", &quality_args.h264_crf.to_string()]);
cmd.args(["-preset", "medium"]);
cmd.args(["-pix_fmt", "yuv420p"]);
⋮----
cmd.args(["-c:v", "libsvtav1"]);
cmd.args(["-crf", &quality_args.av1_crf.to_string()]);
⋮----
_ => return Err(format!("Unknown codec: {codec}")),
⋮----
if audio_path.is_some() {
cmd.args(["-map", "0:v:0", "-map", "1:a:0"]);
⋮----
cmd.args(["-c:a", "pcm_s16le"]);
⋮----
cmd.args(["-c:a", "aac", "-b:a", "192k"]);
⋮----
cmd.arg("-an");
⋮----
cmd.arg(output_path);
⋮----
.map_err(|e| format!("FFmpeg failed to start: {e}"))?;
⋮----
if !output.status.success() {
⋮----
return Err(format!("FFmpeg encoding failed: {stderr}"));
⋮----
Ok(())
````

## File: app/src-tauri/src/services/image_pool.rs
````rust
use image::imageops::FilterType;
use image::ImageReader;
use std::fs;
⋮----
use crate::models::image::ImportedImage;
⋮----
pub fn is_supported_format(path: &Path) -> bool {
path.extension()
.and_then(|ext| ext.to_str())
.map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
.unwrap_or(false)
⋮----
pub fn is_heic_format(path: &Path) -> bool {
⋮----
.map(|ext| HEIC_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
⋮----
pub fn process_image(source_path: &str, project_dir: &str) -> Result<ImportedImage, String> {
⋮----
if !source.exists() {
return Err(format!("File not found: {}", source_path));
⋮----
if is_heic_format(source) {
return Err("HEIC is not yet supported. HEIC/HEIF decoding will be added in a future update. Please convert to JPEG or PNG.".to_string());
⋮----
if !is_supported_format(source) {
⋮----
.extension()
.and_then(|e| e.to_str())
.unwrap_or("unknown");
return Err(format!(
⋮----
let id = uuid::Uuid::new_v4().to_string();
⋮----
let images_dir = PathBuf::from(project_dir).join("images");
let thumbs_dir = images_dir.join(".thumbs");
⋮----
.map_err(|e| format!("Failed to create images dir: {}", e))?;
⋮----
.map_err(|e| format!("Failed to create thumbs dir: {}", e))?;
⋮----
.file_stem()
.and_then(|s| s.to_str())
.unwrap_or("image");
⋮----
.unwrap_or("jpg");
let unique_filename = format!("{}_{}.{}", stem, &id[..8], ext);
let dest = images_dir.join(&unique_filename);
⋮----
fs::copy(source, &dest).map_err(|e| format!("Failed to copy image: {}", e))?;
⋮----
.map_err(|e| format!("Failed to open image: {}", e))?
.with_guessed_format()
.map_err(|e| format!("Failed to detect format: {}", e))?
.decode()
.map_err(|e| format!("Failed to decode image: {}", e))?;
⋮----
let width = img.width();
let height = img.height();
⋮----
let thumb = img.resize(300, 225, FilterType::Triangle);
let thumb_filename = format!("{}_thumb.jpg", id);
let thumb_path = thumbs_dir.join(&thumb_filename);
⋮----
.save(&thumb_path)
.map_err(|e| format!("Failed to save thumbnail: {}", e))?;
⋮----
.unwrap_or(dest)
.to_string_lossy()
.into_owned();
⋮----
.unwrap_or(thumb_path)
⋮----
Ok(ImportedImage {
⋮----
original_path: source_path.to_string(),
⋮----
format: ext.to_lowercase(),
⋮----
mod tests {
⋮----
fn test_process_image_creates_thumbnail() {
⋮----
let test_dir = std::env::temp_dir().join("efx_test_import");
⋮----
fs::create_dir_all(&test_dir).unwrap();
⋮----
let test_img_path = test_dir.join("test.png");
img.save(&test_img_path).unwrap();
⋮----
let project_dir = test_dir.join("project");
let result = process_image(
test_img_path.to_str().unwrap(),
project_dir.to_str().unwrap(),
⋮----
assert!(result.is_ok(), "Import failed: {:?}", result.err());
let imported = result.unwrap();
⋮----
assert_eq!(imported.width, 200);
assert_eq!(imported.height, 150);
assert_eq!(imported.format, "png");
assert!(!imported.id.is_empty());
⋮----
assert!(
⋮----
let thumb_meta = fs::metadata(&imported.thumbnail_path).unwrap();
assert!(thumb_meta.len() > 0, "Thumbnail is empty");
⋮----
fn test_heic_returns_graceful_not_yet_supported_error() {
let test_dir = std::env::temp_dir().join("efx_test_heic");
⋮----
let test_file = test_dir.join("test.heic");
fs::write(&test_file, b"fake heic content").unwrap();
⋮----
test_file.to_str().unwrap(),
⋮----
assert!(result.is_err());
let err = result.unwrap_err();
⋮----
fn test_unsupported_format_returns_error() {
let test_dir = std::env::temp_dir().join("efx_test_unsupported");
⋮----
let test_file = test_dir.join("test.bmp");
fs::write(&test_file, b"fake bmp content").unwrap();
⋮----
assert!(result.unwrap_err().contains("Unsupported format"));
⋮----
fn test_missing_file_returns_error() {
let result = process_image("/nonexistent/path/image.jpg", "/tmp/project");
⋮----
assert!(result.unwrap_err().contains("File not found"));
````

## File: app/src-tauri/src/services/mod.rs
````rust
pub mod ffmpeg;
pub mod image_pool;
pub mod project_io;
⋮----
pub mod tablet;
````

## File: app/src-tauri/src/services/project_io.rs
````rust
use crate::models::project::MceProject;
use std::fs;
use std::path::Path;
⋮----
pub fn create_project_dir(dir_path: &str) -> Result<(), String> {
⋮----
let images_dir = base.join("images");
let thumbs_dir = images_dir.join(".thumbs");
let videos_dir = base.join("videos");
let paint_dir = base.join("paint");
⋮----
.map_err(|e| format!("Failed to create project directories: {}", e))?;
⋮----
.map_err(|e| format!("Failed to create videos directory: {}", e))?;
⋮----
.map_err(|e| format!("Failed to create paint directory: {}", e))?;
⋮----
Ok(())
⋮----
pub fn save_project(project: &MceProject, file_path: &str, _project_root: &str) -> Result<(), String> {
⋮----
.map_err(|e| format!("Failed to serialize project: {}", e))?;
⋮----
let tmp_path = format!("{}.tmp", file_path);
⋮----
.map_err(|e| format!("Failed to write temp file: {}", e))?;
⋮----
.map_err(|e| format!("Failed to rename temp file: {}", e))?;
⋮----
pub fn open_project(file_path: &str) -> Result<MceProject, String> {
⋮----
.map_err(|e| format!("Failed to read project file: {}", e))?;
⋮----
.map_err(|e| format!("Failed to parse project file: {}", e))?;
⋮----
Ok(project)
⋮----
fn make_relative(abs_path: &str, project_root: &str) -> String {
let root = if project_root.ends_with('/') {
project_root.to_string()
⋮----
format!("{}/", project_root)
⋮----
if abs_path.starts_with(&root) {
abs_path[root.len()..].to_string()
⋮----
abs_path.to_string()
⋮----
fn make_absolute(rel_path: &str, project_root: &str) -> String {
let root = project_root.trim_end_matches('/');
format!("{}/{}", root, rel_path)
⋮----
pub fn migrate_temp_images(temp_dir: &str, project_dir: &str) -> Result<Vec<String>, String> {
let src_images = Path::new(temp_dir).join("images");
let dst_images = Path::new(project_dir).join("images");
⋮----
if !src_images.exists() {
return Ok(vec![]);
⋮----
fs::create_dir_all(dst_images.join(".thumbs"))
.map_err(|e| format!("Failed to create images dir: {e}"))?;
⋮----
let mut migrated = vec![];
⋮----
for entry in fs::read_dir(&src_images).map_err(|e| e.to_string())? {
let entry = entry.map_err(|e| e.to_string())?;
let path = entry.path();
if path.is_dir() && path.file_name().map_or(false, |n| n == ".thumbs") {
⋮----
for thumb_entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
let thumb_entry = thumb_entry.map_err(|e| e.to_string())?;
let thumb_src = thumb_entry.path();
if thumb_src.is_file() {
let fname = thumb_src.file_name().unwrap().to_string_lossy().to_string();
let thumb_dst = dst_images.join(".thumbs").join(&fname);
move_file(&thumb_src, &thumb_dst)?;
⋮----
} else if path.is_file() {
let fname = path.file_name().unwrap().to_string_lossy().to_string();
let dst = dst_images.join(&fname);
move_file(&path, &dst)?;
migrated.push(fname);
⋮----
Ok(migrated)
⋮----
fn move_file(src: &Path, dst: &Path) -> Result<(), String> {
⋮----
Ok(()) => Ok(()),
⋮----
fs::copy(src, dst).map_err(|e| format!("Copy failed: {e}"))?;
fs::remove_file(src).map_err(|e| format!("Remove after copy failed: {e}"))?;
⋮----
mod tests {
⋮----
fn test_create_project_dir_creates_subdirectories() {
let test_dir = std::env::temp_dir().join("efx_test_proj_create");
⋮----
create_project_dir(test_dir.to_str().unwrap()).unwrap();
assert!(test_dir.join("images").exists());
assert!(test_dir.join("images/.thumbs").exists());
assert!(test_dir.join("paint").exists());
⋮----
fn test_save_and_open_roundtrip() {
let test_dir = std::env::temp_dir().join("efx_test_proj_roundtrip");
⋮----
std::fs::create_dir_all(&test_dir).unwrap();
⋮----
name: "Test Project".into(),
⋮----
created_at: "2026-03-03T10:00:00Z".into(),
modified_at: "2026-03-03T10:00:00Z".into(),
sequences: vec![],
images: vec![MceImageRef {
⋮----
audio_tracks: vec![],
⋮----
let mce_path = test_dir.join("test.mce");
let project_root = test_dir.to_str().unwrap();
save_project(&project, mce_path.to_str().unwrap(), project_root).unwrap();
⋮----
assert!(mce_path.exists());
⋮----
let loaded = open_project(mce_path.to_str().unwrap()).unwrap();
assert_eq!(loaded.name, "Test Project");
assert_eq!(loaded.images.len(), 1);
assert_eq!(loaded.images[0].id, "img-1");
⋮----
assert_eq!(loaded.images[0].relative_path, "images/photo_abc12345.jpg");
⋮----
fn test_make_relative_and_absolute() {
⋮----
let rel = make_relative(abs, root);
assert_eq!(rel, "images/photo.jpg");
let back = make_absolute(&rel, root);
assert_eq!(back, "/Users/me/project/images/photo.jpg");
⋮----
fn test_atomic_write_creates_no_temp_file() {
let test_dir = std::env::temp_dir().join("efx_test_atomic");
⋮----
name: "Atomic Test".into(),
⋮----
images: vec![],
⋮----
save_project(
⋮----
mce_path.to_str().unwrap(),
test_dir.to_str().unwrap(),
⋮----
.unwrap();
⋮----
assert!(!test_dir.join("test.mce.tmp").exists());
⋮----
fn default_transform() -> MceLayerTransform {
⋮----
fn default_source() -> MceLayerSource {
⋮----
source_type: "image-sequence".into(),
⋮----
image_ids: vec![],
⋮----
fn test_fx_sequence_roundtrip() {
let test_dir = std::env::temp_dir().join("efx_test_fx_roundtrip");
⋮----
id: "seq-content".into(),
name: "Scene 1".into(),
⋮----
key_photos: vec![],
layers: vec![MceLayer {
⋮----
kind: Some("content".into()),
⋮----
id: "seq-grain".into(),
name: "Grain FX".into(),
⋮----
kind: Some("fx".into()),
in_frame: Some(0),
out_frame: Some(100),
⋮----
id: "seq-cg".into(),
name: "Color Grade FX".into(),
⋮----
in_frame: Some(10),
out_frame: Some(90),
visible: Some(true),
⋮----
name: "FX Test Project".into(),
⋮----
created_at: "2026-03-10T10:00:00Z".into(),
modified_at: "2026-03-10T10:00:00Z".into(),
sequences: vec![content_seq, grain_seq, colorgrade_seq],
⋮----
let mce_path = test_dir.join("test_fx.mce");
save_project(&project, mce_path.to_str().unwrap(), test_dir.to_str().unwrap()).unwrap();
⋮----
assert_eq!(loaded.sequences.len(), 3);
⋮----
assert_eq!(content.kind, Some("content".into()));
⋮----
assert_eq!(grain.kind, Some("fx".into()));
assert_eq!(grain.in_frame, Some(0));
assert_eq!(grain.out_frame, Some(100));
assert_eq!(grain.visible, None);
⋮----
assert_eq!(grain_layer.source.density, Some(0.3));
assert_eq!(grain_layer.source.size, Some(1.0));
assert_eq!(grain_layer.source.intensity, Some(0.5));
assert_eq!(grain_layer.source.lock_seed, Some(true));
assert_eq!(grain_layer.source.seed, Some(42));
⋮----
assert_eq!(cg.kind, Some("fx".into()));
assert_eq!(cg.in_frame, Some(10));
assert_eq!(cg.out_frame, Some(90));
⋮----
assert_eq!(cg_layer.source.brightness, Some(0.1));
assert_eq!(cg_layer.source.contrast, Some(-0.2));
assert_eq!(cg_layer.source.tint_color, Some("#D4A574".into()));
assert_eq!(cg_layer.source.preset, Some("cinematic".into()));
⋮----
assert_eq!(base_layer.source.density, None);
assert_eq!(base_layer.source.brightness, None);
⋮----
fn test_v3_project_without_fx_fields_opens() {
let test_dir = std::env::temp_dir().join("efx_test_v3_compat");
⋮----
let mce_path = test_dir.join("old_project.mce");
std::fs::write(&mce_path, v3_json).unwrap();
⋮----
assert_eq!(loaded.name, "Old Project");
assert_eq!(loaded.version, 3);
assert_eq!(loaded.sequences.len(), 1);
⋮----
assert_eq!(seq.kind, None);
assert_eq!(seq.in_frame, None);
assert_eq!(seq.out_frame, None);
assert_eq!(seq.visible, None);
⋮----
assert_eq!(layer.source.density, None);
assert_eq!(layer.source.brightness, None);
assert_eq!(layer.source.lock_seed, None);
assert_eq!(layer.source.seed, None);
````

## File: app/src-tauri/src/services/tablet.rs
````rust
use serde::Serialize;
⋮----
pub struct TabletPressureEvent {
⋮----
pub fn install_tablet_monitor(app_handle: AppHandle) {
use std::sync::Arc;
⋮----
main_queue.exec_async(move || {
use std::panic::AssertUnwindSafe;
use std::ptr::NonNull;
⋮----
use block2::RcBlock;
⋮----
objc_catch(AssertUnwindSafe(|| {
let event_ref: &NSEvent = event.as_ref();
⋮----
let subtype = event_ref.subtype().0;
⋮----
let pressure = event_ref.pressure() as f64;
let tilt = event_ref.tilt();
⋮----
let _ = handle.emit(
⋮----
event.as_ptr()
⋮----
let mask_val = NSEventMask(mask);
````

## File: app/src-tauri/src/lib.rs
````rust
mod commands;
mod models;
mod services;
⋮----
use commands::config;
use commands::export;
use commands::image;
use commands::project;
use percent_encoding::percent_decode_str;
⋮----
use tauri::Emitter;
⋮----
use services::tablet;
⋮----
pub fn run() {
⋮----
.plugin(tauri_plugin_shell::init())
.plugin(tauri_plugin_dialog::init())
.plugin(tauri_plugin_store::Builder::default().build())
.plugin(tauri_plugin_fs::init())
.plugin(tauri_plugin_notification::init())
.setup(|app| {
⋮----
let app_submenu = SubmenuBuilder::new(app, &app.package_info().name)
.about(None)
.separator()
.services()
⋮----
.hide()
.hide_others()
.show_all()
⋮----
.quit()
.build()?;
⋮----
MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
⋮----
MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
⋮----
MenuItem::with_id(app, "new-project", "New Project", true, Some("CmdOrCtrl+N"))?;
⋮----
Some("CmdOrCtrl+O"),
⋮----
MenuItem::with_id(app, "save-project", "Save", true, Some("CmdOrCtrl+S"))?;
⋮----
Some("CmdOrCtrl+Shift+E"),
⋮----
.item(&new_project_item)
.item(&open_project_item)
⋮----
.item(&save_project_item)
⋮----
.item(&export_item)
⋮----
.item(&close_project_item)
⋮----
.item(&undo_item)
.item(&redo_item)
⋮----
.cut()
.copy()
.paste()
.select_all()
⋮----
Some("CmdOrCtrl+0"),
⋮----
.item(&zoom_in_item)
.item(&zoom_out_item)
⋮----
.item(&fit_to_window_item)
⋮----
.item(&app_submenu)
.item(&file_submenu)
.item(&edit_submenu)
.item(&view_submenu)
⋮----
app.set_menu(menu)?;
⋮----
let handle = app.handle().clone();
app.on_menu_event(move |_app_handle, event| {
if event.id() == "new-project" {
handle.emit("menu:new-project", ()).ok();
} else if event.id() == "open-project" {
handle.emit("menu:open-project", ()).ok();
} else if event.id() == "save-project" {
handle.emit("menu:save-project", ()).ok();
} else if event.id() == "close-project" {
handle.emit("menu:close-project", ()).ok();
} else if event.id() == "export" {
handle.emit("menu:export", ()).ok();
} else if event.id() == "undo" {
handle.emit("menu:undo", ()).ok();
} else if event.id() == "redo" {
handle.emit("menu:redo", ()).ok();
} else if event.id() == "zoom-in" {
handle.emit("menu:zoom-in", ()).ok();
} else if event.id() == "zoom-out" {
handle.emit("menu:zoom-out", ()).ok();
} else if event.id() == "fit-to-window" {
handle.emit("menu:fit-to-window", ()).ok();
⋮----
tablet::install_tablet_monitor(app.handle().clone());
⋮----
Ok(())
⋮----
.register_uri_scheme_protocol("efxasset", |_app, request| {
⋮----
let uri = request.uri();
let raw_path = uri.path();
let path = percent_decode_str(raw_path)
.decode_utf8_lossy()
.to_string();
⋮----
let lower = path.to_lowercase();
let mime = if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
⋮----
} else if lower.ends_with(".png") {
⋮----
} else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
⋮----
} else if lower.ends_with(".heic") || lower.ends_with(".heif") {
⋮----
} else if lower.ends_with(".mp4") || lower.ends_with(".m4v") {
⋮----
} else if lower.ends_with(".mov") {
⋮----
} else if lower.ends_with(".webm") {
⋮----
} else if lower.ends_with(".avi") {
⋮----
let is_video = mime.starts_with("video/");
⋮----
.header("Access-Control-Allow-Origin", "*")
.status(404)
.body(Vec::new())
.unwrap();
⋮----
let file_size = metadata.len();
⋮----
.headers()
.get("Range")
.or_else(|| request.headers().get("range"))
.and_then(|v| v.to_str().ok())
.map(|s| s.to_string());
⋮----
if let Some(range_spec) = range.strip_prefix("bytes=") {
let parts: Vec<&str> = range_spec.split('-').collect();
let start: u64 = parts[0].parse().unwrap_or(0);
let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
parts[1].parse().unwrap_or(file_size - 1)
⋮----
let end = end.min(file_size - 1);
⋮----
file.seek(SeekFrom::Start(start)).ok();
let mut buf = vec![0u8; length as usize];
let _ = file.read_exact(&mut buf);
⋮----
.header("Content-Type", mime)
.header("Accept-Ranges", "bytes")
.header(
⋮----
format!("bytes {}-{}/{}", start, end, file_size),
⋮----
.header("Content-Length", length.to_string())
⋮----
.status(206)
.body(buf)
⋮----
.header("Content-Length", file_size.to_string())
⋮----
.status(200)
.body(data)
.unwrap(),
⋮----
.header("Cache-Control", "no-cache, no-store, must-revalidate")
.header("Pragma", "no-cache")
⋮----
.invoke_handler(tauri::generate_handler![
⋮----
.run(tauri::generate_context!())
.expect("error while running tauri application");
````

## File: app/src-tauri/src/main.rs
````rust
fn main() {
````

## File: app/src-tauri/build.rs
````rust
fn main() {
````

## File: app/src-tauri/Cargo.toml
````toml
[package]
name = "efx-motion-editor"
version = "0.1.0"
description = "EFX Motion Editor"
authors = ["EFX Lab"]
edition = "2021"

[lib]
name = "efx_motion_editor_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["devtools", "protocol-asset"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
image = { version = "0.25", features = ["jpeg", "png", "tiff"] }
uuid = { version = "1", features = ["v4"] }
tauri-plugin-store = "2"
tauri-plugin-fs = "2"
chrono = { version = "0.4", features = ["serde"] }
percent-encoding = "2.3.2"
serde_yaml = "0.9"
tauri-plugin-notification = "2.3.3"
reqwest = { version = "0.12", features = ["rustls-tls"] }
tokio = { version = "1", features = ["fs"] }
zip = { version = "2", default-features = false, features = ["deflate"] }

[target.'cfg(target_os = "macos")'.dependencies]
objc2 = { version = "0.6", features = ["exception"] }
objc2-foundation = { version = "0.3", features = ["NSObject", "NSThread"] }
objc2-app-kit = { version = "0.3", features = ["NSEvent", "NSResponder"] }
block2 = "0.6"
dispatch = "0.2"
````

## File: app/src-tauri/tauri.conf.json
````json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "EFX Motion Editor",
  "version": "0.1.0",
  "identifier": "com.efxlab.motion-editor",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "bundle": {
    "resources": ["resources/*"]
  },
  "app": {
    "windows": [
      {
        "title": "EFX Motion Editor",
        "width": 1440,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 680,
        "backgroundColor": "#0F0F0F"
      }
    ],
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost efxasset: blob: https://*; media-src 'self' asset: http://asset.localhost efxasset:; connect-src 'self' ipc: http://ipc.localhost https://*; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'",
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPDATA/**", "$RESOURCE/**", "/Volumes/**", "$HOME/**", "/tmp/**", "/private/**"]
      }
    }
  }
}
````

## File: app/CLAUDE.md
````markdown

````

## File: app/index.html
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EFX Motion Editor</title>
  </head>
  <body style="background:#0F0F0F">
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## File: app/package.json
````json
{
  "name": "efx-motion-editor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@efxlab/efx-physic-paint": "workspace:*",
    "@efxlab/motion-canvas-2d": "4.0.0",
    "@efxlab/motion-canvas-core": "4.0.0",
    "@efxlab/motion-canvas-player": "4.0.0",
    "@preact/signals": "^2.8.1",
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.6.0",
    "@tauri-apps/plugin-fs": "^2.4.5",
    "@tauri-apps/plugin-notification": "^2.3.3",
    "@tauri-apps/plugin-store": "^2.4.2",
    "audiobuffer-to-wav": "^1.0.0",
    "bezier-js": "^6.1.4",
    "fit-curve": "^0.2.0",
    "lucide-preact": "^0.577.0",
    "p5.brush": "2.1.3-beta",
    "perfect-freehand": "^1.2.3",
    "preact": "^10.28.4",
    "sortablejs": "^1.15.7",
    "stackblur-canvas": "^3.0.0",
    "tinykeys": "^3.0.0"
  },
  "devDependencies": {
    "@efxlab/motion-canvas-ui": "4.0.0",
    "@efxlab/motion-canvas-vite-plugin": "4.0.0",
    "@preact/preset-vite": "^2.10.3",
    "@tailwindcss/vite": "^4.0.0",
    "@tauri-apps/cli": "^2.10.0",
    "@types/sortablejs": "^1.15.9",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.9.3",
    "vite": "5.4.21",
    "vitest": "^2.1.9"
  }
}
````

## File: app/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
````

## File: app/vite.config.ts
````typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvasModule from '@efxlab/motion-canvas-vite-plugin';
⋮----
config()
configResolved(config)
````

## File: app/vitest.config.ts
````typescript
import { defineConfig } from 'vitest/config';
````

## File: packages/efx-physic-paint/src/animation/AnimationPlayer.ts
````typescript
import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke } from '../types'
⋮----
export class AnimationPlayer
⋮----
constructor(engine: EfxPaintEngine)
⋮----
play(config: AnimationConfig): void
⋮----
stop(): void
⋮----
isPlaying(): boolean
⋮----
getState(): AnimationState
⋮----
private distributeStrokes(strokes: PaintStroke[], totalFrames: number): void
⋮----
private renderFrame(frameIndex: number): void
````

## File: packages/efx-physic-paint/src/animation/index.ts
````typescript

````

## File: packages/efx-physic-paint/src/animation/types.ts
````typescript
import type { PaintStroke } from '../types'
⋮----
export interface AnimationConfig {
  frameCount: number
  fps: number
  onFrame?: (frameIndex: number, canvas: HTMLCanvasElement) => void
  onComplete?: () => void
}
⋮----
export interface AnimationState {
  playing: boolean
  currentFrame: number
  totalFrames: number
}
⋮----
export interface FrameStroke {
  stroke: PaintStroke
  startFrame: number
  endFrame: number
  pointsPerFrame: number
}
````

## File: packages/efx-physic-paint/src/brush/erase.ts
````typescript
import type { PenPoint, BrushOpts, WetBuffers } from '../types'
import { lerp, clamp, curveBounds } from '../util/math'
import { smooth, resample, ribbon, deform, deformN } from './stroke'
import { fillFlat } from './paint'
⋮----
function getEffectivePressure(penPoint: PenPoint, sliderValue: number, hasPenInput: boolean): number
⋮----
export function applyEraseStroke(
  rawPts: PenPoint[],
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  width: number,
  height: number,
  hasPenInput: boolean,
  embossStrength: number,
  paperHeight: Float32Array | null,
  bgMode: string,
  bgData: ImageData | null,
): void
````

## File: packages/efx-physic-paint/src/brush/paint.ts
````typescript
import type { PenPoint, BrushOpts, WetBuffers, SavedWetBuffers } from '../types'
import { hexRgb, rgbHex, mixSubtractive } from '../util/color'
import { gauss, lerp, clamp, curveBounds } from '../util/math'
import { polyBounds } from '../util/math'
import { sampleH } from '../core/paper'
import { transferToWetLayerClipped } from '../core/wet-layer'
import { smooth, resample, ribbon, deform, deformN, avgPenData } from './stroke'
import { fbm } from '../util/noise'
⋮----
export function fillPolyGrain(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  r: number,
  g: number,
  b: number,
  alpha: number,
  grain: number,
  emboss: number,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  sampleHFn: (x: number, y: number) => number,
): void
⋮----
export function fillFlat(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  color: string,
  alpha: number,
): void
⋮----
export function drawBristleTraces(
  ctx: CanvasRenderingContext2D,
  curve: PenPoint[],
  radius: number,
  color: string,
  opac: number,
  penData: PenPoint[],
  hasPenInput: boolean,
  sampleHFn: (x: number, y: number) => number,
): void
⋮----
export function sampleAreaColor(
  imgData: ImageData,
  cx: number,
  cy: number,
  radius: number,
): [number, number, number] | null
⋮----
export function buildCarriedColors(
  curve: PenPoint[],
  pickerColor: string,
  pickup: number,
  canvasSnap: ImageData,
  radius: number,
): Array<[number, number, number]>
⋮----
export function applyPaperEmboss(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  paperHeight: Float32Array | null,
  wetAlpha: Float32Array,
  width: number,
  _height: number,
  embossStrength: number,
  embossStack: number,
  userOpacity: number = 0,
): void
⋮----
export function applyWetComposite(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  width: number,
  height: number,
): void
⋮----
export function applyWetCompositeClipped(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  bounds: { x: number; y: number; w: number; h: number },
): void
⋮----
export function renderPaintStroke(
  rawPts: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  savedWet: SavedWetBuffers,
  dryPos: Float32Array,
  lastStrokeMask: Uint8Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  wetPaper: boolean,
  embossStrength: number,
  embossStack: number,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
): void
⋮----
export function renderPaintStrokeSingleColor(
  curve: PenPoint[],
  color: string,
  radius: number,
  opac: number,
  wet: number,
  speedDeplete: number,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  dryPos: Float32Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  embossStrength: number,
  embossStack: number,
  wetPaper: boolean,
  hasPenInput: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
): void
````

## File: packages/efx-physic-paint/src/brush/stroke.ts
````typescript
import type { PenPoint } from '../types'
import { gauss, distXY, clamp } from '../util/math'
import { lerpPt } from '../util/math'
⋮----
export function avgPenData(pts: PenPoint[]):
⋮----
export function pressureAtT(pts: PenPoint[], t: number): number
⋮----
export function speedAtT(pts: PenPoint[], t: number): number
⋮----
export function tiltAtT(pts: PenPoint[], t: number):
⋮----
export function smooth(pts: PenPoint[], iterations: number = 3): PenPoint[]
⋮----
export function resample(pts: PenPoint[], spacing: number): PenPoint[]
⋮----
export function ribbon(
  curve: PenPoint[],
  halfWidth: number,
  tPow: number = 0.8,
  hasPenInput: boolean = false,
): Array<[number, number]>
⋮----
export function deform(poly: Array<[number, number]>, variance: number): Array<[number, number]>
⋮----
export function deformN(poly: Array<[number, number]>, depth: number, variance: number): Array<[number, number]>
````

## File: packages/efx-physic-paint/src/core/diffusion.ts
````typescript
import type { WetBuffers, DryingLUT, FluidBuffers, FluidConfig } from '../types'
import { BLOW_DECAY } from '../types'
import { dryStep } from './drying'
import { fluidPhysicsStep } from './fluids'
⋮----
export function physicsStep(
  wet: WetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  fluid: FluidBuffers,
  fluidConfig: FluidConfig,
  blowDX: Float32Array,
  blowDY: Float32Array,
  width: number,
  height: number,
  strength: number,
  drySpeed: number,
  physicsMode: 'local' | 'last' | 'all' | null,
  lastStrokeBounds: { x0: number; y0: number; x1: number; y1: number } | null,
  physicsTickCount: number,
  sampleHFn: (x: number, y: number) => number,
  paperHeight: Float32Array | null,
): void
````

## File: packages/efx-physic-paint/src/core/drying.ts
````typescript
import type { WetBuffers, SavedWetBuffers, DryingLUT } from '../types'
import { LUT_SIZE } from '../types'
import { lerp, clamp } from '../util/math'
⋮----
export function initDryingLUT(dryLUT: Float32Array, invLUT: Float32Array): void
⋮----
export function dryStep(
  wet: WetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  drySpeed: number,
  paperHeight: Float32Array | null,
): void
⋮----
export function forceDryAll(
  wet: WetBuffers,
  saved: SavedWetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void
````

## File: packages/efx-physic-paint/src/core/fluids.ts
````typescript
import type { WetBuffers, FluidBuffers, FluidConfig } from '../types'
⋮----
export function IX(W: number, i: number, j: number): number
⋮----
export function setBnd(W: number, H: number, b: number, x: Float32Array): void
⋮----
export function linSolve(
  W: number, H: number, b: number,
  x: Float32Array, x0: Float32Array,
  a: number, c: number, iterations: number,
): void
⋮----
export function diffuse(
  W: number, H: number, b: number,
  x: Float32Array, x0: Float32Array,
  diff: number, dt: number, iterations: number,
): void
⋮----
export function advect(
  W: number, H: number, b: number,
  d: Float32Array, d0: Float32Array,
  u: Float32Array, v: Float32Array,
  dt: number,
): void
⋮----
export function project(
  W: number, H: number,
  u: Float32Array, v: Float32Array,
  p: Float32Array, div: Float32Array,
  iterations: number,
): void
⋮----
export function addSource(W: number, H: number, x: Float32Array, s: Float32Array, dt: number): void
⋮----
export function velStep(
  W: number, H: number,
  u: Float32Array, v: Float32Array,
  u0: Float32Array, v0: Float32Array,
  visc: number, dt: number, iterations: number,
): void
⋮----
export function densStep(
  W: number, H: number,
  x: Float32Array, x0: Float32Array,
  u: Float32Array, v: Float32Array,
  diff: number, dt: number, iterations: number,
): void
⋮----
export function addHeightEqualization(
  W: number, H: number,
  u0: Float32Array, v0: Float32Array,
  waterHeight: Float32Array,
  omega_h: number,
): void
⋮----
export function darkenEdges(
  W: number, H: number,
  wetMask: Float32Array, blurMask: Float32Array,
  u0: Float32Array, v0: Float32Array,
  darkening: number,
): void
⋮----
export function buildWetMaskFromAlpha(
  W: number, H: number,
  wetAlpha: Float32Array,
  canvasW: number, canvasH: number,
  wetMask: Float32Array,
  threshold: number,
): void
⋮----
export function boxBlur3x3(
  W: number, H: number,
  src: Float32Array, dst: Float32Array,
  passes: number,
): void
⋮----
export function fluidPhysicsStep(
  wet: WetBuffers,
  fluid: FluidBuffers,
  config: FluidConfig,
  canvasW: number,
  canvasH: number,
  blowDX: Float32Array,
  blowDY: Float32Array,
  lastStrokeBounds: { x0: number; y0: number; x1: number; y1: number } | null,
  physicsMode: 'local' | 'last' | 'all' | null,
  _sampleHFn: (x: number, y: number) => number,
): void
⋮----
export function localFluidPhysicsStep(
  wet: WetBuffers,
  config: FluidConfig,
  canvasW: number,
  canvasH: number,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  ticks: number,
): void
````

## File: packages/efx-physic-paint/src/core/paper.ts
````typescript
import { TEXTURE_SIZE } from '../types'
import { lerp, clamp } from '../util/math'
import { fbm } from '../util/noise'
⋮----
export function loadPaperTexture(
  url: string,
  width: number,
  height: number,
): Promise<
⋮----
export function sampleH(
  paperHeight: Float32Array | null,
  x: number,
  y: number,
  width: number,
  height: number,
): number
⋮----
export function sampleTexH(
  textureHeight: Float32Array | null,
  x: number,
  y: number,
): number
⋮----
export function ensureHeightMap(
  texHeight: Float32Array | null,
  _bgData: ImageData | null,
  width: number,
  height: number,
): Float32Array
````

## File: packages/efx-physic-paint/src/core/wet-layer.ts
````typescript
import type { WetBuffers, SavedWetBuffers, TmpBuffers, PenPoint } from '../types'
import { lerp } from '../util/math'
⋮----
export function featherWetEdges(
  wet: WetBuffers,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
  passes: number,
): void
import { hexRgb, mixSubtractive } from '../util/color'
⋮----
export function createWetBuffers(size: number): WetBuffers
⋮----
export function createSavedWetBuffers(size: number): SavedWetBuffers
⋮----
export function createTmpBuffers(size: number): TmpBuffers
⋮----
export function clearWetLayer(
  wet: WetBuffers,
  saved: SavedWetBuffers,
  dryPos: Float32Array,
  blowDX: Float32Array,
  blowDY: Float32Array,
  lastStrokeMask: Uint8Array,
): void
⋮----
export function depositToWetLayer(
  curve: PenPoint[],
  color: string,
  radius: number,
  opacity: number,
  waterAmount: number,
  wetBuffers: WetBuffers,
  hasPenInput: boolean,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,
  gamma: number = 0.8,
  delta: number = 1.2,
  userOpacity: number = 1.0,
): void
⋮----
export function depositToWetLayerWithColors(
  curve: PenPoint[],
  carriedColors: Array<[number, number, number]>,
  radius: number,
  opacity: number,
  waterAmount: number,
  wetBuffers: WetBuffers,
  hasPenInput: boolean,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,
  gamma: number = 0.8,
  delta: number = 1.2,
  userOpacity: number = 1.0,
): void
⋮----
export function transferToWetLayer(
  offCtx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  waterAmount: number,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,
  gamma: number = 0.8,
  delta: number = 1.2,
  userOpacity: number = 1.0,
): void
⋮----
export function transferToWetLayerClipped(
  offCtx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  waterAmount: number,
  bounds: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,
  gamma: number = 0.8,
  delta: number = 1.2,
  userOpacity: number = 1.0,
): void
````

## File: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
````typescript
import type {
  EngineConfig,
  EngineState,
  ToolType,
  BgMode,
  BrushOpts,
  PenPoint,
  WetBuffers,
  SavedWetBuffers,
  TmpBuffers,
  ColorMap,
  DryingLUT,
  FluidBuffers,
  FluidConfig,
  PaintStroke,
  SerializedProject,
} from '../types'
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  LUT_SIZE,
} from '../types'
import { clamp, distXY, curveBounds } from '../util/math'
import { lerp } from '../util/math'
import { createWetBuffers, createSavedWetBuffers, createTmpBuffers, clearWetLayer, featherWetEdges } from '../core/wet-layer'
import { initDryingLUT, dryStep, forceDryAll } from '../core/drying'
import { physicsStep } from '../core/diffusion'
import { localFluidPhysicsStep } from '../core/fluids'
import { loadPaperTexture, sampleH, ensureHeightMap } from '../core/paper'
import { renderPaintStroke } from '../brush/paint'
import { applyEraseStroke } from '../brush/erase'
import { compositeWetLayer } from '../render/compositor'
import { setupDualCanvas, drawBg, drawBrushCursor, drawStrokePreview } from '../render/canvas'
import type { StrokePreview, DualCanvas } from '../render/canvas'
⋮----
export class EfxPaintEngine
⋮----
// --- Background Data ---
⋮----
// --- Engine State ---
⋮----
// --- Stroke Recording ---
⋮----
// --- Pointer State ---
⋮----
constructor(container: HTMLElement, config: EngineConfig)
⋮----
// brushTexture removed per D-07: paper-height modulates deposit instead
⋮----
// Draw initial background
⋮----
// Start render loop
⋮----
/**
   * Async initialization: loads paper textures and redraws background.
   * Must be called after construction for full engine readiness.
   * onEngineReady should fire only after this resolves.
   */
async init(): Promise<void>
⋮----
// ================================================================
//  PUBLIC API (per D-08)
// ================================================================
⋮----
/** Set the active tool */
setTool(tool: ToolType): void
⋮----
/** Set brush size (1-80) */
setBrushSize(size: number): void
⋮----
/** Set brush opacity (10-100) */
setBrushOpacity(opacity: number): void
⋮----
/** Set brush pressure multiplier (10-100) */
setBrushPressure(pressure: number): void
⋮----
/** Set water amount (0-100) */
setWaterAmount(amount: number): void
⋮----
/** Set dry speed slider (0-100) — maps to internal drySpeed 10-100 */
setDrySpeed(speed: number): void
⋮----
/** Set edge detail (0-100) */
setEdgeDetail(detail: number): void
⋮----
setAntiAlias(value: number): void
⋮----
/** Set color pickup amount (0-100) */
setPickup(pickup: number): void
⋮----
/** Set erase strength (0-100) */
setEraseStrength(strength: number): void
⋮----
/** Set physics strength (0-100) — maps to internal 0-1 range */
setPhysicsStrength(strength: number): void
⋮----
/** Set fluid viscosity. Low=watery (0.0001), high=thick (0.01). Per D-13 */
setViscosity(v: number): void
⋮----
/** Set physics mode: 'local' (auto during painting) or null (manual only). Per D-07 */
setPhysicsMode(mode: 'local' | null): void
⋮----
setLocalSpreadStrength(strength: number): void
⋮----
setColorHex(hex: string): void
⋮----
setBgMode(mode: BgMode): void
⋮----
setPaperGrain(key: string): void
⋮----
setEmbossStrength(strength: number): void
⋮----
setWetPaper(wet: boolean): void
⋮----
startPhysics(mode: 'local' | 'last' | 'all'): void
⋮----
const sampleHFn = (x: number, y: number)
⋮----
stopPhysics(): void
⋮----
forceDry(): void
⋮----
private startNaturalDrying(): void
⋮----
private stopNaturalDrying(): void
⋮----
undo(): void
⋮----
clear(): void
⋮----
save(): SerializedProject
⋮----
load(json: SerializedProject): void
⋮----
destroy(): void
⋮----
getCanvas(): HTMLCanvasElement
⋮----
getDisplayCanvas(): HTMLCanvasElement
⋮----
getStrokes(): PaintStroke[]
⋮----
setInputLocked(locked: boolean): void
⋮----
renderAllStrokes(): void
⋮----
setAnimationMode(mode: boolean): void
⋮----
renderPartialStrokes(strokeData: Array<
⋮----
private render(): void
⋮----
private onPointerDown(e: PointerEvent): void
⋮----
private onPointerMove(e: PointerEvent): void
⋮----
private onPointerUp(e: PointerEvent): void
⋮----
private onPointerLeave(e: PointerEvent): void
⋮----
private extractPenPoint(e: PointerEvent): PenPoint
⋮----
private redrawAll(): void
⋮----
private replayAnimated(strokes: PaintStroke[]): void
⋮----
const replayNext = () =>
⋮----
private serializeProject(): SerializedProject
⋮----
private loadProjectData(json: SerializedProject): void
⋮----
private async loadPaperTextures(papers: Array<
````

## File: packages/efx-physic-paint/src/render/canvas.ts
````typescript
import type { BgMode, ToolType, PenPoint } from '../types'
import { smooth, resample, ribbon } from '../brush/stroke'
⋮----
export interface DualCanvas {
  dryCanvas: HTMLCanvasElement
  dryCtx: CanvasRenderingContext2D
  displayCanvas: HTMLCanvasElement
  displayCtx: CanvasRenderingContext2D
}
⋮----
export function setupDualCanvas(
  container: HTMLElement,
  width: number,
  height: number,
): DualCanvas
⋮----
export function drawBg(
  bgCtx: CanvasRenderingContext2D,
  bgMode: BgMode,
  width: number,
  height: number,
  paperTextures: Map<string, { tiledCanvas: HTMLCanvasElement; heightMap: Float32Array }>,
  userPhoto: HTMLImageElement | null,
): ImageData | null
⋮----
export function drawBrushCursor(
  displayCtx: CanvasRenderingContext2D,
  cursorX: number,
  cursorY: number,
  radius: number,
  _tool: ToolType,
  _width: number,
  _height: number,
): void
⋮----
export interface StrokePreview {
  pts: PenPoint[]
  color: string
  radius: number
  opacity: number
}
⋮----
export function drawStrokePreview(
  displayCtx: CanvasRenderingContext2D,
  preview: StrokePreview | null,
): void
````

## File: packages/efx-physic-paint/src/render/compositor.ts
````typescript
import type { WetBuffers } from '../types'
import { DENSITY_NORM, DENSITY_K_DISPLAY, MAX_DISPLAY_ALPHA } from '../types'
import { clamp } from '../util/math'
⋮----
export function compositeWetLayer(
  displayCtx: CanvasRenderingContext2D,
  wet: WetBuffers,
  width: number,
  height: number,
  sampleHFn: (x: number, y: number) => number,
): void
````

## File: packages/efx-physic-paint/src/util/color.ts
````typescript
export function hexRgb(hex: string): [number, number, number]
⋮----
export function rgbHex(r: number, g: number, b: number): string
⋮----
const clamp = (v: number): number
⋮----
export function rgb2hsl(r: number, g: number, b: number): [number, number, number]
⋮----
export function hsl2rgb(h: number, s: number, l: number): [number, number, number]
⋮----
export function rgb2ryb(hue: number): number
⋮----
export function ryb2rgb(hue: number): number
⋮----
export function mixSubtractive(
  c1: [number, number, number],
  c2: [number, number, number],
  ratio: number,
): [number, number, number]
````

## File: packages/efx-physic-paint/src/util/math.ts
````typescript
import type { PenPoint } from '../types'
⋮----
export function gauss(mean: number = 0, stddev: number = 1): number
⋮----
export function lerp(a: number, b: number, t: number): number
⋮----
export function dist(
  a: { x: number; y: number } | [number, number],
  b: { x: number; y: number } | [number, number],
): number
⋮----
export function distXY(a:
⋮----
export function clamp(v: number, lo: number, hi: number): number
⋮----
export function curveBounds(
  curve: Array<{ x: number; y: number }>,
  radius: number,
  canvasW: number = 1000,
  canvasH: number = 650,
):
⋮----
export function polyBounds(
  pts: Array<[number, number]>,
):
⋮----
export function lerpPt(a: PenPoint, b: PenPoint, t: number): PenPoint
````

## File: packages/efx-physic-paint/src/util/noise.ts
````typescript
function _dot(x1: number, y1: number, x2: number, y2: number): number
⋮----
function _fract(x: number): number
⋮----
function _rand(x: number, y: number): number
⋮----
export function noise(px: number, py: number): number
⋮----
export function fbm(x: number, y: number, octaves: number = 3): number
````

## File: packages/efx-physic-paint/src/index.ts
````typescript

````

## File: packages/efx-physic-paint/src/preact.tsx
````typescript
import { useRef, useEffect } from 'preact/hooks'
import type { FunctionalComponent } from 'preact'
import { EfxPaintEngine } from './engine/EfxPaintEngine'
import type { EngineConfig } from './types'
⋮----
export interface EfxPaintCanvasProps extends EngineConfig {
  width?: number
  height?: number
  class?: string
  onEngineReady?: (engine: EfxPaintEngine) => void
}
⋮----
export const EfxPaintCanvas: FunctionalComponent<EfxPaintCanvasProps> = (props) =>
````

## File: packages/efx-physic-paint/src/types.ts
````typescript
export interface PaperConfig {
  name: string
  url: string
}
⋮----
export interface EngineConfig {
  width?: number
  height?: number
  papers: PaperConfig[]
  defaultPaper?: string
}
⋮----
export type ToolType = 'paint' | 'erase'
⋮----
export interface BrushOpts {
  size: number
  opacity: number
  pressure: number
  waterAmount: number
  dryAmount: number
  edgeDetail: number
  pickup: number
  eraseStrength: number
  antiAlias: number
}
⋮----
export interface PenPoint {
  x: number
  y: number
  p: number
  tx: number
  ty: number
  tw: number
  spd: number
}
⋮----
export type BgMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo'
⋮----
export interface WetBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array
  wetness: Float32Array
  strokeOpacity: Float32Array
}
⋮----
export interface SavedWetBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array
  strokeOpacity: Float32Array
}
⋮----
export interface TmpBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array
}
⋮----
export interface ColorMap {
  r: Float32Array
  g: Float32Array
  b: Float32Array
}
⋮----
export interface DiffusionParams {
  physicsStrength: number
  blowDX: Float32Array
  blowDY: Float32Array
}
⋮----
export interface FluidBuffers {
  u: Float32Array
  v: Float32Array
  u0: Float32Array
  v0: Float32Array
  p: Float32Array
  div: Float32Array
  wetMask: Float32Array
  blurMask: Float32Array
}
⋮----
export interface FluidConfig {
  viscosity: number
  omega_h: number
  darkening: number
}
⋮----
export interface DryingLUT {
  dryLUT: Float32Array
  invLUT: Float32Array
  dryPos: Float32Array
}
⋮----
export interface PaintStroke {
  tool: ToolType
  points: PenPoint[]
  color: string | null
  params: BrushOpts
  timestamp: number
  diffusionFrames?: number
}
⋮----
export interface SerializedProject {
  version: 2
  width: number
  height: number
  strokes: Array<{
    tool: string
    pts: Array<[number, number, number, number, number, number, number]>
    color: string | null
    params: Record<string, number>
    time: number
    diffusionFrames?: number
  }>
  settings: {
    bgMode: string
    paperGrain: string
    embossStrength: number
    wetPaper: boolean
  }
}
⋮----
export interface EngineState {
  width: number
  height: number
  tool: ToolType
  bgMode: BgMode
  embossStrength: number
  embossStack: number
  wetPaper: boolean
  drawing: boolean
  brushOpts: BrushOpts
  drySpeed: number
  physicsStrength: number
  physicsRunning: boolean
  physicsMode: 'local' | 'last' | 'all' | null
  localSpreadStrength: number
  hasPenInput: boolean
  diffusionFramesSinceLastStroke: number
}
````

## File: packages/efx-physic-paint/package.json
````json
{
  "name": "@efxlab/efx-physic-paint",
  "version": "0.1.0",
  "license": "GPL-2.0-only",
  "description": "Natural-media paint simulation with wet/dry physics, stable fluids, and paper texture interaction",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/efxlab/efx-motion-editor.git",
    "directory": "packages/efx-physic-paint"
  },
  "author": "Laurent Marques <laurentefx@icloud.com>",
  "homepage": "https://github.com/efxlab/efx-physic-paint#readme",
  "bugs": {
    "url": "https://github.com/efxlab/efx-physic-paint/issues"
  },
  "keywords": ["physics", "paint", "simulation", "canvas", "webgl"],
  "publishConfig": {
    "access": "public"
  },
  "type": "module",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./preact": {
      "types": "./dist/preact.d.ts",
      "import": "./dist/preact.mjs"
    },
    "./animation": {
      "types": "./dist/animation.d.ts",
      "import": "./dist/animation.mjs"
    }
  },
  "files": [
    "dist"
  ],
  "peerDependencies": {
    "preact": ">=10.0.0"
  },
  "peerDependenciesMeta": {
    "preact": {
      "optional": true
    }
  },
  "scripts": {
    "build": "tsup",
    "dev:watch": "tsup --watch",
    "check": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "~5.9.3",
    "preact": "^10.29.0",
    "@types/node": "^24.12.0"
  }
}
````

## File: packages/efx-physic-paint/README.md
````markdown
# @efxlab/efx-physic-paint

A TypeScript library for natural-media paint simulation with wet/dry physics. Renders watercolor, ink, and oil-like strokes with paper texture interaction, flow fields, and transparency support.

Built on a Stam stable fluids solver with Beer-Lambert transparency, per-pixel Porter-Duff compositing, and a dual wet/dry layer system.

## Features

- Dual-layer wet/dry paint physics with stable fluids solver
- Paper texture interaction (height-based adsorption model)
- Flow field transport with height equalization and edge darkening
- Per-pixel stroke opacity with Porter-Duff compositing
- Subtractive RYB color mixing
- 9 brush types: paint, erase, water, smear, blend, blow, wet, dry, pressure
- Tablet/pen pressure support via PointerEvent
- Stroke recording and replay (AnimationPlayer)
- Zero runtime dependencies — 68KB ESM bundle

## Install

```bash
npm install @efxlab/efx-physic-paint
```

## Quick Start

```ts
import { EfxPaintEngine } from '@efxlab/efx-physic-paint'

const canvas = document.querySelector('canvas')!
const engine = new EfxPaintEngine(canvas, {
  width: 1000,
  height: 650,
  paperPath: '/img/paper_1.jpg',
})

engine.onEngineReady(() => {
  console.log('Ready to paint')
})
```

## Preact Component

```tsx
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'

function App() {
  return (
    <EfxPaintCanvas
      width={1000}
      height={650}
      paperPath="/img/paper_1.jpg"
      onEngine={(engine) => {
        engine.setTool('paint')
        engine.setBrushSize(20)
      }}
    />
  )
}
```

## Animation Player

```ts
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation'

const player = new AnimationPlayer(engine, {
  strokes: savedStrokes,
  onFrame: (frameIndex) => console.log(`Frame ${frameIndex}`),
  onComplete: () => console.log('Done'),
})
player.play()
```

## API

### `EfxPaintEngine`

| Method | Description |
|--------|-------------|
| `setTool(tool)` | Set active tool (`'paint'`, `'erase'`, `'water'`, `'smear'`, `'blend'`, `'blow'`, `'wet'`, `'dry'`, `'pressure'`) |
| `setBrushSize(size)` | Set brush radius in pixels |
| `setOpacity(value)` | Set brush opacity (0–1) |
| `setColorRGB(r, g, b)` | Set paint color |
| `setWaterAmount(value)` | Set water amount for wet brushes |
| `setDryAmount(value)` | Set drying rate |
| `clearCanvas()` | Clear all paint layers |
| `getStrokes()` | Get recorded stroke data |
| `loadProject(data)` | Load a serialized project |
| `saveProject()` | Serialize current state |
| `onEngineReady(cb)` | Callback when engine is initialized |
| `destroy()` | Clean up resources |

## Development

```bash
pnpm install
pnpm dev        # Start demo app on localhost:5173
pnpm build      # Build library
pnpm check      # Type check
```

## License

GPL-2.0 — see [LICENSE](LICENSE)
````

## File: packages/efx-physic-paint/tsconfig.build.json
````json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/demo/**"]
}
````

## File: packages/efx-physic-paint/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2023", "DOM"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
````

## File: packages/efx-physic-paint/tsup.config.ts
````typescript
import { defineConfig } from 'tsup'
````

## File: CLAUDE.md
````markdown
Please find GSD tools from `.claude/get-shit-done` and not from `$HOME/.claude/get-shit-done`
Please do not run the server, I do on my side
````

## File: pnpm-workspace.yaml
````yaml
packages:
  - "app"
  - "packages/*"
````

## File: app/src/components/layout/LeftPanel.tsx
````typescript
import { useRef, useEffect } from 'preact/hooks';
import { ArrowLeft } from 'lucide-preact';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { uiStore } from '../../stores/uiStore';
import { imageStore } from '../../stores/imageStore';
import { CollapsibleSection } from '../sidebar/CollapsibleSection';
import { SidebarProperties } from '../sidebar/SidebarProperties';
import { SidebarFxProperties } from '../sidebar/SidebarFxProperties';
import { TransitionProperties } from '../sidebar/TransitionProperties';
import { AudioProperties } from '../sidebar/AudioProperties';
import { PaintProperties } from '../sidebar/PaintProperties';
import { audioStore } from '../../stores/audioStore';
import { paintStore } from '../../stores/paintStore';
import { SequenceList } from '../sequence/SequenceList';
import { LayerList } from '../layer/LayerList';
import { AddLayerMenu } from '../layer/AddLayerMenu';
import { PanelResizer } from '../sidebar/PanelResizer';
import { SidebarScrollArea } from '../sidebar/SidebarScrollArea';
import { calcFlexResize2 } from '../../lib/panelResize';
import { setPanelFlex } from '../../lib/appConfig';
import { assetUrl } from '../../lib/ipc';
import { isFxLayer } from '../../types/layer';
import { isKeySolid, isKeyTransparent } from '../../types/sequence';
⋮----
const handleSeqPropResize = (deltaY: number) =>
⋮----
const persistFlex = () =>
⋮----
const handleSeqCollapse = (collapsed: boolean) =>
⋮----
const handlePropCollapse = (collapsed: boolean) =>
````

## File: app/src/components/overlay/PaintToolbar.tsx
````typescript
import {useState} from 'preact/hooks';
import {Pen, Eraser, Pipette, PaintBucket, Minus, Square, Circle, MousePointer2, Eye, EyeOff, PenTool, Spline} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {layerStore} from '../../stores/layerStore';
import {pushAction} from '../../lib/history';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import type {PaintToolType, PaintStroke} from '../../types/paint';
⋮----
const applyColorToSelected = (color: string, andRefreshFx = false) =>
⋮----
onClick=
⋮----
onClose=
````

## File: app/src/components/sidebar/StrokeList.tsx
````typescript
import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import Sortable from 'sortablejs';
import {GripVertical, Eye, EyeOff, X, PenTool} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {CollapsibleSection} from './CollapsibleSection';
import type {PaintElement} from '../../types/paint';
⋮----
interface StrokeListProps {
  layerId: string;
}
⋮----
function getElementLabel(el: PaintElement, index: number): string
⋮----
onEnd(evt)
⋮----
const handleSelect = (elementId: string, displayIndex: number, e: MouseEvent) =>
⋮----
const handleToggleVisibility = (elementId: string) =>
⋮----
const handleDelete = (elementId: string) =>
⋮----
const handleEditPath = (elementId: string) =>
⋮----
onMouseLeave=
⋮----
onClick=
⋮----
e.stopPropagation();
handleEditPath(el.id);
````

## File: app/src/components/timeline/AddFxMenu.tsx
````typescript
import {useState, useEffect, useRef} from 'preact/hooks';
import {Clapperboard, Sparkles} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {paintStore} from '../../stores/paintStore';
import {uiStore} from '../../stores/uiStore';
import {isolationStore} from '../../stores/isolationStore';
import {timelineStore} from '../../stores/timelineStore';
import {capturePreviewCanvas} from '../../lib/shaderPreviewCapture';
import {defaultTransform, createDefaultFxSource} from '../../types/layer';
import type {LayerType, BlendMode, Layer, LayerSourceData} from '../../types/layer';
import {totalFrames, trackLayouts} from '../../lib/frameMap';
⋮----
export function AddLayerMenu()
⋮----
function handleClick(e: MouseEvent)
⋮----
const handleAddFxLayer = (type: LayerType, name: string, defaultBlend: BlendMode = 'normal') =>
⋮----
const handleAddContentLayer = (type: 'static-image' | 'image-sequence' | 'video') =>
⋮----
const handleShaderBrowser = () =>
⋮----
const handleAddPaintLayer = () =>
````

## File: app/src/lib/brushP5Adapter.ts
````typescript
import type {PaintStroke} from '../types/paint';
⋮----
function compensatedWeight(brushName: string, diameter: number): number
⋮----
function mapPressure(p: number): number
⋮----
function strokeSeed(id: string): number
⋮----
function ensureInitialized(width: number, height: number): boolean
⋮----
function grainWeightModifier(params:
⋮----
function renderStrokeWithParams(
  brushName: string,
  stroke: PaintStroke,
  pts: [number, number, number][],
  params: { grain?: number; scatter?: number; edgeDarken?: number },
): void
⋮----
function preparePoints(
  raw: [number, number, number][],
  halfW: number,
  halfH: number,
  maxControlPoints: number,
): [number, number, number][]
⋮----
export function renderStyledStrokes(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null
⋮----
function renderWatercolorStroke(
  stroke: PaintStroke,
  pts: [number, number, number][],
): void
⋮----
export function renderFrameFx(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null
⋮----
type StrokeGroup = { isWatercolor: boolean; strokes: PaintStroke[] };
⋮----
export function disposeBrushFx(): void
````

## File: app/src/lib/strokeAnimation.ts
````typescript
import type { PaintStroke } from '../types/paint';
⋮----
export function distributeStrokeBySpeed(
  stroke: PaintStroke,
  targetFrameCount: number,
): PaintStroke[]
````

## File: app/src/stores/projectStore.ts
````typescript
import {signal, computed, batch} from '@preact/signals';
import type {ProjectData, MceProject, MceSequence, MceKeyPhoto, MceLayer} from '../types/project';
import type {MceAudioTrack} from '../types/audio';
import type {AudioTrack, FadeCurve} from '../types/audio';
import type {Sequence, KeyPhoto, TransitionType, FadeMode} from '../types/sequence';
import type {Layer, LayerType, BlendMode, LayerSourceData, EasingType} from '../types/layer';
import {createBaseLayer} from '../types/layer';
import {projectCreate, projectSave as ipcProjectSave, projectOpen as ipcProjectOpen, projectMigrateTempImages} from '../lib/ipc';
import {imageStore, _setImageMarkDirtyCallback} from './imageStore';
import {sequenceStore, _setMarkDirtyCallback} from './sequenceStore';
import {audioStore, _setAudioMarkDirtyCallback} from './audioStore';
import {uiStore} from './uiStore';
import {timelineStore} from './timelineStore';
import {layerStore} from './layerStore';
import {historyStore} from './historyStore';
import {playbackEngine} from '../lib/playbackEngine';
import {audioEngine} from '../lib/audioEngine';
import {computeWaveformPeaks} from '../lib/audioWaveform';
import {audioPeaksCache} from '../lib/audioPeaksCache';
import {startAutoSave, stopAutoSave} from '../lib/autoSave';
import {tempProjectDir} from '../lib/projectDir';
import {addRecentProject, setLastProjectPath} from '../lib/appConfig';
import {canvasStore} from './canvasStore';
import {paintStore, _setPaintMarkDirtyCallback} from './paintStore';
import {motionBlurStore} from './motionBlurStore';
import {exportStore} from './exportStore';
import {savePaintData, loadPaintData, cleanupOrphanedPaintFiles} from '../lib/paintPersistence';
import {readFile} from '@tauri-apps/plugin-fs';
⋮----
function buildMceProject(): MceProject
⋮----
// Convert sequences to MceSequence format
⋮----
// Content layer fields (existing)
⋮----
// Generator-grain
⋮----
function hydrateFromMce(project: MceProject, projectRoot: string)
⋮----
setName(v: string)
setFps(v: number)
setResolution(w: number, h: number)
⋮----
loadFromData(data: ProjectData)
⋮----
markDirty()
⋮----
async createProject(projectName: string, projectFps: number, projectDirPath: string)
⋮----
async saveProject()
⋮----
async saveProjectAs(newFilePath: string)
⋮----
async openProject(openFilePath: string)
⋮----
closeProject()
⋮----
reset()
````

## File: app/src/types/layer.ts
````typescript
export type LayerType =
  | 'static-image'
  | 'image-sequence'
  | 'video'
  | 'generator-grain'
  | 'generator-particles'
  | 'generator-lines'
  | 'generator-dots'
  | 'generator-vignette'
  | 'generator-glsl'
  | 'adjustment-color-grade'
  | 'adjustment-blur'
  | 'adjustment-glsl'
  | 'paint';
⋮----
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
⋮----
export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  | { type: 'image-sequence'; imageIds: string[] }
  | { type: 'video'; videoAssetId: string }
  | { type: 'generator-grain'; density: number; size: number; intensity: number; lockSeed: boolean; seed: number }
  | { type: 'generator-particles'; count: number; speed: number; sizeMin: number; sizeMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-lines'; count: number; thickness: number; lengthMin: number; lengthMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-dots'; count: number; sizeMin: number; sizeMax: number; speed: number; lockSeed: boolean; seed: number }
  | { type: 'generator-vignette'; size: number; softness: number; intensity: number }
  | { type: 'adjustment-color-grade'; brightness: number; contrast: number; saturation: number; hue: number; fade: number; tintColor: string; preset: string; fadeBlend?: string }
  | { type: 'adjustment-blur'; radius: number }
  | { type: 'generator-glsl'; shaderId: string; params: Record<string, number> }
  | { type: 'adjustment-glsl'; shaderId: string; params: Record<string, number> }
  | { type: 'paint'; layerId: string };
⋮----
export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSourceData;
  isBase?: boolean;
  blur?: number;
  paintBgColor?: string;
  keyframes?: Keyframe[];
}
⋮----
export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
}
⋮----
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
⋮----
export interface KeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  blur: number;
  sourceOverrides?: Record<string, number>;
}
⋮----
export interface Keyframe {
  frame: number;
  easing: EasingType;
  values: KeyframeValues;
}
⋮----
export function defaultTransform(): LayerTransform
⋮----
export function createBaseLayer(): Layer
⋮----
export function extractFxSourceValues(layer: Layer): Record<string, number>
⋮----
export function extractKeyframeValues(layer: Layer): KeyframeValues
⋮----
export function isGeneratorLayer(layer: Layer): boolean
⋮----
export function isAdjustmentLayer(layer: Layer): boolean
⋮----
export function isFxLayer(layer: Layer): boolean
⋮----
export function createDefaultFxSource(type: LayerType): LayerSourceData
````

## File: app/src/types/project.ts
````typescript
import type {MceAudioTrack} from './audio';
⋮----
export interface ProjectData {
  name: string;
  fps: number;
  width: number;
  height: number;
}
⋮----
export interface MceProject {
  version: number;
  name: string;
  fps: number;
  width: number;
  height: number;
  created_at: string;
  modified_at: string;
  sequences: MceSequence[];
  images: MceImageRef[];
  audio_tracks?: MceAudioTrack[];
  motion_blur?: {
    enabled: boolean;
    shutter_angle: number;
    preview_quality: string;
    export_sub_frames: number;
  };
}
⋮----
export interface MceSequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  order: number;
  key_photos: MceKeyPhoto[];
  layers?: MceLayer[];
  kind?: string;
  in_frame?: number;
  out_frame?: number;
  fade_in?: MceTransition;
  fade_out?: MceTransition;
  cross_dissolve?: MceTransition;
}
⋮----
export interface MceLayer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  blend_mode: string;
  transform: MceLayerTransform;
  source: MceLayerSource;
  is_base: boolean;
  order: number;
  blur?: number;
  paint_bg_color?: string;
  keyframes?: MceKeyframe[];
}
⋮----
export interface MceLayerTransform {
  x: number;
  y: number;
  scale_x: number;
  scale_y: number;
  scale?: number;
  rotation: number;
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
}
⋮----
export interface MceLayerSource {
  type: string;
  image_id?: string;
  image_ids?: string[];
  video_path?: string;
  video_asset_id?: string;
  lock_seed?: boolean;
  seed?: number;
  density?: number;
  size?: number;
  intensity?: number;
  count?: number;
  speed?: number;
  size_min?: number;
  size_max?: number;
  thickness?: number;
  length_min?: number;
  length_max?: number;
  softness?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  fade?: number;
  tint_color?: string;
  preset?: string;
  fade_blend?: string;
  radius?: number;
  shader_id?: string;
  params?: Record<string, number>;
  layer_id?: string;
}
⋮----
export interface MceTransition {
  type: string;
  duration: number;
  mode: string;
  color: string;
  curve: string;
}
⋮----
export interface MceKeyframe {
  frame: number;
  easing: string;
  values: MceKeyframeValues;
}
⋮----
export interface MceKeyframeValues {
  opacity: number;
  x: number;
  y: number;
  scale_x: number;
  scale_y: number;
  rotation: number;
  blur: number;
  source_overrides?: Record<string, number>;
}
⋮----
export interface MceGradientStop {
  color: string;
  position: number;
}
⋮----
export interface MceGradientData {
  type: string;
  stops: MceGradientStop[];
  angle?: number;
  center_x?: number;
  center_y?: number;
}
⋮----
export interface MceKeyPhoto {
  id: string;
  image_id: string;
  hold_frames: number;
  order: number;
  solid_color?: string;
  is_transparent?: boolean;
  gradient?: MceGradientData;
}
⋮----
export interface MceImageRef {
  id: string;
  original_filename: string;
  relative_path: string;
  thumbnail_relative_path: string;
  width: number;
  height: number;
  format: string;
}
````

## File: app/src/main.tsx
````typescript
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {startAutoSave} from './lib/autoSave';
import {mountShortcuts, handleSave, handleNewProject, handleOpenProject, handleCloseProject} from './lib/shortcuts';
import {undo, redo} from './lib/history';
import {canvasStore} from './stores/canvasStore';
import {uiStore} from './stores/uiStore';
import {timelineStore} from './stores/timelineStore';
import {paintStore} from './stores/paintStore';
````

## File: app/src-tauri/src/models/project.rs
````rust
pub struct ProjectData {
⋮----
pub struct MceProject {
⋮----
pub struct MceAudioTrack {
⋮----
pub struct MceSequence {
⋮----
pub struct MceTransition {
⋮----
pub struct MceGlTransition {
⋮----
pub struct MceLayer {
⋮----
fn default_scale() -> f64 {
⋮----
pub struct MceLayerTransform {
⋮----
pub struct MceLayerSource {
⋮----
pub struct MceKeyframe {
⋮----
pub struct MceKeyframeValues {
⋮----
pub struct MceGradientStop {
⋮----
pub struct MceGradientData {
⋮----
pub struct MceKeyPhoto {
⋮----
pub struct MceImageRef {
````

## File: .gitignore
````
# Dependencies
node_modules/

# Environment
.env
.env.*

# Caches
.cache/
*.tsbuildinfo

# Build output
app/dist/
packages/*/dist/

# Tauri
app/src-tauri/target/
app/src-tauri/gen/

# OS
.DS_Store

# Editor
*.swp
*.swo

.opencode
.Mockup
SPECS
.claude/pnpm-lock.yaml
.claude/projects/
.claude/worktrees/
repomix-output*.xml
````

## File: AGENTS.md
````markdown
# Main setup

- **Please find GSD tools from `.Codex/get-shit-done`** and not from `$HOME/.Codex/get-shit-done`
- **Please do not run the server** I do on my side

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session. Codex CLI does NOT have hooks, so these instructions are your ONLY enforcement mechanism. Follow them strictly.

## Think in Code — MANDATORY

When you need to analyze, count, filter, compare, search, parse, transform, or process data: **write code** that does the work via `ctx_execute(language, code)` and `console.log()` only the answer. Do NOT read raw data into context to process mentally. Your role is to PROGRAM the analysis, not to COMPUTE it. Write robust, pure JavaScript — no npm dependencies, only Node.js built-ins (`fs`, `path`, `child_process`). Always use `try/catch`, handle `null`/`undefined`, and ensure compatibility with both Node.js and Bun. One script replaces ten tool calls and saves 100x context.

## BLOCKED commands — do NOT use these

### curl / wget — FORBIDDEN
Do NOT use `curl` or `wget` in any shell command. They dump raw HTTP responses directly into your context window.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — FORBIDDEN
Do NOT run inline HTTP calls via `node -e "fetch(..."`, `python -c "requests.get(..."`, or similar patterns. They bypass the sandbox and flood context.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — FORBIDDEN
Do NOT use any direct URL fetching tool. Raw HTML can exceed 100 KB.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)
Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)
If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file stays in the sandbox.

### grep / search (large results)
Search results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls. Each command: `{label: "descriptive header", command: "..."}`. Label becomes FTS5 chunk title — descriptive labels improve search.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
| `ctx purge` | Call the `purge` MCP tool with confirm: true. Warns before wiping the knowledge base. |

After /clear or /compact: knowledge base and session stats are preserved. Use `ctx purge` if you want to start fresh.
````

## File: package.json
````json
{
  "private": true,
  "packageManager": "pnpm@10.27.0+sha512.72d699da16b1179c14ba9e64dc71c9a40988cbdc65c264cb0e489db7de917f20dcf4d64d8723625f2969ba52d4b7e2a1170682d9ac2a5dcaeaab732b7e16f04a",
  "scripts": {
    "dev": "pnpm --filter efx-motion-editor dev",
    "build": "pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build",
    "dev:paint": "pnpm --filter @efxlab/efx-physic-paint dev:watch",
    "repomix": "npx repomix@latest --config repomix.config.json --compress -o repomix-output.codex.xml",
    "repomix:check": "npx repomix@latest --config repomix.config.json --compress --top-files-len 20 --token-count-tree 1000 -o repomix-output.codex.xml",
    "repomix:full": "npx repomix@latest --config repomix.config.json -o repomix-output.full.xml",
    "repomix:full:split": "npx repomix@latest --config repomix.config.json --split-output 5mb -o repomix-output.full.xml",
    "repomix:skill:claude": "npx repomix@latest --config repomix.config.json --skill-generate repomix-reference-efx-motion-editor --skill-output .claude/skills/repomix-reference-efx-motion-editor --compress --force",
    "repomix:skill:codex": "npx repomix@latest --config repomix.config.json --skill-generate repomix-reference-efx-motion-editor --skill-output .agents/skills/repomix-reference-efx-motion-editor --compress --force",
    "repomix:skill": "npm run repomix:skill:claude && npm run repomix:skill:codex",
    "repomix:skill-remote": "npx repomix@latest --remote"
  },
  "pnpm": {
    "overrides": {
      "@efxlab/motion-canvas-core": "4.0.0",
      "preact": "^10.28.4",
      "@preact/signals": "^2.8.1"
    },
    "onlyBuiltDependencies": [
      "esbuild"
    ]
  }
}
````

## File: README.md
````markdown
# EFX Motion Editor

A macOS desktop application for creating **cinematic stop-motion films** from photography keyframes. Import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers with blend modes and keyframe animation, apply cinematic FX effects, add GLSL shader effects, paint and rotoscope frame-by-frame with a **3-mode paint system** (flat/FX/physical), **bezier path editing**, **inline color picker** with 4 modes, and **stroke draw-reveal animation**, apply **Hollywood-grade per-layer motion blur** with GLSL velocity shaders and sub-frame accumulation, import audio with waveforms, preview in real-time with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1).

<!-- Screenshot: Main editor view -->

## Features

### Key Photo Workflow

Import photos (JPEG, PNG, TIFF, HEIC) via drag & drop or file dialog, assign hold frame counts, and arrange into named sequences. Support for solid color, transparent, and gradient key entries alongside imported images. Collapsible key photo lists in the sidebar with click-to-toggle.

<!-- Screenshot: Key photo strip with solid/transparent entries -->

### Multi-Sequence Timeline

Create, reorder, duplicate, and rename sequences with per-sequence FPS (15 or 24) and resolution settings. Canvas-based timeline with zoom, scroll, thumbnail previews, and frame-accurate scrubbing.

<!-- Screenshot: Timeline with multiple sequences -->

### Layer System

Stack static images, image sequences, or video layers with opacity, blend modes (normal, screen, multiply, overlay, add), and transform controls (position, scale, rotation, crop). Live canvas manipulation with drag handles.

<!-- Screenshot: Layer compositing with transform handles -->

### Cinematic FX Effects

Built-in generator effects (film grain, particles, lines, dots, vignette) and adjustment effects (color grade with presets, GPU-accelerated blur). All effects have per-layer keyframe animation with interpolation curves.

<!-- Screenshot: FX effects panel -->

### GLSL Shader Library

17 GPU-powered shader effects ported from Shadertoy, organized in a visual browser with animated previews and real-time parameter controls.

**FX Image Shaders** — Process the image below with GPU filters:

| Shader | Description |
|--------|-------------|
| B&W Pixel Filter | Grayscale, monotone, and duotone modes with color pickers |
| Super Film Grain | 1920s film look with grain, scratches, dust, flicker, and vignette |
| Color Fusion | RGB channel cycling for chromatic persistence effects |
| Fast Blur | GPU disc blur with noise-rotated sampling (1-4 steps) |
| Color Temperature | Warm/cool white balance in perceptual ProPhoto RGB space |
| CRT Screen | Retro CRT with pixelation, barrel distortion, chromatic aberration |
| Filmora Shake | Camera shake with motion blur, rotation, and RGB separation |

**Generator Shaders** — Procedural animated content as timeline layers:

| Shader | Description |
|--------|-------------|
| Star Nest | Volumetric star field with dark matter and distance fading |
| Spiral Lit Clouds | Volumetric raymarched clouds through a twisting luminous tunnel |
| The Drive Home | Rainy night drive with bokeh traffic lights and rain drops |
| Clouds 3D Fly | Volumetric cloud flythrough with sun lighting and FBM noise |
| Sun with Stars | Volumetric sun with fractal nebula and twinkling star field |
| Neon Doodle Fuzz | Twin neon tubes weaving through space with fuzzy glow |
| Seascape | Realistic ocean with raymarched waves and sky reflections |
| Ocean Water | Multi-wave ocean simulation with ground and subsurface scattering |
| Indefinite | Abstract fractal cloud tunnel with warm volumetric glow |
| Zippy Zaps | Electric fractal lightning with vibrant color cycling |

The shader library is extensible — see [`src/lib/shaders/SHADER-SPEC.md`](app/src/lib/shaders/SHADER-SPEC.md) for how to add new shaders.

<!-- Screenshot: GLSL shader browser with animated previews -->

### Gradient Fills

Apply linear, radial, or conic gradient fills to solid key entries with 2–5 color stops. Drag-to-position gradient stops on a visual gradient bar, edit stop colors via HEX/RGBA/HSL inputs, and adjust angle or center point. Gradients render in the preview canvas, timeline thumbnails, and video export.

<!-- Screenshot: Gradient color picker with stop editor -->

### Fade & Cross-Dissolve Transitions

Fade in/out and cross-dissolve transitions between sequences with opacity and solid color modes.

### GL Shader Transitions

18 GPU-powered transition shaders ported from [gl-transitions.com](https://gl-transitions.com/), rendered via a dual-texture WebGL2 pipeline. Browse transitions with animated previews showing actual sequence content, quick-apply from the grid, or expand for parameter tuning. Swap shaders after applying without losing duration/curve settings.

| Transition | Description |
|-----------|-------------|
| Directional | Slide the scene in a configurable direction |
| Directional Wipe | Hard-edge wipe with configurable direction and smoothness |
| Wipe Left / Wipe Down | Clean axis-aligned wipe transitions |
| Dissolve | Random noise dissolve |
| Fade Color | Dissolve through a solid color intermediate |
| Fade Grayscale | Dissolve through grayscale intermediate |
| Swap | Two images swap positions with perspective and reflection |
| Window Slice | Venetian blinds slice transition |
| Slides | Multi-panel slide transition |
| Cross Zoom | Zoom blur cross-dissolve |
| Zoom In Circles | Circular reveal zoom pattern |
| Simple Zoom | Simple zoom-in transition |
| Cross Warp | Warped cross-dissolve |
| Cube | 3D cube rotation with reflection |
| Pixelize | Pixelation with configurable grid size |
| Dreamy | Dreamy blur dissolve |
| Glitch Memories | Glitch effect with chromatic aberration |

Transitions render in both the live preview and video export pipelines. Duration, easing curve, and per-shader parameters are editable in the sidebar. Project persistence via `.mce` v11 format.

<!-- Screenshot: GL transition browser with animated previews -->

### Audio Import & Waveform

Import WAV, MP3, AAC, or FLAC audio files. Audio waveform renders on the timeline below content tracks. Synced playback with volume, mute, drag offset, and fade in/out controls. Audio persists across project save/reopen.

<!-- Screenshot: Audio waveform on timeline -->

### Paint Layer / Rotopaint

Frame-by-frame drawing and rotoscoping directly on the canvas. Powered by a perfect-freehand brush engine for smooth, pressure-sensitive strokes. 8 tools: select, brush, eraser (path-based), eyedropper, flood fill, line, rectangle, and ellipse. Onion skinning overlay shows ghosted paint from adjacent frames with configurable range and opacity falloff. Paint data persists as sidecar JSON files alongside the project. Paint layers composite in both the live preview and video export pipelines with full blend mode and opacity support.

**3-Mode Paint System** — Each paint frame operates in one of three exclusive modes: **Flat** (perfect-freehand vector strokes), **FX** (p5.brush spectral pigment rendering), or **Physical** (placeholder for future efx-physic-paint engine). Mode conversion dialogs handle transitions between flat and FX with full undo support. Per-layer paint mode persists across sessions.

**Brush FX Styles** — Post-process FX workflow: draw flat strokes, select them, then apply artistic styles powered by [p5.brush](https://p5-brush.cargo.site/) with Kubelka-Munk spectral pigment mixing (blue + yellow = green, not gray). 6 brush styles: flat, watercolor, ink, charcoal, pencil, and marker. Per-style FX parameters (bleed, grain, scatter, field strength, edge darken) with real-time slider controls. Per-frame batch rendering ensures overlapping strokes get physically-correct spectral blending in a single GLSL pass.

**Inline Color Picker** — Canvas-adjacent color picker panel (260px) with 4 color modes: Box (SV square + hue slider), TSL (tint/shade/lightness sliders), RVB (red/green/blue sliders), and CMYK (cyan/magenta/yellow/key sliders). All sliders render live gradient backgrounds. HEX input with real-time sync, auto-apply on any interaction. Recent colors row (last 12) and persistent favorites (click to save, right-click to remove). Color changes apply instantly to brush and selected strokes.

**Circle Cursor** — Photoshop-style brush cursor shows a circle at the current brush pixel size, scaling with canvas zoom. Provides precise visual feedback for brush coverage during drawing.

**Wireframe Overlay** — Selected strokes display a visible wireframe/path overlay for easy identification and grab targeting. Works for both flat and FX strokes with distinct visual styles.

**Stroke Draw-Reveal Animation** — Distribute a selected stroke's points across a target frame range using speed-based distribution (slow drawing = more frames, fast = fewer). Creates hand-drawn reveal animations from existing strokes with single atomic undo.

**Select Tool** — Click to select strokes, Cmd/Ctrl+click for multi-select, Cmd+A to select all. Selected elements can be moved (drag), resized (corner/edge handles for uniform/non-uniform scale), rotated (rotate handle above bounding box with custom cursor), recolored, resized via slider, and reordered (To Back / Backward / Forward / To Front). Alt+drag to duplicate any selected stroke. Rotation works on all element types: brush strokes rotate point-by-point, geometry shapes (rect, ellipse) rotate visually via canvas transform with proper hit-testing. Apply or change FX styles on selected strokes with instant re-render. Toggle flat/FX preview with F key.

**Bezier Path Editing** — Convert freehand strokes to editable bezier curves with the pen tool. Drag anchor points and control handles to reshape stroke paths with real-time visual feedback. Add new control points by clicking on path segments, delete points with Backspace. Progressive simplify button reduces path complexity incrementally. Supports smooth and corner anchor types with handle breaking. All bezier edits support undo/redo with one entry per drag gesture. Edited anchors persist across project save/load via paint sidecar JSON.

**Paint Mode** — Sticky edit mode (P key or toolbar button) that locks focus to the paint layer. Canvas controls are replaced by a dedicated paint toolbar. Exit via ESC, P key, or orange pulsating "Exit Paint Mode" button. Sequence overlay (O key) shows reference frames underneath paint at configurable opacity. Copy strokes to next frame for animation workflows. Configurable solid paint background color. Brush color and size persist across sessions (default: #203769 at 35px).

**Stroke List Panel** — Dedicated panel within PaintProperties showing all strokes on the current frame. Drag to reorder strokes (updates canvas rendering order immediately), click to select (bidirectional sync with canvas selection), toggle visibility eye icon to hide/show individual strokes, delete with full undo/redo support. Multi-select via Cmd+click, auto-scrolls to keep selected strokes visible. S key activates select tool in paint mode (Alt+S toggles solo overlay).

**Tablet & Pen Support** — Native macOS tablet pressure bridge via NSEvent. Supports pen pressure sensitivity with easing/taper curves for natural brush dynamics, tilt detection, and coalesced touch events for high-resolution stroke capture at full tablet polling rate. Works with Wacom, Apple Pencil (iPad Sidecar), and other pressure-sensitive input devices.

<!-- Screenshot: Paint overlay with brush FX styles -->

### Per-Layer Motion Blur

Hollywood-quality per-layer directional motion blur with cinematographic shutter angle control. Each animated layer is individually blurred based on its velocity — fast-moving layers streak while stationary layers stay razor-sharp, just like a real film camera with a rotary disc shutter.

**Real-Time Preview** — WebGL2 GLSL directional blur shader runs per-layer in the preview pipeline. Configurable quality tiers (Low/16 samples, Medium/32 samples) for smooth playback. Toggle with `M` key or toolbar button, adjust shutter angle (0-360 degrees) and quality from the dropdown popover.

**Export with Sub-Frame Accumulation** — Export pipeline renders 8 to 128 sub-frames per output frame at fractional temporal positions, accumulates them in a Float32 buffer for mathematically perfect averaging, then applies GLSL velocity blur per sub-frame. The result is cinema-grade motion blur indistinguishable from footage shot on a physical camera. Export shutter angle can be overridden independently from preview settings.

**Velocity Intelligence** — Per-layer velocity cache tracks keyframe position deltas frame-to-frame with automatic seek invalidation. Layers below the motion threshold are skipped entirely — zero GPU cost for static elements. The velocity engine feeds both the preview GLSL shader and the export accumulation pipeline.

**Controls** — Toolbar toggle (Zap icon) with dropdown for shutter angle slider and quality selector. Export dialog with enable toggle, shutter angle override, and sample count selector (8/16/32/64/128). Keyboard shortcut `M` (guarded in paint mode). All settings persist in the `.mce` project file.

<!-- Screenshot: Motion blur preview with shutter angle popover -->

### Canvas Motion Path

After Effects-style spatial keyframe path editing directly on the canvas. Animated layers display their trajectory as a dotted trail with interactive keyframe markers. Drag keyframe positions on the canvas to reshape motion paths in real-time with auto-seek and undo coalescing.

<!-- Screenshot: Motion path with keyframe markers -->

### Keyframe Animation

Per-layer keyframe animation with 4 interpolation curves (linear, ease-in, ease-out, ease-in-out). Animate position, scale, rotation, opacity, blur, and FX parameters over time. Keyframe navigation and diamond editing in the sidebar.

<!-- Screenshot: Keyframe animation controls -->

### Media Management

Color-coded usage badges on imported assets showing usage counts across all sequences. Safe removal with cascade deletion and undo support. Right-click context menu for quick asset management.

<!-- Screenshot: Import grid with usage badges -->

### Video Export

Export as PNG image sequences with resolution multipliers, or encode video directly (ProRes/H.264/AV1) via auto-provisioned FFmpeg. Optional per-layer motion blur with up to 128 sub-frame accumulation samples for cinema-grade output. Export the full timeline or selected sequence only for fast iteration. Progress tracking with metadata sidecars.

<!-- Screenshot: Export dialog -->

### Canvas Preview

Real-time preview with zoom/pan, pinch gestures, fit-to-window, and fullscreen mode with letterboxed preview. Full-speed playback mode for performance testing.

<!-- Screenshot: Canvas preview with zoom -->

### UI Theme System

3-level UI theme (dark/medium/light) with 28+ CSS variables. DaVinci Resolve-inspired dark aesthetic throughout.

<!-- Screenshot: Theme comparison -->

### Professional Controls

- **JKL Shuttle Scrubbing** — Professional J/K/L shuttle controls with speed multiplier
- **Undo/Redo** — 200-level history stack with drag coalescing
- **Auto-Save** — Debounced (2s) + periodic (60s) auto-save with atomic writes
- **Keyboard Shortcuts** — Space, arrows, JKL, Cmd+Z/S/N/O, `?` overlay, and more
- **Global Solo Mode** — Strip all overlay layers and FX from preview/export with one click or `S` key
- **Sequence Isolation** — Solo mode and global loop playback toggle

## Canvas Motion Fork

This project uses [@efxlab/motion-canvas-*](https://www.npmjs.com/search?q=%40efxlab%2Fmotion-canvas) packages, a fork of [Motion Canvas](https://motioncanvas.io/). Currently used: core, 2d, vite-plugin, player, ui.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Preact, @preact/signals, TypeScript, Tailwind CSS v4 |
| Build | Vite 5 |
| Preview Engine | @efxlab/motion-canvas-* (fork), Canvas 2D compositing |
| GPU Effects | WebGL2 (GLSL shaders, GPU blur, per-layer motion blur) |
| Native Backend | Rust, Tauri 2.0 |
| Video Export | FFmpeg (auto-provisioned) |
| Paint Engine | @efxlab/efx-physic-paint (spectral pigment mixing via p5.brush), perfect-freehand (flat strokes), fit-curve + bezier-js (path editing) |
| Monorepo | pnpm workspaces, tsup (package builds) |
| Project Format | `.mce` v15 (progressive JSON with backward compat v1-v15) |

## Prerequisites

- macOS (native title bar, file dialogs, macOS conventions)
- [Rust](https://rustup.rs/) toolchain
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/efx-motion-editor.git
cd efx-motion-editor

# Install dependencies (from workspace root)
pnpm install

# Build the paint engine
pnpm --filter @efxlab/efx-physic-paint build

# Run in development mode
cd app
pnpm tauri dev
```

## Building for Production

```bash
cd app
pnpm tauri build
```

The built application will be available in `app/src-tauri/target/release/`.

## Project Structure

```
efx-motion-editor/                # pnpm workspace root
├── app/                          # Main Tauri application (formerly Application/)
│   ├── src/                      # Frontend (Preact + TypeScript)
│   │   ├── components/           # UI components
│   │   │   ├── layout/           # EditorShell, LeftPanel, TimelinePanel, CanvasArea
│   │   │   ├── timeline/         # TimelineCanvas, TimelineRenderer, AddFxMenu
│   │   │   ├── sidebar/          # Properties panels, FX controls, keyframe nav
│   │   │   ├── shader-browser/   # GLSL shader browser window
│   │   │   ├── overlay/          # Shortcuts overlay, fullscreen
│   │   │   └── shared/           # NumericInput, ColorPickerModal, SectionLabel
│   │   ├── stores/               # Reactive state (13 Preact Signal stores)
│   │   ├── lib/                  # Core logic
│   │   │   ├── shaders/          # GLSL shader library
│   │   │   │   ├── generators/   # 10 procedural generator shaders
│   │   │   │   ├── fx-image/     # 7 image filter shaders
│   │   │   │   ├── transitions/  # 18 GL transition shaders
│   │   │   │   └── SHADER-SPEC.md
│   │   │   ├── glslRuntime.ts    # WebGL2 shader rendering engine
│   │   │   ├── shaderLibrary.ts  # Shader registry and types
│   │   │   ├── previewRenderer.ts   # Canvas 2D compositing engine
│   │   │   ├── exportRenderer.ts    # Export pipeline
│   │   │   ├── glBlur.ts         # GPU-accelerated Gaussian blur
│   │   │   ├── glMotionBlur.ts   # WebGL2 GLSL directional motion blur
│   │   │   ├── motionBlurEngine.ts  # Velocity computation & sub-frame accumulation
│   │   │   ├── fxGenerators.ts   # CPU FX generators (grain, particles, etc.)
│   │   │   ├── paintRenderer.ts     # Paint stroke/shape/fill renderer
│   │   │   ├── brushP5Adapter.ts    # p5.brush FX adapter (spectral mixing, multi-pass)
│   │   │   ├── paintFloodFill.ts    # Stack-based flood fill algorithm
│   │   │   ├── bezierPath.ts        # Bezier curve math (fit-curve conversion, sampling, editing)
│   │   │   ├── paintPersistence.ts  # Sidecar file I/O for paint data
│   │   │   ├── playbackEngine.ts    # rAF playback with delta accumulation
│   │   │   └── ...
│   │   ├── types/                # TypeScript type definitions
│   │   └── scenes/               # Motion Canvas preview scene
│   └── src-tauri/                # Native backend (Rust + Tauri 2.0)
│       └── src/
│           ├── commands/         # IPC command handlers
│           ├── models/           # Data structures (project format)
│           └── services/         # File I/O, image processing, thumbnails
├── packages/
│   └── efx-physic-paint/         # @efxlab/efx-physic-paint — spectral pigment mixing engine
│       ├── src/                  # Brush, core, engine, render, animation, util modules
│       ├── tsup.config.ts        # Build config (ESM + CJS)
│       └── package.json
├── package.json                  # Workspace root (scripts, overrides, packageManager)
├── pnpm-workspace.yaml           # Workspace definition (app, packages/*)
└── .planning/                    # GSD project planning
```

## License

This project is licensed under the GNU General Public License v2.0 — see [LICENSE](LICENSE) for details.
````

## File: app/src/components/canvas/PaintCursor.tsx
````typescript
import { paintStore } from '../../stores/paintStore';
⋮----
interface PaintCursorProps {
  screenX: number;
  screenY: number;
  zoom: number;
  visible: boolean;
}
⋮----
export function PaintCursor(
````

## File: app/src/lib/paintPersistence.ts
````typescript
import {readTextFile, writeTextFile, mkdir, exists, readDir, remove} from '@tauri-apps/plugin-fs';
import type {PaintFrame, PaintStroke} from '../types/paint';
import {paintStore} from '../stores/paintStore';
import {renderFrameFx} from './brushP5Adapter';
import {projectStore} from '../stores/projectStore';
⋮----
export async function savePaintData(projectDir: string): Promise<void>
⋮----
export async function loadPaintData(projectDir: string, layerIds: string[]): Promise<void>
⋮----
export async function cleanupOrphanedPaintFiles(projectDir: string, activeLayerIds: string[]): Promise<void>
⋮----
export async function getPaintLayerIds(projectDir: string): Promise<string[]>
````

## File: app/src/lib/previewRenderer.ts
````typescript
import type {Layer, BlendMode} from '../types/layer';
import {isGeneratorLayer, isAdjustmentLayer, isFxLayer} from '../types/layer';
import type {FrameEntry} from '../types/timeline';
import type {GradientData} from '../types/sequence';
import {imageStore} from '../stores/imageStore';
import {assetUrl} from './ipc';
import {drawGrain, drawParticles, drawLines, drawDots, drawVignette} from './fxGenerators';
import {applyColorGrade} from './fxColorGrade';
import type {ColorGradeParams} from './fxColorGrade';
import {applyBlur} from './fxBlur';
import {blurStore} from '../stores/blurStore';
import {renderGlslGenerator, renderGlslFxImage} from './glslRuntime';
import {getShaderById} from './shaderLibrary';
import {renderPaintFrameWithBg} from './paintRenderer';
import {paintStore} from '../stores/paintStore';
import {projectStore} from '../stores/projectStore';
import {applyMotionBlur} from './glMotionBlur';
import {motionBlurStore} from '../stores/motionBlurStore';
import {VelocityCache, isStationary} from './motionBlurEngine';
import {interpolateAt} from './keyframeEngine';
⋮----
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: GradientData,
  width: number,
  height: number,
): CanvasGradient
⋮----
function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation
⋮----
export class PreviewRenderer
⋮----
constructor(canvas: HTMLCanvasElement, sharedImageCache?: Map<string, HTMLImageElement>)
⋮----
cloneForCanvas(canvas: HTMLCanvasElement): PreviewRenderer
⋮----
renderFrame(
    layers: Layer[],
    frame: number,
    frames: FrameEntry[],
    fps: number,
    clearCanvas = true,
    sequenceOpacity = 1.0,
    globalFrame?: number,
): void
⋮----
private resolveLayerSource(
    layer: Layer,
    frame: number,
    frames: FrameEntry[],
    fps: number,
): CanvasImageSource | null
⋮----
isImageCached(imageId: string | undefined): boolean
⋮----
isImageFailed(imageId: string): boolean
⋮----
preloadImages(imageIds: string[]): void
⋮----
getImageSource(imageId: string): HTMLImageElement | null
⋮----
private resolveVideoSource(
    layer: Layer,
    frame: number,
    fps: number,
): HTMLVideoElement | null
⋮----
const readyHandler = () =>
⋮----
private drawGeneratorLayer(
    layer: Layer,
    logicalW: number,
    logicalH: number,
    frame: number,
    sequenceOpacity = 1.0,
): void
⋮----
private drawGeneratorToCtx(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    logicalW: number,
    logicalH: number,
    frame: number,
): void
⋮----
private drawAdjustmentLayer(
    layer: Layer,
    _logicalW: number,
    _logicalH: number,
    sequenceOpacity = 1.0,
): void
⋮----
private getBlurOffscreen(w: number, h: number):
⋮----
private applyBlurToCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    radius: number,
    w: number,
    h: number,
    preserveAlpha: boolean,
): void
⋮----
private drawLayerToOffscreen(
    source: CanvasImageSource,
    layer: Layer,
    offCtx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
): void
⋮----
private drawLayer(
    source: CanvasImageSource,
    layer: Layer,
    canvasW: number,
    canvasH: number,
    sequenceOpacity = 1.0,
): void
⋮----
private getSourceWidth(source: CanvasImageSource): number
⋮----
private getSourceHeight(source: CanvasImageSource): number
⋮----
dispose(): void
````

## File: repomix.config.json
````json
{
  "output": {
    "filePath": "repomix-output.xml",
    "style": "xml",
    "removeComments": true,
    "removeEmptyLines": true,
    "truncateBase64": true
  },
  "ignore": {
    "customPatterns": [
      "src-tauri/target/**",
      "src-tauri/icons/**",
      "dist/**",
      "**/node_modules/**",
      "**/dist/**",
      "coverage/**",
      ".planning/**",
      ".claude/**",
      ".codex/**",
      "RESEARCH/**",
      ".vscode/**",
      ".github/**",
      "SPECS/**",

      "**/*.woff2",
      "**/*.icns",
      "**/*.ico",
      "**/*.png",
      "**/*.pen",
      "**/*.jpg",
      "**/*.jpeg",
      "**/*.webp",
      "**/*.gif",
      "**/*.svg",
      "**/*.pdf",

      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "bun.lockb",

      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
      "**/__mocks__/**",

      "**/*.snap",
      "**/*.map",
      "**/*.log",

      "**/.next/**",
      "**/.turbo/**",
      "**/storybook-static/**",

      "LICENSE",
      "**/LICENSE",
      "**/LICENSE.md",

      "app/src/lib/shaders/**"
    ]
  }
}
````

## File: app/src/lib/paintPreferences.ts
````typescript
import { LazyStore } from '@tauri-apps/plugin-store';
⋮----
export interface BrushPreferences {
  color: string;
  size: number;
}
⋮----
export async function loadBrushPreferences(): Promise<BrushPreferences>
⋮----
export async function saveBrushColor(color: string): Promise<void>
⋮----
export async function saveBrushSize(size: number): Promise<void>
⋮----
export async function loadRecentColors(): Promise<string[]>
⋮----
export async function saveRecentColors(colors: string[]): Promise<void>
⋮----
export async function loadFavoriteColors(): Promise<string[]>
⋮----
export async function saveFavoriteColors(colors: string[]): Promise<void>
⋮----
export async function savePaintMode(mode: string): Promise<void>
⋮----
export async function loadPaintMode(): Promise<string>
````

## File: app/src/lib/paintRenderer.ts
````typescript
import {getStroke} from 'perfect-freehand';
import {floodFill, hexToRgba} from './paintFloodFill';
import {sampleBezierPath} from './bezierPath';
import type {PaintFrame, PaintElement, PaintStroke, PaintShape, PaintFill, PaintStrokeOptions} from '../types/paint';
import {paintStore} from '../stores/paintStore';
⋮----
export function strokeToPath(
  points: [number, number, number][],
  size: number,
  options: PaintStrokeOptions,
): Path2D | null
⋮----
const easing = (p: number)
⋮----
function renderStroke(ctx: CanvasRenderingContext2D, element: PaintStroke): void
⋮----
function renderShape(ctx: CanvasRenderingContext2D, element: PaintShape): void
⋮----
export function renderPaintFrame(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
): void
⋮----
export function renderPaintFrameWithBg(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
  layerId?: string,
  frameNum?: number,
  overrideBgColor?: string,
): void
⋮----
function renderFlatElements(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
): void
⋮----
function renderFill(ctx: CanvasRenderingContext2D, element: PaintFill, width: number, height: number): void
⋮----
function renderElement(ctx: CanvasRenderingContext2D, element: PaintElement, width: number, height: number): void
````

## File: app/src/types/paint.ts
````typescript
export type PaintToolType = 'brush' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rect' | 'ellipse' | 'select' | 'pen';
⋮----
export type StrokeFxState = 'flat' | 'fx-applied' | 'flattened';
⋮----
export type PaintMode = 'flat' | 'fx-paint';
⋮----
export type BrushStyle = 'flat' | 'watercolor' | 'ink' | 'charcoal' | 'pencil' | 'marker';
⋮----
export interface BrushFxParams {
  grain?: number;
  bleed?: number;
  scatter?: number;
  fieldStrength?: number;
  edgeDarken?: number;
}
⋮----
export interface BezierAnchor {
  x: number;
  y: number;
  pressure: number;
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
  cornerMode?: boolean;
}
⋮----
export interface PaintStroke {
  id: string;
  tool: 'brush' | 'eraser';
  points: [number, number, number][];
  color: string;
  opacity: number;
  size: number;
  options: PaintStrokeOptions;
  mode?: PaintMode;
  brushStyle?: BrushStyle;
  brushParams?: BrushFxParams;
  fxState?: StrokeFxState;
  visible?: boolean;
  anchors?: BezierAnchor[];
  closedPath?: boolean;
}
⋮----
export interface PaintStrokeOptions {
  thinning: number;
  smoothing: number;
  streamline: number;
  simulatePressure: boolean;
  pressureEasing: string;
  pressureCurve: number;
  taperStart: number;
  taperEnd: number;
  tiltInfluence: number;
}
⋮----
export interface PaintShape {
  id: string;
  tool: 'line' | 'rect' | 'ellipse';
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  opacity: number;
  strokeWidth: number;
  filled: boolean;
  rotation?: number;
  visible?: boolean;
}
⋮----
export interface PaintFill {
  id: string;
  tool: 'fill';
  x: number; y: number;
  color: string;
  opacity: number;
  tolerance: number;
  visible?: boolean;
}
⋮----
export type PaintElement = PaintStroke | PaintShape | PaintFill;
⋮----
export interface PaintFrame {
  elements: PaintElement[];
  bgColor?: string;
}
````

## File: app/src/components/sidebar/PaintModeSelector.tsx
````typescript
import {useState} from 'preact/hooks';
import {Film, Spline} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import type {PaintStroke, BrushStyle} from '../../types/paint';
import {DEFAULT_BRUSH_FX_PARAMS} from '../../types/paint';
⋮----
function convertFrameStrokes(
  layerId: string,
  targetFrame: number,
  targetStyle: BrushStyle,
): void
⋮----
export function handleConvertToFx(selectedFxStyle: BrushStyle): void
⋮----
function convertFxStrokes(targetStyle: BrushStyle, scope: 'frame' | 'all' | 'selected'): void
⋮----
export function handleConvertToFlat(): void
⋮----
onClick=
⋮----
convertFxStrokes(style, effectiveScope);
````

## File: app/src/components/sidebar/SidebarProperties.tsx
````typescript
import { useEffect } from 'preact/hooks';
import { ChevronDown, ArrowRight, Paintbrush } from 'lucide-preact';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { KeyframeNavBar } from './KeyframeNavBar';
import { InlineInterpolation } from './InlineInterpolation';
import { paintStore } from '../../stores/paintStore';
import { layerStore } from '../../stores/layerStore';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { blurStore } from '../../stores/blurStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore } from '../../stores/uiStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isFxLayer } from '../../types/layer';
import type { Layer, BlendMode, KeyframeValues } from '../../types/layer';
⋮----
function capitalize(s: string): string
⋮----
export function SidebarProperties(
⋮----
const updateTransform = (field: string, value: number) =>
⋮----
onInput=
⋮----
startCoalescing();
````

## File: app/src/components/sidebar/InlineColorPicker.tsx
````typescript
import {useState, useEffect, useRef, useCallback} from 'preact/hooks';
import {X, Plus} from 'lucide-preact';
import {
  hexToRgba, rgbaToHex, rgbToHsl, hslToRgb,
  rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb,
} from '../../lib/colorUtils';
import {loadRecentColors, saveRecentColors, loadFavoriteColors, saveFavoriteColors} from '../../lib/paintPreferences';
⋮----
type ColorMode = 'Box' | 'TSL' | 'RVB' | 'CMYK';
⋮----
export interface InlineColorPickerProps {
  color: string;
  opacity: number;
  onChange: (color: string, opacity: number) => void;
  onClose: () => void;
}
⋮----
const handleKey = (e: KeyboardEvent) =>
⋮----
const modeButtonClass = (m: ColorMode)
⋮----
const renderSlider = (label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, unit?: string, gradient?: string) => (
    <div class="flex items-center gap-2">
      <span class="text-[9px] w-5 shrink-0" style={{color: 'var(--sidebar-text-secondary)', fontWeight: 500}}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        class={`flex-1 min-w-0 cursor-pointer${gradient ? ' color-slider-gradient' : ' h-1'}`}
        style={{
          ...(gradient ? { background: gradient, borderRadius: '4px', WebkitAppearance: 'none' as any, height: '8px' } : { accentColor: 'var(--color-accent)' }),
        }}
onInput=
⋮----
onClick=
⋮----
const setFromTsl = (h360: number, s100: number, l100: number) =>
⋮----
const setFromCmyk = (c: number, m: number, y: number, k: number) =>
⋮----
onPointerDown=
⋮----
<button key=
⋮----
````

## File: app/src/components/canvas/PaintOverlay.tsx
````typescript
import {useRef, useEffect, useState} from 'preact/hooks';
import type {RefObject} from 'preact';
import {listen} from '@tauri-apps/api/event';
import {paintStore} from '../../stores/paintStore';
import {canvasStore} from '../../stores/canvasStore';
import {PaintCursor} from './PaintCursor';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {clientToCanvas} from './coordinateMapper';
import {strokeToPath, renderPaintFrame} from '../../lib/paintRenderer';
import {renderFrameFx} from '../../lib/brushP5Adapter';
import {floodFill, hexToRgba} from '../../lib/paintFloodFill';
import {pushAction} from '../../lib/history';
import type {PaintStroke, PaintShape, PaintFill, PaintElement, PaintToolType, StrokeFxState, PaintFrame, BezierAnchor} from '../../types/paint';
import {
  hitTestAnchor, findNearestSegment, insertAnchorOnSegment,
  deleteAnchor, updateCoupledHandle, dragSegment,
} from '../../lib/bezierPath';
⋮----
interface PaintOverlayProps {
  containerRef: RefObject<HTMLDivElement>;
  isSpaceHeld: RefObject<boolean>;
  onPanStart: (e: PointerEvent) => void;
}
⋮----
function cursorForTool(tool: PaintToolType): string
⋮----
function findElementAtPoint(
  paintFrame: PaintFrame,
  x: number,
  y: number,
): string | null
⋮----
function getSelectionBounds(
  paintFrame: PaintFrame,
  selected: Set<string>,
):
⋮----
function hitTestHandle(
  x: number, y: number,
  bounds: {minX: number; minY: number; maxX: number; maxY: number},
  zoom: number,
): string | null
⋮----
function cursorForHandle(handleName: string): string
⋮----
function captureElementSnapshot(
  elements: PaintElement[],
  ids: Set<string>,
): Map<string, PaintElement>
⋮----
function restoreElementSnapshot(
  elements: PaintElement[],
  snapshot: Map<string, PaintElement>,
): void
⋮----
function reRenderFrameFx(
  paintFrame: PaintFrame,
  layerId: string,
  frame: number,
  width: number,
  height: number,
): void
⋮----
function rgbaToHex(r: number, g: number, b: number): string
⋮----
/** Render a thin dashed wireframe path overlay for a selected FX stroke (D-35).
 * FX strokes render with artistic effects (watercolor bleed, ink spread) making the
 * actual rendered area unpredictable. This wireframe gives users a clear selection target. */
function renderFxWireframe(ctx: CanvasRenderingContext2D, stroke: PaintStroke, zoom: number): void
⋮----
ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';  // light blue wireframe
ctx.lineWidth = 1.5 / zoom;  // constant screen-space width
ctx.setLineDash([4 / zoom, 4 / zoom]);  // dashed line
⋮----
// Use anchors if available (bezier path), otherwise use raw points
⋮----
/** Render a dashed bounding box rectangle around a selected FX stroke (D-35). */
function renderFxStrokeBounds(ctx: CanvasRenderingContext2D, stroke: PaintStroke, zoom: number): void
⋮----
const pad = 8 / zoom;  // padding around bounds
⋮----
/** Draw bezier editing overlay: path line, handle lines/dots, anchor squares (D-09) */
function drawBezierOverlay(
  ctx: CanvasRenderingContext2D,
  anchors: BezierAnchor[],
  selectedAnchorIdx: number | null,
  zoom: number,
  closedPath: boolean = false,
): void
⋮----
// Draw path segments (thin blue line)
⋮----
// --- Refs for select-mode drag ---
⋮----
// --- Refs for path-based eraser ---
⋮----
// --- Refs for stroke transform (resize/rotate) ---
⋮----
const transformCorner = useRef<string>('');  // 'tl','tr','bl','br'
⋮----
// --- Refs for non-uniform edge scale (D-04, D-05) ---
const edgeAnchorX = useRef(0);            // fixed X coordinate of opposite edge
const edgeAnchorY = useRef(0);            // fixed Y coordinate of opposite edge
const edgeOriginalWidth = useRef(1);      // original dimension for scale ratio
⋮----
// --- Ref for Alt+drag duplicate (D-01) ---
⋮----
// --- Pen tool state refs (Phase 25 Plan 03) ---
⋮----
function isNativePenActive(): boolean
⋮----
function getProjectPointFromEvent(ev:
⋮----
function getProjectPoint(e: PointerEvent)
⋮----
function getCoalescedPoints(e: PointerEvent): Array<
⋮----
function getSelectedPaintLayerId(): string | null
⋮----
function renderLivePreview()
⋮----
function requestPreview()
⋮----
function syncStyleToSelection()
⋮----
function handleSelectPointerDown(e: PointerEvent)
⋮----
function handlePointerDown(e: PointerEvent)
⋮----
function handlePointerMove(e: PointerEvent)
⋮----
function handlePointerUp(e: PointerEvent)
⋮----
// Reset tilt tracking
⋮----
// Clear temp canvas and re-render selection indicators if needed
⋮----
const handler = (e: KeyboardEvent) =>
⋮----
function handleDoubleClick(e: MouseEvent)
⋮----
onPointerLeave=
````

## File: app/src/components/sidebar/PaintProperties.tsx
````typescript
import {useState, useEffect} from 'preact/hooks';
import {ArrowRight, ChevronDown} from 'lucide-preact';
import {SectionLabel} from '../shared/SectionLabel';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {PaintModeSelector, FxBrushConvertBar} from './PaintModeSelector';
import {paintStore} from '../../stores/paintStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {fxTrackLayouts, trackLayouts} from '../../lib/frameMap';
import {pushAction} from '../../lib/history';
import {BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_PAINT_BG_COLOR, BRUSH_FX_VISIBLE_PARAMS} from '../../types/paint';
import type {PaintToolType, PaintStroke, PaintShape, PaintStrokeOptions, PaintElement} from '../../types/paint';
import type {Layer, BlendMode} from '../../types/layer';
import {StrokeList} from './StrokeList';
⋮----
function capitalize(s: string): string
⋮----
function shapeToBrushStrokes(shape: PaintShape, brushOptions: PaintStrokeOptions): PaintStroke[]
⋮----
const newId = ()
⋮----
const setBgColor = (c: string) =>
⋮----
onClick=
⋮----
const applyWidth = (newSize: number, andRefreshFx = false) =>
⋮----
const v = parseInt((e.target as HTMLInputElement).value, 10);
⋮----
const doReorder = (action: 'toBack' | 'backward' | 'forward' | 'toFront') =>
⋮----
const frame = timelineStore.currentFrame.peek();
const paintFrame = paintStore.getFrame(layerId, frame);
⋮----
for (const el of copiedElements)
⋮----
function getAnimationEndFrame(layerId: string, currentFrame: number, target: 'layer' | 'sequence'): number | null
⋮----
async function handleAnimate(target: 'layer' | 'sequence')
````

## File: app/src/stores/paintStore.ts
````typescript
import {signal, effect} from '@preact/signals';
import type {PaintElement, PaintFrame, PaintToolType, PaintStrokeOptions, BrushStyle, BrushFxParams, PaintStroke, PaintShape, PaintMode} from '../types/paint';
import {DEFAULT_BRUSH_SIZE, DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_OPACITY, DEFAULT_STROKE_OPTIONS, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_BRUSH_FX_PARAMS, DEFAULT_PAINT_BG_COLOR} from '../types/paint';
import {pointsToBezierAnchors, shapeToAnchors} from '../lib/bezierPath';
import {pushAction} from '../lib/history';
import {renderFrameFx} from '../lib/brushP5Adapter';
import {projectStore} from './projectStore';
⋮----
export function _setPaintMarkDirtyCallback(cb: () => void)
⋮----
function _getOrCreateFrame(layerId: string, frame: number): PaintFrame
⋮----
function _notifyVisualChange(layerId: string, frame: number): void
⋮----
async initFromPreferences(): Promise<void>
⋮----
getFrame(layerId: string, frame: number): PaintFrame | null
⋮----
getFrameNumbers(layerId: string): number[]
⋮----
setFrame(layerId: string, frame: number, pf: PaintFrame): void
⋮----
addElement(layerId: string, frame: number, element: PaintElement): void
⋮----
removeElement(layerId: string, frame: number, elementId: string): void
⋮----
moveElementsForward(layerId: string, frame: number, ids: Set<string>): void
⋮----
moveElementsBackward(layerId: string, frame: number, ids: Set<string>): void
⋮----
moveElementsToFront(layerId: string, frame: number, ids: Set<string>): void
⋮----
moveElementsToBack(layerId: string, frame: number, ids: Set<string>): void
⋮----
reorderElements(layerId: string, frame: number, oldIndex: number, newIndex: number): void
⋮----
setElementVisibility(layerId: string, frame: number, elementId: string, visible: boolean): void
⋮----
clearFrame(layerId: string, frame: number): void
⋮----
getLayerFrameNumbers(layerId: string): number[]
⋮----
removeLayer(layerId: string): void
⋮----
markDirty(layerId: string, frame: number): void
⋮----
getDirtyFrames(): Array<
⋮----
loadFrame(layerId: string, frame: number, pf: PaintFrame): void
⋮----
reset(): void
⋮----
togglePaintMode(): void
⋮----
toggleInlineColorPicker(): void
⋮----
setActivePaintMode(mode: PaintMode): void
⋮----
getFrameMode(layerId: string, frame: number): PaintMode | null
⋮----
setTool(tool: PaintToolType): void
⋮----
setBrushSize(size: number): void
⋮----
setBrushColor(color: string): void
⋮----
setBrushOpacity(opacity: number): void
⋮----
setTabletDetected(detected: boolean): void
⋮----
setBrushStyle(style: BrushStyle): void
⋮----
setBrushFxParams(params: BrushFxParams): void
⋮----
updateBrushFxParam(key: keyof BrushFxParams, value: number): void
⋮----
setPaintBgColor(color: string): void
⋮----
toggleFlatPreview(): void
⋮----
selectStroke(strokeId: string): void
⋮----
deselectStroke(strokeId: string): void
⋮----
clearSelection(): void
⋮----
toggleStrokeSelection(strokeId: string): void
⋮----
setFrameFxCache(layerId: string, frame: number, canvas: HTMLCanvasElement): void
⋮----
getFrameFxCache(layerId: string, frame: number): HTMLCanvasElement | null
⋮----
invalidateFrameFxCache(layerId: string, frame: number): void
⋮----
clearAllFrameFxCaches(): void
⋮----
flattenFrame(layerId: string, frame: number): void
⋮----
unflattenFrame(layerId: string, frame: number): void
⋮----
refreshFrameFx(layerId: string, frame: number): void
⋮----
_getOrCreateFrame(layerId: string, frame: number): PaintFrame
⋮----
_notifyVisualChange(layerId: string, frame: number): void
⋮----
convertToBezier(layerId: string, frame: number, elementId: string): void
⋮----
simplifyBezier(layerId: string, frame: number, elementId: string): number
⋮----
convertShapeToBezier(layerId: string, frame: number, elementId: string): void
````

## File: app/src/components/layout/CanvasArea.tsx
````typescript
import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {Plus, Minus, Maximize, Maximize2, Minimize2, Paintbrush} from 'lucide-preact';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {FullSpeedBadge} from '../overlay/FullSpeedBadge';
import {TransformOverlay} from '../canvas/TransformOverlay';
import {PaintOverlay} from '../canvas/PaintOverlay';
import {MotionPath} from '../canvas/MotionPath';
import {OnionSkinOverlay} from '../canvas/OnionSkinOverlay';
import {PaintToolbar} from '../overlay/PaintToolbar';
import {InlineColorPicker} from '../sidebar/InlineColorPicker';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {paintStore} from '../../stores/paintStore';
import {projectStore} from '../../stores/projectStore';
import {imageStore} from '../../stores/imageStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {playbackEngine, isFullSpeed} from '../../lib/playbackEngine';
import {isFullscreen, enterFullscreen} from '../../lib/fullscreenManager';
import {activeSequenceFrames} from '../../lib/frameMap';
import type {Layer} from '../../types/layer';
⋮----
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}
⋮----
function getSourceDimensionsForLayer(layer: Layer):
⋮----
const onKeyDown = (e: KeyboardEvent) =>
⋮----
const onKeyUp = (e: KeyboardEvent) =>
⋮----
const onGestureStart = (e: Event) =>
⋮----
const onGestureChange = (e: Event) =>
⋮----
onMouseLeave=
⋮----
onClick=
⋮----
onChange=
````
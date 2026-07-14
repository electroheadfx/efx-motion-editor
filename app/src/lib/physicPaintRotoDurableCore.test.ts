import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from '../stores/physicPaintStore';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../types/physicPaint';
import type { McePhysicPaintOutput, RuntimePhysicPaintOutput } from '../types/project';
import { useRotoKeyUtilities, type RotoKeyUtilities } from '../components/physic-paint/hooks/useRotoKeyUtilities';
import { PhysicsPaintWorkflowStrip } from '../components/physic-paint/view/PhysicsPaintWorkflowStrip';
import { buildBlankRotoFrame } from '../components/physic-paint/roto/rotoCanvasFrames';
import type { RotoSessionCopiedKey, RotoSessionEffect } from '../components/physic-paint/roto/physicsPaintRotoSession';
import type { RotoKeyUtilityTransaction } from '../components/physic-paint/roto/physicsPaintRotoKeyController';
import { saveRotoRealKeyTransaction } from '../components/physic-paint/roto/rotoKeyTransactions';
import { selectProjectedRealCachedRotoFrames, selectRotoTimelineView } from '../components/physic-paint/roto/rotoTimelineSelectors';
import { resolveRotoRealKeySaveTarget } from '../components/physic-paint/roto/rotoSourceDisplayModel';
import { projectRotoOnionPreviewFrames } from '../components/physic-paint/roto/rotoOnionPreview';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT, applyPhysicPaintPayload, createPhysicPaintLaunchContext } from './physicPaintBridge';
import { loadPhysicPaintData, savePhysicPaintData } from './physicPaintPersistence';

const fsMock = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  dirs: new Set<string>(),
}));

const paintHarness = vi.hoisted(() => ({
  engine: null as TestPaintEngine | null,
  storedLaunchContext: null as PhysicPaintLaunchContext | null,
  storedLaunchContextPromise: null as Promise<PhysicPaintLaunchContext | null> | null,
  launchListeners: [] as Array<(event: { payload: unknown }) => void>,
  engineReadyListeners: [] as Array<() => void>,
  browserBridgeReadyListeners: [] as Array<() => void>,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => fsMock.dirs.has(path) || fsMock.files.has(path)),
  mkdir: vi.fn(async (path: string) => { fsMock.dirs.add(path); }),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(fsMock.files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) fsMock.files.delete(key);
    }
    for (const key of Array.from(fsMock.dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) fsMock.dirs.delete(key);
    }
  }),
  readFile: vi.fn(async (path: string) => {
    const file = fsMock.files.get(path);
    if (!file) throw new Error(`missing file: ${path}`);
    return file;
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    fsMock.files.set(path, contents);
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    if (eventName === PHYSIC_PAINT_LAUNCH_EVENT) paintHarness.launchListeners.push(handler);
    return () => {
      paintHarness.launchListeners = paintHarness.launchListeners.filter((listener) => listener !== handler);
    };
  }),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => command === 'get_physics_paint_launch_context'
    ? paintHarness.storedLaunchContextPromise ?? paintHarness.storedLaunchContext
    : null),
  isTauri: vi.fn(() => false),
}));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({}),
}));
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async get() { return undefined; }
    async set() {}
  },
}));

vi.mock('@efxlab/efx-physic-paint/preact', async () => {
  const preact = await import('preact');
  const hooks = await import('preact/hooks');
  return {
    EfxPaintCanvas: (props: { width: number; height: number; children?: ComponentChildren; onEngineReady?: (engine: TestPaintEngine) => void; onNativePenInputReady?: (handler: (input: { pressure: number }) => void) => void }) => {
      const mountedEngine = paintHarness.engine;
      const [readyToEmit, setReadyToEmit] = hooks.useState(false);
      const [callbacksCommitted, setCallbacksCommitted] = hooks.useState(false);
      hooks.useEffect(() => {
        setReadyToEmit(true);
      }, []);
      hooks.useEffect(() => {
        if (!readyToEmit) return;
        if (!mountedEngine) throw new Error('test paint engine was not installed');
        props.onNativePenInputReady?.(() => {});
        props.onEngineReady?.(mountedEngine);
        setCallbacksCommitted(true);
      }, [readyToEmit]);
      hooks.useEffect(() => {
        if (!callbacksCommitted) return;
        const listeners = paintHarness.engineReadyListeners.splice(0);
        for (const listener of listeners) listener();
      }, [callbacksCommitted]);
      return preact.h('canvas', { width: props.width, height: props.height, class: 'paint-canvas' }, props.children);
    },
  };
});

vi.mock('@efxlab/efx-physic-paint/animation', () => ({
  AnimationPlayer: class {
    play() {}
    stop() {}
  },
}));

interface TestPaintEngine {
  save: () => SerializedProject;
  load: ReturnType<typeof vi.fn<(state: SerializedProject) => void>>;
  clear: ReturnType<typeof vi.fn<() => void>>;
  exportCompositeCanvas: () => { width: number; height: number; toDataURL: () => string };
  setBackgroundImageUrl: ReturnType<typeof vi.fn<(dataUrl: string) => void>>;
  resetBackground: ReturnType<typeof vi.fn<() => void>>;
  setPreviewBaseImageUrl: ReturnType<typeof vi.fn<(dataUrl: string) => void>>;
  clearPreviewBaseImage: ReturnType<typeof vi.fn<() => void>>;
  getStrokeCount: () => number;
  setTool: (...args: unknown[]) => void;
  setPhysicsMode: (...args: unknown[]) => void;
  setColorHex: (...args: unknown[]) => void;
  setBrushOpacity: (...args: unknown[]) => void;
  setBrushSize: (...args: unknown[]) => void;
  setBgMode: ReturnType<typeof vi.fn<(mode: string) => void>>;
  setPaperGrain: (...args: unknown[]) => void;
  setEmbossStrength: (...args: unknown[]) => void;
  setEdgeDetail: (...args: unknown[]) => void;
  setPickup: (...args: unknown[]) => void;
  setLocalSpreadStrength: (...args: unknown[]) => void;
  setAntiAlias: (...args: unknown[]) => void;
  setEraseStrength: (...args: unknown[]) => void;
  startPhysics: (...args: unknown[]) => void;
  stopPhysics: (...args: unknown[]) => void;
  forceDry: () => void;
  undo: () => void;
  __setState: (state: SerializedProject, dataUrl: string) => void;
}

const savedDataUrl = pngDataUrl('saved-roto-frame');
const unsavedDataUrl = pngDataUrl('unsaved-roto-frame');

const editableState = {
  version: 2 as const,
  width: 1000,
  height: 650,
  strokes: [{
    tool: 'paint',
    pts: [[1, 2, 0.5, 0, 0, 0, 0] as [number, number, number, number, number, number, number]],
    color: '#103c65',
    params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 },
    time: 123,
    diffusionFrames: 0,
  }],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
} satisfies SerializedProject;

const editedState = {
  ...editableState,
  strokes: [{
    ...editableState.strokes[0],
    color: '#ff66aa',
    time: 456,
  }],
} satisfies SerializedProject;

function pngDataUrl(label: string): string {
  return `data:image/png;base64,${btoa(label)}`;
}

function makeEngine(initialState: SerializedProject, initialDataUrl: string): TestPaintEngine {
  let state = structuredClone(initialState);
  let dataUrl = initialDataUrl;
  const engine = {
    save: vi.fn(() => structuredClone(state)),
    load: vi.fn((next: SerializedProject) => { state = structuredClone(next); }),
    clear: vi.fn(() => { state = { ...state, strokes: [] }; }),
    exportCompositeCanvas: vi.fn(() => ({ width: state.width, height: state.height, toDataURL: () => dataUrl })),
    setBackgroundImageUrl: vi.fn(),
    resetBackground: vi.fn(),
    setPreviewBaseImageUrl: vi.fn(),
    clearPreviewBaseImage: vi.fn(),
    getStrokeCount: vi.fn(() => state.strokes.length),
    setTool: vi.fn(),
    setPhysicsMode: vi.fn(),
    setColorHex: vi.fn(),
    setBrushOpacity: vi.fn(),
    setBrushSize: vi.fn(),
    setBgMode: vi.fn((mode: string) => { state = { ...state, settings: { ...state.settings, bgMode: mode } }; }),
    setPaperGrain: vi.fn(),
    setEmbossStrength: vi.fn(),
    setEdgeDetail: vi.fn(),
    setPickup: vi.fn(),
    setLocalSpreadStrength: vi.fn(),
    setAntiAlias: vi.fn(),
    setEraseStrength: vi.fn(),
    startPhysics: vi.fn(),
    stopPhysics: vi.fn(),
    forceDry: vi.fn(),
    undo: vi.fn(),
    __setState: (next: SerializedProject, nextDataUrl: string) => {
      state = structuredClone(next);
      dataUrl = nextDataUrl;
    },
  } satisfies TestPaintEngine;
  return engine;
}

function physicLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'phys-layer-1',
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'phys-layer-1' },
    ...overrides,
  };
}

function mockLayers(layers: Layer[]): void {
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue(layers);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
}

class TestNode {
  nodeType: number;
  childNodes: TestNode[] = [];
  parentNode: TestElement | null = null;

  constructor(nodeType: number) {
    this.nodeType = nodeType;
  }

  appendChild<T extends TestNode>(node: T): T {
    this.childNodes.push(node);
    node.parentNode = this as unknown as TestElement;
    return node;
  }

  insertBefore<T extends TestNode>(node: T, reference: TestNode | null): T {
    if (!reference) return this.appendChild(node);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) return this.appendChild(node);
    this.childNodes.splice(index, 0, node);
    node.parentNode = this as unknown as TestElement;
    return node;
  }

  removeChild<T extends TestNode>(node: T): T {
    this.childNodes = this.childNodes.filter((child) => child !== node);
    node.parentNode = null;
    return node;
  }

  get firstChild(): TestNode | null {
    return this.childNodes[0] ?? null;
  }

  get firstElementChild(): TestElement | null {
    return this.childNodes.find((child): child is TestElement => child instanceof TestElement) ?? null;
  }

  get nextSibling(): TestNode | null {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.childNodes = [new TestText(value)];
  }
}

class TestText extends TestNode {
  data: string;
  nodeValue: string;

  constructor(value: string) {
    super(3);
    this.data = value;
    this.nodeValue = value;
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class TestElement extends TestNode {
  localName: string;
  nodeName: string;
  namespaceURI = 'http://www.w3.org/1999/xhtml';
  attributes = new Map<string, string>();
  style = {
    cssText: '',
    opacity: '',
    setProperty: (key: string, value: string) => {
      (this.style as unknown as Record<string, string>)[key] = value;
    },
    removeProperty: (key: string) => {
      (this.style as unknown as Record<string, string>)[key] = '';
    },
  };
  private listeners = new Map<string, Set<(event: TestEvent) => void>>();

  get parentElement(): TestElement | null {
    return this.parentNode;
  }

  constructor(localName: string) {
    super(1);
    this.localName = localName;
    this.nodeName = localName.toUpperCase();
  }

  set className(value: string) {
    this.setAttribute('class', value);
  }

  get className(): string {
    return this.getAttribute('class') ?? '';
  }

  setAttribute(name: string, value: unknown): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: (event: TestEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: TestEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: TestEvent): boolean {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    return !event.defaultPrevented;
  }

  querySelector(selector: string): TestElement | null {
    return queryAll(this, (element) => element.localName === selector || hasClass(element, selector.replace(/^\./, '')))[0] ?? null;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 650, right: 1000, bottom: 650 };
  }

  closest(): TestElement | null {
    return null;
  }
}

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private currentSrc = '';

  set src(value: string) {
    this.currentSrc = value;
    this.onload?.();
  }

  get src(): string {
    return this.currentSrc;
  }
}

class TestCanvasElement extends TestElement {
  width = 1000;
  height = 650;

  constructor() {
    super('canvas');
  }

  getContext(): CanvasRenderingContext2D {
    const gradient = { addColorStop: vi.fn() };
    return {
      fillStyle: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
    } as unknown as CanvasRenderingContext2D;
  }

  toDataURL(): string {
    return paintHarness.engine?.exportCompositeCanvas().toDataURL() ?? savedDataUrl;
  }
}

class TestDocument {
  documentElement = new TestElement('html');
  body = new TestElement('body');

  createElement(name: string): TestElement {
    return name === 'canvas' ? new TestCanvasElement() : new TestElement(name);
  }

  createElementNS(_namespace: string, name: string): TestElement {
    return this.createElement(name);
  }

  createTextNode(value: string): TestText {
    return new TestText(value);
  }
}

class TestEvent {
  type: string;
  target: unknown;
  currentTarget: unknown;
  defaultPrevented = false;
  returnValue: unknown;
  detail?: unknown;
  data?: unknown;
  origin?: string;
  source?: unknown;

  constructor(type: string, init: Partial<TestEvent> = {}) {
    this.type = type;
    Object.assign(this, init);
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class TestWindow {
  document: TestDocument;
  location = { origin: 'http://localhost:1420', search: '', hash: '' };
  private parentWindow: { postMessage: ReturnType<typeof vi.fn> } | null = null;
  private listeners = new Map<string, Set<(event: TestEvent) => void>>();

  constructor(document: TestDocument) {
    this.document = document;
  }

  get opener(): { postMessage: ReturnType<typeof vi.fn> } | null {
    if (this.parentWindow) {
      const listeners = paintHarness.browserBridgeReadyListeners.splice(0);
      queueMicrotask(() => queueMicrotask(() => {
        for (const listener of listeners) listener();
      }));
    }
    return this.parentWindow;
  }

  set opener(value: { postMessage: ReturnType<typeof vi.fn> } | null) {
    this.parentWindow = value;
  }

  addEventListener(type: string, listener: (event: TestEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: TestEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: TestEvent): boolean {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    return !event.defaultPrevented;
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    return Number(setTimeout(() => callback(Date.now()), 0));
  }

  cancelAnimationFrame(id: number): void {
    clearTimeout(id);
  }

  setTimeout = setTimeout;
  clearTimeout = clearTimeout;
  setInterval = setInterval;
  clearInterval = clearInterval;
}

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

const mountedRoots = new Set<TestElement>();

function createTestRoot(): TestElement {
  const root = new TestElement('div');
  mountedRoots.add(root);
  return root;
}

function installDom(encodedContext: string, onParentMessage: (message: { type?: string; payload?: PhysicPaintApplyPayload }) => void): { root: TestElement; window: TestWindow } {
  const document = new TestDocument();
  const window = new TestWindow(document);
  window.location.search = `?context=${encodedContext}`;
  window.opener = {
    postMessage: vi.fn((message: { type?: string; payload?: PhysicPaintApplyPayload }) => onParentMessage(message)),
  };
  vi.stubGlobal('document', document as unknown as Document);
  vi.stubGlobal('window', window as unknown as Window & typeof globalThis);
  vi.stubGlobal('HTMLElement', TestElement);
  vi.stubGlobal('HTMLCanvasElement', TestCanvasElement);
  vi.stubGlobal('Image', TestImage);
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  vi.stubGlobal('CustomEvent', class extends TestEvent {
    constructor(type: string, init: { detail?: unknown } = {}) {
      super(type, { detail: init.detail });
    }
  });
  vi.stubGlobal('MessageEvent', class extends TestEvent {
    constructor(type: string, init: { data?: unknown; origin?: string; source?: unknown } = {}) {
      super(type, init);
    }
  });
  const root = document.createElement('div');
  mountedRoots.add(root);
  return { root, window };
}

function queryAll(root: TestNode, predicate: (element: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = [];
  for (const child of root.childNodes) {
    if (child instanceof TestElement) {
      if (predicate(child)) matches.push(child);
      matches.push(...queryAll(child, predicate));
    }
  }
  return matches;
}

function hasClass(element: TestElement, className: string): boolean {
  return element.className.split(/\s+/).includes(className);
}

function findButton(root: TestElement, name: string): TestElement | null {
  return queryAll(root, (element) => {
    if (element.localName !== 'button') return false;
    return (element.getAttribute('aria-label') ?? element.textContent).trim() === name;
  })[0] ?? null;
}

function findRotoCell(root: TestElement, frame: number): TestElement | null {
  return queryAll(root, (element) => (
    element.localName === 'button'
    && hasClass(element, 'physics-paint-roto-cell')
    && element.textContent.trim() === String(frame)
  ))[0] ?? null;
}

function visibleText(root: TestElement): string {
  return root.textContent.replace(/\s+/g, ' ').trim();
}

function fire(element: TestElement, requestedType: string): void {
  const eventType = Array.from((element as unknown as { listeners?: Map<string, Set<(event: TestEvent) => void>> }).listeners?.keys() ?? [])
    .find((type) => type.toLowerCase() === requestedType.toLowerCase()) ?? requestedType;
  element.dispatchEvent(new TestEvent(eventType));
}

function fireInput(element: TestElement, value: string): void {
  (element as unknown as { value: string }).value = value;
  fire(element, 'Input');
}

function findInput(root: TestElement, id: string): TestElement | null {
  return queryAll(root, (element) => element.localName === 'input' && element.getAttribute('id') === id)[0] ?? null;
}

function isStudioEngineReady(root: TestElement): boolean {
  return queryAll(root, (element) => (
    element.localName === 'span'
    && hasClass(element, 'physics-paint-status-pill')
    && element.textContent.trim() === 'Engine ready'
  )).length === 1;
}

function onionImages(root: TestElement): TestElement[] {
  return queryAll(root, (element) => element.localName === 'img' && hasClass(element, 'physics-paint-onion-frame'));
}

function onionImageSnapshot(root: TestElement) {
  return onionImages(root).map((element) => ({
    src: element.getAttribute('src'),
    className: element.className,
    style: String((element.style as unknown as { opacity?: string | number }).opacity ?? ''),
  }));
}

async function flushPreact(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

function waitForHarnessSignal(listeners: Array<() => void>): Promise<void> {
  return new Promise((resolve) => {
    listeners.push(resolve);
  });
}

async function mountStudioReady(root: TestElement, createStudio: () => VNode<any>): Promise<void> {
  const engineReady = waitForHarnessSignal(paintHarness.engineReadyListeners);
  const browserBridgeReady = waitForHarnessSignal(paintHarness.browserBridgeReadyListeners);
  await act(async () => {
    render(createStudio(), root as unknown as Element);
  });
  await act(async () => {
    await Promise.all([engineReady, browserBridgeReady]);
  });
  await act(async () => {
    render(createStudio(), root as unknown as Element);
  });
  expect(isStudioEngineReady(root)).toBe(true);
}

async function mountDebug07KeyMutationStudio(startFrame: number) {
  const paintBySource = new Map([
    [0, pngDataUrl('debug-07-immediate-A')],
    [1, pngDataUrl('debug-07-immediate-B')],
    [2, pngDataUrl('debug-07-immediate-C')],
  ]);
  const sourceFrames = [0, 1, 2].map((frame) => ({
    frameIndex: 0,
    appFrame: frame,
    sourceFrame: frame,
    displayFrame: frame,
    source: 'real-key' as const,
    dataUrl: paintBySource.get(frame)!,
    width: 1000,
    height: 650,
  }));
  for (const frame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.sourceFrame, frame);
  physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
    enabled: true,
    inBetweenCount: 2,
    mode: 'duplicate',
    deform: 0,
    position: 0,
  });
  const launchContext: PhysicPaintLaunchContext = {
    operationId: `debug-07-immediate-${startFrame}`,
    layerId: 'phys-layer-1',
    layerName: 'Physic Paint',
    startFrame,
    workflowMode: 'roto',
    editableSource: 'roto',
    width: 1000,
    height: 650,
    cachedRotoFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'),
    rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
  };
  const applyPayloads: PhysicPaintApplyPayload[] = [];
  const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
    if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
    applyPayloads.push(message.payload);
    const result = applyPhysicPaintPayload(message.payload);
    window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
  });
  const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');
  paintHarness.storedLaunchContext = launchContext;
  await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));
  fire(findRotoCell(root, startFrame)!, 'Click');
  await act(async () => {
    await flushPreact();
  });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const insertButton = findButton(root, `Insert blank Roto key before frame ${startFrame}`);
    if (insertButton?.getAttribute('disabled') === null) break;
    await act(async () => { await flushPreact(); });
  }
  paintHarness.engine?.setPreviewBaseImageUrl.mockClear();
  paintHarness.engine?.clearPreviewBaseImage.mockClear();
  paintHarness.engine?.clear.mockClear();
  paintHarness.engine?.load.mockClear();
  return { root, paintBySource, applyPayloads };
}

function lastPreviewBasePayload(): string | null {
  const calls = paintHarness.engine?.setPreviewBaseImageUrl.mock.calls ?? [];
  return calls.length > 0 ? calls[calls.length - 1][0] : null;
}

let renderedKeyMutationOperation = 0;

async function mountRenderedKeyMutationProbe(options: {
  currentFrame: number;
  initialFrames: PhysicPaintRotoCacheFrame[];
  initialSettings: PhysicPaintRotoInterpolationSettings;
  persist?: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
}) {
  installDom('', () => {});
  const seeded = applyPhysicPaintPayload({
    operationId: `debug-07-rendered-seed-${options.currentFrame}-${renderedKeyMutationOperation += 1}`,
    kind: 'replace-roto-key-frames',
    layerId: 'phys-layer-1',
    startFrame: options.currentFrame,
    frames: options.initialFrames,
    rotoInterpolationSettings: options.initialSettings,
  });
  if (!seeded.ok) throw new Error(seeded.error ?? 'Could not seed rendered key mutation probe');
  const transactions: RotoKeyUtilityTransaction[] = [];
  const restores: Array<{
    effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>;
    frames: readonly PhysicPaintRotoCacheFrame[] | undefined;
  }> = [];
  const state: { utilities: RotoKeyUtilities | null; currentFrame: number } = {
    utilities: null,
    currentFrame: options.currentFrame,
  };

  function Probe() {
    const [currentFrame, setCurrentFrame] = useState(options.currentFrame);
    const [cacheFrames, setCacheFrames] = useState<PhysicPaintRotoCacheFrame[]>(() => physicPaintStore.getRotoCacheFrames('phys-layer-1'));
    const [settings, setSettings] = useState<PhysicPaintRotoInterpolationSettings>(() => physicPaintStore.getRotoInterpolationSettings('phys-layer-1'));
    state.currentFrame = currentFrame;
    const view = selectRotoTimelineView({ cachedRotoFrames: cacheFrames, currentFrame, interpolationSettings: settings });
    const projectedFrames = selectProjectedRealCachedRotoFrames(cacheFrames, view.projection);
    state.utilities = useRotoKeyUtilities({
      currentFrame,
      realKeyFrames: projectedFrames,
      cachedRotoFrames: cacheFrames,
      dirtyFrames: new Set(),
      canvasSize: { width: 1000, height: 650 },
      applyStatus: 'idle',
      flushInFlight: false,
      buildBlankRotoFrame: (frame) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' }),
      resolveSourceFrameForDisplayFrame: (displayFrame) => view.projection.realKeys.find((key) => key.displayFrame === displayFrame)?.sourceFrame ?? displayFrame,
      resolveDisplayFrameForSourceFrame: (sourceFrame, transaction) => selectRotoTimelineView({
        cachedRotoFrames: transaction.realKeyFrames,
        currentFrame: sourceFrame,
        interpolationSettings: { ...settings, segmentSpacingOverrides: transaction.segmentSpacingOverrides },
      }).projection.realKeys.find((key) => key.sourceFrame === sourceFrame)?.displayFrame ?? null,
      resolvePasteTargetForDisplayFrame: (displayFrame) => resolveRotoRealKeySaveTarget(view.model, displayFrame),
      segmentSpacingOverrides: settings.segmentSpacingOverrides,
      getEditableStates: () => new Map(),
      setEditableStates: () => {},
      getPreviewFrames: () => new Map(),
      setPreviewFrames: () => {},
      getEditableState: () => null,
      setDirtyFrames: () => {},
      syncPendingRotoFrames: () => {},
      syncRotoKeyFrameLists: (frames) => { if (frames) setCacheFrames([...frames]); },
      applyRotoKeyFrames: (transaction) => {
        transactions.push(transaction);
        const result = physicPaintStore.replaceRotoKeyFrames({
          operationId: `debug-07-rendered-${transaction.operation}-${currentFrame}-${renderedKeyMutationOperation += 1}`,
          kind: 'replace-roto-key-frames',
          layerId: 'phys-layer-1',
          startFrame: transaction.activeFrame,
          frames: transaction.realKeyFrames,
          rotoInterpolationSettings: { ...settings, segmentSpacingOverrides: transaction.segmentSpacingOverrides },
        });
        if (!result.ok) throw new Error(result.error ?? `Rendered ${transaction.operation} failed`);
        const refreshedSettings = physicPaintStore.getRotoInterpolationSettings('phys-layer-1');
        const refreshedFrames = physicPaintStore.getRotoCacheFrames('phys-layer-1');
        setSettings(refreshedSettings);
        setCacheFrames(refreshedFrames);
        return refreshedFrames;
      },
      persistRotoKeyFrameTransaction: options.persist ?? (async () => {}),
      handleSaveFrameEffect: async () => true,
      restoreFrame: (effect, frames) => { restores.push({ effect, frames }); setCurrentFrame(effect.restore.frame); },
      clearCanvas: () => {},
      showCachedReference: () => {},
      navigate: async (frame) => { setCurrentFrame(frame); },
      clearGeneratedFrame: () => {},
      clearCachedReferenceFrame: () => {},
      clearDeletedFrame: () => {},
      setApplyMessage: () => {},
      setApplyStatus: () => {},
      setLastError: () => {},
      snapshotCurrentRotoFrame: () => {},
      setRotoSavingFrame: () => {},
    });
    const availability = state.utilities.session.actionAvailability.value;
    return h(PhysicsPaintWorkflowStrip, {
      mode: 'roto', currentFrame, startFrame: 0, frameCount: 1, isPlaying: false, ready: true,
      occupiedRotoFrames: projectedFrames.map((frame) => frame.appFrame),
      savedRotoFrames: projectedFrames.map((frame) => ({ frame: frame.appFrame, saved: true })),
      cachedRotoFrames: projectedFrames, editableRotoFrames: [], pendingRotoFrames: [], rotoInterpolationSettings: settings,
      onion: { enabled: false, previous: true, next: false, count: 1, opacity: 50 },
      onInsertRotoFrame: state.utilities.insertBlankKey,
      onDuplicateRotoKey: state.utilities.duplicateKey,
      onDeleteRotoFrame: state.utilities.deleteKey,
      rotoKeyState: { actionAvailability: availability, hasCopiedRotoKey: false },
      onSaveRotoFrame: () => {}, onSavePendingRotoFrames: () => {}, onSavePlay: () => {}, onFrameCountChange: () => {}, onPlayPreview: () => {}, onStopPreview: () => {},
      onNavigateToSyncedFrame: setCurrentFrame, onGoToFirstFrame: () => {}, onGoToPreviousFrame: () => {}, onGoToNextFrame: () => {}, onGoToLastFrame: () => {},
      onInspectPlayFrame: () => {}, onOnionChange: () => {},
    });
  }

  const root = createTestRoot();
  render(h(Probe, {}), root as unknown as Element);
  await flushPreact();
  fire(findRotoCell(root, options.currentFrame)!, 'Click');
  await flushPreact();
  return { root, state, transactions, restores };
}

void makeRotoUtilityInput;
function makeRotoUtilityInput(options: {
  currentFrame: number;
  initialFrames: PhysicPaintRotoCacheFrame[];
  initialSettings: PhysicPaintRotoInterpolationSettings;
  onPublish?: (transaction: RotoKeyUtilityTransaction, frames: PhysicPaintRotoCacheFrame[], settings: PhysicPaintRotoInterpolationSettings) => void;
  persist?: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
  restore?: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, frames?: readonly PhysicPaintRotoCacheFrame[]) => void;
}) {
  let currentFrame = options.currentFrame;
  let cacheFrames = [...options.initialFrames];
  let settings = { ...options.initialSettings };
  const editableStates = new Map<number, SerializedProject>();
  const previewFrames = new Map<number, PhysicPaintRotoCacheFrame>();
  const projected = () => {
    const view = selectRotoTimelineView({ cachedRotoFrames: cacheFrames, currentFrame, interpolationSettings: settings });
    return {
      view,
      frames: selectProjectedRealCachedRotoFrames(cacheFrames, view.projection),
    };
  };
  const input = () => {
    const current = projected();
    return {
      currentFrame,
      realKeyFrames: current.frames,
      cachedRotoFrames: cacheFrames,
      dirtyFrames: new Set<number>(),
      canvasSize: { width: 1000, height: 650 },
      applyStatus: 'idle' as const,
      flushInFlight: false,
      buildBlankRotoFrame: (frame: number) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' as const }),
      resolveSourceFrameForDisplayFrame: (displayFrame: number) => current.view.projection.realKeys.find((key) => key.displayFrame === displayFrame)?.sourceFrame ?? displayFrame,
      resolvePasteTargetForDisplayFrame: (displayFrame: number) => resolveRotoRealKeySaveTarget(current.view.model, displayFrame),
      segmentSpacingOverrides: settings.segmentSpacingOverrides,
      getEditableStates: () => editableStates,
      setEditableStates: (states: Map<number, SerializedProject>) => { editableStates.clear(); for (const [frame, state] of states) editableStates.set(frame, state); },
      getPreviewFrames: () => previewFrames,
      setPreviewFrames: (frames: Map<number, PhysicPaintRotoCacheFrame>) => { previewFrames.clear(); for (const [frame, value] of frames) previewFrames.set(frame, value); },
      getEditableState: (frame: number) => editableStates.get(frame) ?? null,
      setDirtyFrames: () => {},
      syncPendingRotoFrames: () => {},
      syncRotoKeyFrameLists: (frames?: readonly PhysicPaintRotoCacheFrame[]) => { if (frames) cacheFrames = [...frames]; },
      applyRotoKeyFrames: (transaction: RotoKeyUtilityTransaction) => {
        const nextSettings = { ...settings, segmentSpacingOverrides: transaction.segmentSpacingOverrides };
        const sourceFrames = transaction.realKeyFrames.map((frame) => ({ ...frame }));
        const result = applyPhysicPaintPayload({
          operationId: `debug-07-five-${transaction.operation}-${currentFrame}`,
          kind: 'replace-roto-key-frames',
          layerId: 'phys-layer-1',
          startFrame: transaction.activeFrame,
          frames: sourceFrames,
          rotoInterpolationSettings: nextSettings,
        });
        if (!result.ok) throw new Error(result.error ?? `Debug 07 ${transaction.operation} transaction failed`);
        settings = physicPaintStore.getRotoInterpolationSettings('phys-layer-1');
        cacheFrames = physicPaintStore.getRotoCacheFrames('phys-layer-1');
        options.onPublish?.(transaction, cacheFrames, settings);
        return cacheFrames;
      },
      persistRotoKeyFrameTransaction: options.persist ?? (async () => {}),
      handleSaveFrameEffect: async () => true,
      restoreFrame: options.restore ?? (() => {}),
      clearCanvas: () => {},
      showCachedReference: () => {},
      navigate: async (frame: number) => { currentFrame = frame; },
      clearGeneratedFrame: () => {},
      clearCachedReferenceFrame: () => {},
      clearDeletedFrame: () => {},
      setApplyMessage: () => {},
      setApplyStatus: () => {},
      setLastError: () => {},
      snapshotCurrentRotoFrame: () => {},
      setRotoSavingFrame: () => {},
    };
  };
  return {
    input,
    getCurrentFrame: () => currentFrame,
    setCurrentFrame: (frame: number) => { currentFrame = frame; },
    getFrames: () => cacheFrames,
    getSettings: () => settings,
    editableStates,
    previewFrames,
  };
}

describe('Phase 36.3 durable Roto cache core', () => {
  beforeEach(() => {
    fsMock.files.clear();
    fsMock.dirs.clear();
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    paintHarness.engine = makeEngine(editableState, savedDataUrl);
    paintHarness.storedLaunchContext = null;
    paintHarness.storedLaunchContextPromise = null;
    paintHarness.launchListeners = [];
    mockLayers([physicLayer()]);
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of mountedRoots) render(null as unknown as VNode, root as unknown as Element);
      await flushPreact();
    });
    mountedRoots.clear();
    (layerStore.layers.peek as typeof layerStore.layers.peek & { mockRestore?: () => void }).mockRestore?.();
    (layerStore.overlayLayers.peek as typeof layerStore.overlayLayers.peek & { mockRestore?: () => void }).mockRestore?.();
    vi.clearAllMocks();
    await act(async () => {
      await flushPreact();
    });
    vi.unstubAllGlobals();
    physicPaintStore.reset();
    paintHarness.engine = null;
    paintHarness.storedLaunchContext = null;
    paintHarness.storedLaunchContextPromise = null;
    paintHarness.launchListeners = [];
  });

  it('Clear current Roto frame replaces the mounted cached real key without deleting its topology', async () => {
    const oldPaint = pngDataUrl('clear-current-old-paint');
    const otherPaint = pngDataUrl('clear-current-other-paint');
    const settings: PhysicPaintRotoInterpolationSettings = {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 18,
      position: -12,
      segmentSpacingOverrides: [{ fromSourceFrame: 0, toSourceFrame: 3, inBetweenCount: 2 }],
    };
    const realKeys: PhysicPaintRotoCacheFrame[] = [
      { frameIndex: 0, appFrame: 0, sourceFrame: 0, displayFrame: 0, source: 'real-key', dataUrl: oldPaint, width: 1000, height: 650 },
      { frameIndex: 0, appFrame: 3, sourceFrame: 3, displayFrame: 3, source: 'real-key', dataUrl: otherPaint, width: 1000, height: 650 },
    ];
    for (const frame of realKeys) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.sourceFrame!, frame);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', settings);
    const normalizedSettings = physicPaintStore.getRotoInterpolationSettings('phys-layer-1');
    const launchContext: PhysicPaintLaunchContext = {
      operationId: 'clear-current-mounted-real-key',
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: 0,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
      cachedRotoFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'),
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
    };
    paintHarness.storedLaunchContext = launchContext;
    const applyPayloads: PhysicPaintApplyPayload[] = [];
    const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
      if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
      applyPayloads.push(message.payload);
      const result = applyPhysicPaintPayload(message.payload);
      window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
    });
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');

    await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));
    await act(async () => { await flushPreact(); });
    expect(paintHarness.engine?.setPreviewBaseImageUrl).toHaveBeenCalledWith(oldPaint);

    const clearButton = findButton(root, 'Clear current Roto frame');
    expect(clearButton).not.toBeNull();
    fire(clearButton!, 'Click');
    await flushPreact();

    expect(paintHarness.engine?.clear).toHaveBeenCalled();
    expect(paintHarness.engine?.clearPreviewBaseImage).toHaveBeenCalled();
    expect(visibleText(root)).toContain('Cleared roto frame 0.');
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 3]);
    expect(physicPaintStore.getFrame('phys-layer-1', 0)?.dataUrl).not.toBe(oldPaint);
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(otherPaint);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1')).toEqual(normalizedSettings);
    expect(applyPayloads).toEqual([]);

    const projectPath = '/clear-current-roto-frame';
    const persistedOutputs = await savePhysicPaintData(projectPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    expect(JSON.stringify(persistedOutputs)).not.toContain(oldPaint);
    const hydratedOutputs = await loadPhysicPaintData(projectPath, persistedOutputs);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(hydratedOutputs!);
    const reopenContext = createPhysicPaintLaunchContext(physicLayer(), 0, null, null, 'roto');
    expect(reopenContext.cachedRotoFrames?.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === 0)?.dataUrl).not.toBe(oldPaint);
    expect(reopenContext.cachedRotoFrames?.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === 3)?.dataUrl).toBe(otherPaint);
    expect(reopenContext.rotoInterpolationSettings).toEqual(normalizedSettings);

    fire(findRotoCell(root, 1)!, 'Click');
    await flushPreact();
    const beforeGeneratedClear = structuredClone(physicPaintStore.toMceOutputs());
    fire(findButton(root, 'Clear current Roto frame')!, 'Click');
    await flushPreact();
    expect(physicPaintStore.toMceOutputs()).toEqual(beforeGeneratedClear);
    fire(findRotoCell(root, 0)!, 'Click');
    await flushPreact();

    paintHarness.engine?.__setState(editedState, pngDataUrl('clear-current-new-paint'));
    const canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
    fire(canvasStack!, 'PointerDown');
    await flushPreact();
    fire(findButton(root, 'Save current')!, 'Click');
    await flushPreact();
    expect(applyPayloads[applyPayloads.length - 1]).toMatchObject({
      kind: 'apply-canvas',
      sourceFrame: 0,
      renderedFrame: { dataUrl: pngDataUrl('clear-current-new-paint') },
    });
    expect(physicPaintStore.getFrame('phys-layer-1', 0)?.dataUrl).toBe(pngDataUrl('clear-current-new-paint'));
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(otherPaint);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1')).toEqual(normalizedSettings);
  });

  it('saves one current real Roto key as durable cache, reopens it as reference, and discards later unsaved edits', async () => {
    const failures: string[] = [];
    const initialFrame = {
      frameIndex: 8,
      appFrame: 8,
      sourceFrame: 8,
      displayFrame: 8,
      source: 'real-key' as const,
      dataUrl: pngDataUrl('initial-real-key-8'),
      width: 1000,
      height: 650,
    };
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 8, initialFrame);
    const launchContext: PhysicPaintLaunchContext = {
      operationId: 'phase-36-3-test',
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: 8,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
      cachedRotoFrames: [initialFrame],
    };
    const applyPayloads: PhysicPaintApplyPayload[] = [];
    let { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
      if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
      applyPayloads.push(message.payload);
      const result = applyPhysicPaintPayload(message.payload);
      window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
    });
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');

    await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));

    let canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
    if (!canvasStack) failures.push('expected Physics Paint canvas stack to render');
    else fire(canvasStack, 'PointerDown');
    await flushPreact();

    const textBeforeSave = visibleText(root);
    if (!textBeforeSave.includes('Unsaved changes — click Save current to cache')) failures.push(`expected unsaved status copy before save, got: ${textBeforeSave}`);
    if (textBeforeSave.includes('Duplicate key') || textBeforeSave.includes('Insert frame') || textBeforeSave.includes('Delete frame') || textBeforeSave.includes('Copy frame') || textBeforeSave.includes('Paste frame')) failures.push('expected Roto key utilities to be hidden in the strict Phase 36.3 Roto surface');
    if (textBeforeSave.includes('Missing frames play transparent/background')) failures.push('expected cached Roto playback/missing-background copy to be hidden in the strict Phase 36.3 Roto surface');

    const saveCurrentButton = findButton(root, 'Save current');
    if (!saveCurrentButton) failures.push('expected one accessible `Save current` button for the current Roto frame');
    const fallbackSaveButton = saveCurrentButton ?? findButton(root, 'Save pending');
    if (!fallbackSaveButton) {
      failures.push('could not find any Roto save button to continue the vertical cache scenario');
    } else {
      fire(fallbackSaveButton, 'Click');
      await flushPreact();
    }

    if (applyPayloads.length !== 1) failures.push(`expected exactly one apply-canvas payload after Save current, got ${applyPayloads.length}`);
    const payload = applyPayloads[0];
    if (payload) {
      if (payload.kind !== 'apply-canvas') {
        failures.push(`expected apply-canvas payload, got ${payload.kind}`);
      } else {
        if (payload.layerId !== 'phys-layer-1') failures.push(`expected payload for phys-layer-1, got ${payload.layerId}`);
        if (payload.startFrame !== 8) failures.push(`expected payload for app frame 8, got ${payload.startFrame}`);
        if (payload.renderedFrame.dataUrl !== savedDataUrl) failures.push('expected the first saved PNG to be the durable rendered output');
      }
    }

    const savedFrame = physicPaintStore.getFrame('phys-layer-1', 8);
    if (!savedFrame?.dataUrl.startsWith('data:image/png')) failures.push('expected parent store frame 8 to contain the saved PNG');
    if (physicPaintStore.getFrame('phys-layer-1', 9) !== null) failures.push('expected frame 9 to remain empty after saving only the current Roto frame');

    const runtimeOutputs = physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[];
    const persistedOutputs = await savePhysicPaintData('/project', runtimeOutputs);
    const persisted = persistedOutputs[0] as McePhysicPaintOutput;
    if (!persisted?.frames[0] || !('cache_path' in persisted.frames[0])) failures.push('expected persisted frame 8 to use a cache_path PNG file');
    if (JSON.stringify(persistedOutputs).includes('data:image/png')) failures.push('expected persisted Physics Paint outputs to omit inline PNG data URLs everywhere');
    const cachePath = persisted?.frames[0] && 'cache_path' in persisted.frames[0] ? persisted.frames[0].cache_path : null;
    if (!cachePath || !fsMock.files.has(`/project/${cachePath}`)) failures.push('expected the rendered PNG cache file to be written under /project/cache/physic-paint');
    if (persisted?.roto_cache_metadata?.[0]?.source !== 'real-key') failures.push('expected persisted roto_cache_metadata to preserve source real-key');

    const hydratedOutputs = await loadPhysicPaintData('/project', persistedOutputs);
    physicPaintStore.reset();
    if (!hydratedOutputs) failures.push('expected persisted Physics Paint outputs to hydrate');
    else physicPaintStore.loadFromMceOutputs(hydratedOutputs);
    const hydratedFrame = physicPaintStore.getFrame('phys-layer-1', 8);
    if (!hydratedFrame?.dataUrl.startsWith('data:image/png')) failures.push('expected loadPhysicPaintData hydration to restore a runtime data:image/png frame for app frame 8');

    const reopenContext = createPhysicPaintLaunchContext(physicLayer(), 8, null, null, 'roto');
    if (reopenContext.workflowMode !== 'roto' || reopenContext.startFrame !== 8 || reopenContext.editableSource !== 'roto') failures.push('expected reopen launch context to target Roto frame 8');
    if (!reopenContext.cachedRotoFrames?.some((frame) => frame.appFrame === 8 && frame.source === 'real-key' && frame.dataUrl === savedDataUrl)) failures.push('expected reopen launch context to expose the saved frame as a real-key cached Roto reference');
    if (reopenContext.editableState) failures.push('expected cached-only Roto reopen not to restore editable stroke state as durable truth');

    paintHarness.engine?.setBackgroundImageUrl.mockClear();
    paintHarness.engine?.resetBackground.mockClear();
    paintHarness.engine?.setPreviewBaseImageUrl.mockClear();
    paintHarness.engine?.clearPreviewBaseImage.mockClear();
    paintHarness.engine?.setBgMode.mockClear();
    paintHarness.engine?.clear.mockClear();
    paintHarness.engine?.load.mockClear();
    await act(async () => {
      render(null as unknown as VNode, root as unknown as Element);
      await flushPreact();
    });
    mountedRoots.delete(root);
    ({ root, window } = installDom(encodeURIComponent(JSON.stringify(reopenContext)), () => {}));
    paintHarness.storedLaunchContext = reopenContext;
    paintHarness.engine = makeEngine(editableState, savedDataUrl);
    paintHarness.launchListeners = [];
    await flushPreact();
    await mountStudioReady(root, () => h(PhysicsPaintStudio, { key: 'reopen' }));
    await act(async () => {
      await flushPreact();
      await flushPreact();
    });
    for (let attempt = 0; attempt < 5 && !paintHarness.engine?.setPreviewBaseImageUrl.mock.calls.some(([dataUrl]) => dataUrl === savedDataUrl); attempt += 1) {
      await act(async () => {
        await flushPreact();
      });
    }
    canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
    const reopenedText = visibleText(root);
    if (!reopenedText.includes('Cached reference')) failures.push(`expected relaunched Physics Paint to describe frame 8 as a Cached reference, got: ${reopenedText}`);
    if (!reopenedText.includes('Cached frame 8') && !reopenedText.includes('Background only on frame 8')) failures.push(`expected relaunched Physics Paint to classify the selected cached base at frame 8, got: ${reopenedText}`);
    const backgroundCalls = paintHarness.engine?.setBackgroundImageUrl.mock.calls ?? [];
    if (backgroundCalls.some(([dataUrl]) => dataUrl === savedDataUrl)) failures.push(`expected relaunched Roto cached reference to stay out of the engine paper background; got background=${JSON.stringify(backgroundCalls)}`);
    if (paintHarness.engine?.setBgMode.mock.calls.some(([mode]) => mode === 'transparent')) failures.push('expected relaunched Roto cached reference to preserve the engine paper background proportions');
    if (!paintHarness.engine?.setPreviewBaseImageUrl.mock.calls.some(([dataUrl]) => dataUrl === savedDataUrl)) failures.push(`expected relaunched Roto cached reference to use the non-editable engine preview base; text=${reopenedText}; previewCalls=${JSON.stringify(paintHarness.engine?.setPreviewBaseImageUrl.mock.calls ?? [])}`);
    if (!paintHarness.engine?.clear.mock.calls.length) failures.push(`expected relaunched cached-only Roto reference to clear stale editable strokes before showing the preview-base reference; clearCalls=${JSON.stringify(paintHarness.engine?.clear.mock.calls ?? [])}`);
    if (paintHarness.engine?.load.mock.calls.some(([state]) => state === editableState || state.strokes.length > 0)) failures.push('expected cached-only Roto relaunch not to load editable saved strokes');
    paintHarness.engine?.__setState(editedState, unsavedDataUrl);
    if (canvasStack) fire(canvasStack, 'PointerDown');
    await flushPreact();
    const beforeUnload = new TestEvent('beforeunload');
    window.dispatchEvent(beforeUnload);
    await flushPreact();
    if (beforeUnload.defaultPrevented || beforeUnload.returnValue === '') failures.push('expected close/beforeunload to discard unsaved edits without prompt or blocking');
    if (applyPayloads.length !== 1) failures.push(`expected close with unsaved edits not to send another apply payload, got ${applyPayloads.length}`);
    if (physicPaintStore.getFrame('phys-layer-1', 8)?.dataUrl !== savedDataUrl) failures.push('expected discarded unsaved edits not to corrupt or replace the last saved cached PNG');

    expect(failures).toEqual([]);
  });

  it('Debug 07 RED A restores Insert display 0 immediately from refreshed canonical paint without repair navigation', async () => {
    const { root, paintBySource, applyPayloads } = await mountDebug07KeyMutationStudio(0);

    const insertButton = findButton(root, 'Insert blank Roto key before frame 0');
    expect(insertButton, visibleText(root)).not.toBeNull();
    if (insertButton?.getAttribute('disabled') !== null) throw new Error('A disabled: '+visibleText(root));
    fire(insertButton!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(applyPayloads.find((payload) => payload.kind === 'replace-roto-key-frames')).toBeTruthy();
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)?.dataUrl).toBe(paintBySource.get(0));
    expect(lastPreviewBasePayload()).toBe(savedDataUrl);
    expect(lastPreviewBasePayload()).not.toBe(paintBySource.get(2));
    expect(paintHarness.engine?.clear).toHaveBeenCalled();
    expect(paintHarness.engine?.load).not.toHaveBeenCalled();
  });

  it('Debug 07 reopened RED 6 loads shifted A on the first rendered display-3 click after Insert at display 0', async () => {
    const { root, paintBySource } = await mountDebug07KeyMutationStudio(0);

    fire(findButton(root, 'Insert blank Roto key before frame 0')!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)?.dataUrl).toBe(paintBySource.get(0));

    paintHarness.engine?.setPreviewBaseImageUrl.mockClear();
    fire(findRotoCell(root, 3)!, 'Click');
    await flushPreact();

    expect(lastPreviewBasePayload()).toBe(paintBySource.get(0));
    expect(lastPreviewBasePayload()).not.toBe(paintBySource.get(2));
  });

  it('Debug 07 RED B clears Insert display 3 immediately and proves away/back is only a repair event', async () => {
    const { root, paintBySource } = await mountDebug07KeyMutationStudio(3);

    const insertButton = findButton(root, 'Insert blank Roto key before frame 3');
    expect(insertButton, visibleText(root)).not.toBeNull();
    expect(insertButton?.getAttribute('disabled'), visibleText(root)).toBeNull();
    fire(insertButton!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)?.dataUrl).toBe(savedDataUrl);
    expect(lastPreviewBasePayload()).toBe(savedDataUrl);
    expect(lastPreviewBasePayload()).not.toBe(paintBySource.get(2));

    expect(findRotoCell(root, 3)).not.toBeNull();
  });

  it('Debug 07 RED C restores Duplicate display 3 immediately from copied B and proves away/back repair', async () => {
    const { root, paintBySource, applyPayloads } = await mountDebug07KeyMutationStudio(6);
    fire(findRotoCell(root, 6)!, 'Click');
    await act(async () => {
      await flushPreact();
    });

    let duplicateButton = findButton(root, 'Duplicate Roto key at frame 6');
    expect(duplicateButton, visibleText(root)).not.toBeNull();
    for (let attempt = 0; attempt < 10 && duplicateButton?.getAttribute('disabled') !== null; attempt += 1) {
      await act(async () => { await flushPreact(); });
      duplicateButton = findButton(root, 'Duplicate Roto key at frame 6');
    }
    expect(duplicateButton?.getAttribute('disabled')).toBeNull();
    fire(duplicateButton!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(applyPayloads.find((payload) => payload.kind === 'replace-roto-key-frames')).toBeTruthy();
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getFrame('phys-layer-1', 1)?.dataUrl).toBe(paintBySource.get(1));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 2)?.dataUrl).toBe(paintBySource.get(0));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)?.dataUrl).toBe(paintBySource.get(1));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 4)?.dataUrl).toBe(paintBySource.get(1));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 5)?.dataUrl).toBe(paintBySource.get(1));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 6)?.dataUrl).toBe(paintBySource.get(2));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 9)?.dataUrl).toBe(paintBySource.get(2));
    expect(lastPreviewBasePayload()).toBe(paintBySource.get(2));
    expect(findRotoCell(root, 3)).not.toBeNull();
    expect(findRotoCell(root, 6)).not.toBeNull();
    expect(findRotoCell(root, 9)).not.toBeNull();
  });

  it('Debug 07 reopened RED 1 publishes Insert blank paint to the selected rendered canvas immediately', async () => {
    const { root, paintBySource } = await mountDebug07KeyMutationStudio(3);

    fire(findButton(root, 'Insert blank Roto key before frame 3')!, 'Click');
    await flushPreact();

    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 3)?.dataUrl).toBe(savedDataUrl);
    expect(lastPreviewBasePayload()).toBe(savedDataUrl);
    expect(lastPreviewBasePayload()).not.toBe(paintBySource.get(2));
  });

  it('Debug 07 reopened RED 2 enables rendered Delete immediately after Insert without waiting for persistence', async () => {
    const frames = [0, 1, 2].map((frame) => ({
      frameIndex: 0, appFrame: frame, sourceFrame: frame, displayFrame: frame, source: 'real-key' as const,
      dataUrl: pngDataUrl(`debug-07-insert-delete-${frame}`), width: 1000, height: 650,
    }));
    let resolvePersistence!: () => void;
    const persistence = new Promise<void>((resolve) => { resolvePersistence = resolve; });
    const { root } = await mountRenderedKeyMutationProbe({
      currentFrame: 3,
      initialFrames: frames,
      initialSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
      persist: () => persistence,
    });

    fire(findButton(root, 'Insert blank Roto key before frame 3')!, 'Click');
    await flushPreact();

    expect(findButton(root, 'Delete Roto key at frame 3'), visibleText(root)).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 3')?.getAttribute('disabled'), visibleText(root)).toBeNull();
    resolvePersistence();
    await flushPreact();
  });

  it('Debug 07 reopened RED 3 selects and paints the rendered duplicated C immediately', async () => {
    const { root, paintBySource } = await mountDebug07KeyMutationStudio(6);

    fire(findButton(root, 'Duplicate Roto key at frame 6')!, 'Click');
    await flushPreact();

    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(findButton(root, 'Delete Roto key at frame 9'), visibleText(root)).not.toBeNull();
    expect(lastPreviewBasePayload()).toBe(paintBySource.get(2));
    expect(findRotoCell(root, 9)?.className).toContain('current');
  });

  it('Debug 07 reopened RED 4 deletes only the rendered duplicate C immediately and preserves B at source 1 display 3', async () => {
    const paint = new Map([
      [0, pngDataUrl('debug-07-critical-A')],
      [1, pngDataUrl('debug-07-critical-B')],
      [2, pngDataUrl('debug-07-critical-C')],
    ]);
    const frames = [0, 1, 2].map((frame) => ({
      frameIndex: 0, appFrame: frame, sourceFrame: frame, displayFrame: frame, source: 'real-key' as const,
      dataUrl: paint.get(frame)!, width: 1000, height: 650,
    }));
    const { root, transactions } = await mountRenderedKeyMutationProbe({
      currentFrame: 6,
      initialFrames: frames,
      initialSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    fire(findButton(root, 'Duplicate Roto key at frame 6')!, 'Click');
    await flushPreact();
    expect(transactions[0]?.realKeyFrameNumbers).toEqual([0, 1, 2, 3]);
    expect(transactions[0]?.realKeyFrames.map((frame) => frame.dataUrl)).toEqual([paint.get(0), paint.get(1), paint.get(2), paint.get(2)]);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getFrame('phys-layer-1', 1)?.dataUrl).toBe(paint.get(1));
    expect(physicPaintStore.getFrame('phys-layer-1', 2)?.dataUrl).toBe(paint.get(2));
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(paint.get(2));
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9]);

    const deleteButton = findButton(root, 'Delete Roto key at frame 9');
    expect(deleteButton, visibleText(root)).not.toBeNull();
    expect(deleteButton?.getAttribute('disabled'), visibleText(root)).toBeNull();
    fire(deleteButton!, 'Click');
    await flushPreact();

    expect(transactions.map((transaction) => transaction.operation)).toEqual(['duplicate', 'delete']);
    expect(transactions[1]?.frameMappings).toEqual([]);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2]);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', 0)?.dataUrl).toBe(paint.get(0));
    expect(physicPaintStore.getFrame('phys-layer-1', 1)?.dataUrl).toBe(paint.get(1));
    expect(physicPaintStore.getFrame('phys-layer-1', 2)?.dataUrl).toBe(paint.get(2));
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').find((frame) => frame.sourceFrame === 1)?.displayFrame).toBe(3);
  });

  it.each([
    { label: 'ON', enabled: true, selectedDisplay: 20 },
    { label: 'OFF', enabled: false, selectedDisplay: 20 },
  ])('Debug 07 reopened RED 5 preserves a distant custom projection when Duplicate starts $label and deletes only the duplicate', async ({ enabled, selectedDisplay }) => {
    const paint = new Map([0, 1, 2, 3, 20].map((frame) => [frame, pngDataUrl(`debug-07-distant-duplicate-${frame}`)]));
    const frames = [0, 1, 2, 3, 20].map((frame) => ({
      frameIndex: 0, appFrame: frame, sourceFrame: frame, displayFrame: frame, source: 'real-key' as const,
      dataUrl: paint.get(frame)!, width: 1000, height: 650,
    }));
    const settings: PhysicPaintRotoInterpolationSettings = {
      enabled, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }],
    };
    const { root, transactions } = await mountRenderedKeyMutationProbe({ currentFrame: selectedDisplay, initialFrames: frames, initialSettings: settings });

    const duplicateButton = findButton(root, `Duplicate Roto key at frame ${selectedDisplay}`);
    expect(duplicateButton, visibleText(root)).not.toBeNull();
    expect(duplicateButton?.getAttribute('disabled'), visibleText(root)).toBeNull();
    fire(duplicateButton!, 'Click');
    await flushPreact();

    expect(transactions, visibleText(root)).toHaveLength(1);
    expect(transactions[0]?.realKeyFrameNumbers).toEqual([0, 1, 2, 3, 20, 21]);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, 20, 21]);
    expect(physicPaintStore.getFrame('phys-layer-1', 20)?.dataUrl).toBe(paint.get(20));
    expect(physicPaintStore.getFrame('phys-layer-1', 21)?.dataUrl).toBe(paint.get(20));
    expect(transactions[0]?.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 },
    ]);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1').segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 },
    ]);
    const projectedOnFrames = enabled
      ? physicPaintStore.getRotoCacheFrames('phys-layer-1')
      : selectRotoTimelineView({
          cachedRotoFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'),
          currentFrame: selectedDisplay,
          interpolationSettings: { ...settings, enabled: true, segmentSpacingOverrides: transactions[0]?.segmentSpacingOverrides },
        }).projection;
    const onRealDisplays = Array.isArray(projectedOnFrames)
      ? projectedOnFrames.filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)
      : projectedOnFrames.realKeys.map((frame) => frame.displayFrame);
    const onGeneratedDisplays = Array.isArray(projectedOnFrames)
      ? projectedOnFrames.filter((frame) => frame.source === 'generated-interpolation' && frame.fromSourceFrame === 20 && frame.toSourceFrame === 21).map((frame) => frame.appFrame)
      : projectedOnFrames.generatedFrames.filter((frame) => frame.fromSourceFrame === 20 && frame.toSourceFrame === 21).map((frame) => frame.displayFrame);
    expect(onRealDisplays).toEqual([0, 3, 6, 9, 20, 23]);
    expect(onGeneratedDisplays).toEqual([21, 22]);
    expect(findButton(root, `Delete Roto key at frame ${enabled ? 23 : 21}`), visibleText(root)).not.toBeNull();

    const deleteButton = findButton(root, `Delete Roto key at frame ${enabled ? 23 : 21}`);
    expect(deleteButton?.getAttribute('disabled'), visibleText(root)).toBeNull();
    fire(deleteButton!, 'Click');
    await flushPreact();
    expect(transactions[1]?.frameMappings).toEqual([]);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, 20]);
    expect(physicPaintStore.getFrame('phys-layer-1', 20)?.dataUrl).toBe(paint.get(20));
  });

  it.each([
    { targetFrame: 12, enabled: false },
    { targetFrame: 12, enabled: true },
    { targetFrame: 14, enabled: false },
    { targetFrame: 14, enabled: true },
  ])('enables Copy then Paste immediately and persists copied paint at absolute frame $targetFrame from interpolation enabled=$enabled', async ({ targetFrame, enabled }) => {
    installDom('', () => {});
    const sourcePaint = pngDataUrl(`copy-source-for-${targetFrame}-${enabled ? 'on' : 'off'}`);
    const initialDataUrls = new Map([0, 1, 2, 3].map((frame) => [frame, frame === 3 ? sourcePaint : pngDataUrl(`paste-initial-source-${frame}-${enabled ? 'on' : 'off'}`)]));
    const sourceFrames = [0, 1, 2, 3].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: initialDataUrls.get(frame)!,
      width: 1000,
      height: 650,
    }));
    for (const frame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.sourceFrame, frame);
    const settings: PhysicPaintRotoInterpolationSettings = {
      enabled,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    };
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', settings);
    const selectedSourceDisplayFrame = enabled ? 9 : 3;
    const initialView = selectRotoTimelineView({ cachedRotoFrames: sourceFrames, currentFrame: selectedSourceDisplayFrame, interpolationSettings: settings });
    const projectedFrames = selectProjectedRealCachedRotoFrames(sourceFrames, initialView.projection);
    const editableStates = new Map<number, SerializedProject>([[selectedSourceDisplayFrame, editedState]]);
    const probeState: {
      utilities: RotoKeyUtilities | null;
      selectFrame: ((frame: number) => void) | null;
    } = { utilities: null, selectFrame: null };
    let appliedTransaction: Parameters<typeof physicPaintStore.replaceRotoKeyFrames>[0] | null = null;
    let copiedKeyAtSync: RotoSessionCopiedKey | null = null;

    function Probe() {
      const [currentFrame, setCurrentFrame] = useState(selectedSourceDisplayFrame);
      probeState.selectFrame = setCurrentFrame;
      probeState.utilities = useRotoKeyUtilities({
        currentFrame,
        realKeyFrames: projectedFrames,
        cachedRotoFrames: sourceFrames,
        dirtyFrames: new Set(),
        canvasSize: { width: 1000, height: 650 },
        applyStatus: 'idle',
        flushInFlight: false,
        buildBlankRotoFrame: (frame) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' }),
        resolveSourceFrameForDisplayFrame: (displayFrame) => initialView.projection.realKeys.find((key) => key.displayFrame === displayFrame)?.sourceFrame ?? displayFrame,
        resolvePasteTargetForDisplayFrame: (displayFrame) => resolveRotoRealKeySaveTarget(initialView.model, displayFrame),
        segmentSpacingOverrides: settings.segmentSpacingOverrides,
        getEditableStates: () => editableStates,
        setEditableStates: (states) => { editableStates.clear(); for (const [frame, state] of states) editableStates.set(frame, state); },
        getPreviewFrames: () => new Map(),
        setPreviewFrames: () => {},
        getEditableState: (frame) => editableStates.get(frame) ?? null,
        setDirtyFrames: () => {},
        syncPendingRotoFrames: () => {
          copiedKeyAtSync = probeState.utilities?.session.copiedKey.value ?? null;
          probeState.utilities?.resetSession();
        },
        syncRotoKeyFrameLists: () => {},
        applyRotoKeyFrames: (transaction) => {
          appliedTransaction = {
            operationId: `debug-04-paste-${targetFrame}-${enabled ? 'on' : 'off'}`,
            kind: 'replace-roto-key-frames',
            layerId: 'phys-layer-1',
            startFrame: transaction.activeFrame,
            frames: transaction.realKeyFrames,
            rotoInterpolationSettings: { ...settings, segmentSpacingOverrides: transaction.segmentSpacingOverrides },
          };
          const result = applyPhysicPaintPayload(appliedTransaction);
          if (!result.ok) throw new Error(result.error ?? 'Paste transaction failed');
          return physicPaintStore.getRotoCacheFrames('phys-layer-1');
        },
        persistRotoKeyFrameTransaction: async () => {},
        handleSaveFrameEffect: async () => true,
        restoreFrame: () => {},
        clearCanvas: () => {},
        showCachedReference: () => {},
        navigate: async () => {},
        clearGeneratedFrame: () => {},
        clearCachedReferenceFrame: () => {},
        clearDeletedFrame: () => {},
        setApplyMessage: () => {},
        setApplyStatus: () => {},
        setLastError: () => {},
        snapshotCurrentRotoFrame: () => {},
        setRotoSavingFrame: () => {},
      });
      const availability = probeState.utilities.session.actionAvailability.value;
      return h(PhysicsPaintWorkflowStrip, {
        mode: 'roto',
        currentFrame,
        startFrame: 0,
        frameCount: 1,
        isPlaying: false,
        ready: true,
        occupiedRotoFrames: projectedFrames.map((frame) => frame.appFrame),
        savedRotoFrames: projectedFrames.map((frame) => ({ frame: frame.appFrame, saved: true })),
        cachedRotoFrames: projectedFrames,
        editableRotoFrames: [],
        pendingRotoFrames: [],
        rotoInterpolationSettings: settings,
        onion: { enabled: false, previous: true, next: false, count: 1, opacity: 50 },
        onCopyRotoFrame: probeState.utilities.copyKey,
        onPasteRotoFrame: probeState.utilities.pasteKey,
        hasCopiedRotoKey: probeState.utilities.session.copiedKey.value !== null,
        rotoKeyState: {
          actionAvailability: availability,
          hasCopiedRotoKey: probeState.utilities.session.copiedKey.value !== null,
        },
        onSaveRotoFrame: () => {},
        onSavePendingRotoFrames: () => {},
        onSavePlay: () => {},
        onFrameCountChange: () => {},
        onPlayPreview: () => {},
        onStopPreview: () => {},
        onNavigateToSyncedFrame: setCurrentFrame,
        onGoToFirstFrame: () => {},
        onGoToPreviousFrame: () => {},
        onGoToNextFrame: () => {},
        onGoToLastFrame: () => {},
        onInspectPlayFrame: () => {},
        onOnionChange: () => {},
      });
    }

    const root = createTestRoot();
    render(h(Probe, {}), root as unknown as Element);
    await flushPreact();
    const sourceCell = findRotoCell(root, selectedSourceDisplayFrame);
    expect(sourceCell).not.toBeNull();
    fire(sourceCell!, 'Click');
    await flushPreact();
    const copyButton = findButton(root, `Copy Roto key at frame ${selectedSourceDisplayFrame}`);
    expect(copyButton?.getAttribute('disabled')).toBeNull();
    fire(copyButton!, 'Click');
    await flushPreact();
    expect(probeState.utilities?.session.copiedKey.value ?? copiedKeyAtSync).toMatchObject({
      frame: 3,
      cachedFrame: { appFrame: 3, sourceFrame: 3, displayFrame: 3, dataUrl: sourcePaint },
    });
    const targetCell = findRotoCell(root, targetFrame);
    expect(targetCell).not.toBeNull();
    fire(targetCell!, 'Click');
    await flushPreact();
    const pasteButton = findButton(root, `Paste Roto key to frame ${targetFrame}`);
    expect(pasteButton?.getAttribute('disabled')).toBeNull();
    fire(pasteButton!, 'Click');
    await flushPreact();

    const saveTransaction = saveRotoRealKeyTransaction({ model: initialView.model, displayFrame: targetFrame, currentSettings: settings });
    expect(appliedTransaction).toMatchObject({
      kind: 'replace-roto-key-frames',
      startFrame: targetFrame,
      rotoInterpolationSettings: {
        enabled,
        inBetweenCount: 2,
        segmentSpacingOverrides: targetFrame === 12
          ? []
          : [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
      },
    });
    const publishedTransaction = appliedTransaction as Parameters<typeof physicPaintStore.replaceRotoKeyFrames>[0] | null;
    expect(publishedTransaction?.frames.map((frame) => frame.sourceFrame ?? frame.appFrame)).toEqual(saveTransaction.model.realSourceFrames);
    expect(publishedTransaction?.rotoInterpolationSettings?.segmentSpacingOverrides).toEqual(saveTransaction.interpolationSettings.segmentSpacingOverrides);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, targetFrame]);
    expect(physicPaintStore.getFrame('phys-layer-1', targetFrame)?.dataUrl).toBe(sourcePaint);
    expect(physicPaintStore.getFrame('phys-layer-1', targetFrame === 12 ? 4 : 5)).toBeNull();
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(initialDataUrls.get(3));

    const projectPath = `/project-paste-${targetFrame}`;
    const persistedOutputs = await savePhysicPaintData(projectPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    const hydratedOutputs = await loadPhysicPaintData(projectPath, persistedOutputs);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(hydratedOutputs!);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, targetFrame]);
    expect(physicPaintStore.getFrame('phys-layer-1', targetFrame)?.dataUrl).toBe(sourcePaint);
    expect(physicPaintStore.getFrame('phys-layer-1', targetFrame === 12 ? 4 : 5)).toBeNull();
    const reopenContext = createPhysicPaintLaunchContext(physicLayer(), targetFrame, null, null, 'roto');
    const reopenedTimeline = selectRotoTimelineView({
      cachedRotoFrames: reopenContext.cachedRotoFrames ?? [],
      currentFrame: targetFrame,
      interpolationSettings: { ...reopenContext.rotoInterpolationSettings!, enabled: true },
    });
    expect(reopenedTimeline.model.realSourceFrames).toEqual([0, 1, 2, 3, targetFrame]);
    expect(reopenedTimeline.projection.realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, targetFrame]);
  });

  it.each([
    { enabled: true, displayFrame: 0, sourceFrame: 0 },
    { enabled: true, displayFrame: 3, sourceFrame: 1 },
    { enabled: true, displayFrame: 6, sourceFrame: 2 },
    { enabled: false, displayFrame: 0, sourceFrame: 0 },
    { enabled: false, displayFrame: 1, sourceFrame: 1 },
    { enabled: false, displayFrame: 2, sourceFrame: 2 },
  ])('renders compact Insert immediately from display $displayFrame with interpolation enabled=$enabled', async ({ enabled, displayFrame, sourceFrame }) => {
    installDom('', () => {});
    const initialPaint = new Map([0, 1, 2].map((frame) => [frame, pngDataUrl(`debug-07-compact-${frame}`)]));
    const sourceFrames = [0, 1, 2].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: initialPaint.get(frame)!,
      width: 1000,
      height: 650,
    }));
    const settings: PhysicPaintRotoInterpolationSettings = { enabled, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 };
    const probeState: { utilities: RotoKeyUtilities | null } = { utilities: null };
    let publishedTransaction: Parameters<typeof physicPaintStore.replaceRotoKeyFrames>[0] | null = null;

    function Probe() {
      const [currentFrame, setCurrentFrame] = useState(displayFrame);
      const [cacheFrames, setCacheFrames] = useState<PhysicPaintRotoCacheFrame[]>(sourceFrames);
      const [liveSettings, setLiveSettings] = useState(settings);
      const view = selectRotoTimelineView({ cachedRotoFrames: cacheFrames, currentFrame, interpolationSettings: liveSettings });
      const projectedFrames = selectProjectedRealCachedRotoFrames(cacheFrames, view.projection);
      probeState.utilities = useRotoKeyUtilities({
        currentFrame,
        realKeyFrames: projectedFrames,
        cachedRotoFrames: cacheFrames,
        dirtyFrames: new Set(),
        canvasSize: { width: 1000, height: 650 },
        applyStatus: 'idle',
        flushInFlight: false,
        buildBlankRotoFrame: (frame) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' }),
        resolveSourceFrameForDisplayFrame: (candidate) => view.projection.realKeys.find((key) => key.displayFrame === candidate)?.sourceFrame ?? candidate,
        resolvePasteTargetForDisplayFrame: (candidate) => resolveRotoRealKeySaveTarget(view.model, candidate),
        segmentSpacingOverrides: liveSettings.segmentSpacingOverrides,
        getEditableStates: () => new Map(), setEditableStates: () => {}, getPreviewFrames: () => new Map(), setPreviewFrames: () => {},
        getEditableState: () => null, setDirtyFrames: () => {}, syncPendingRotoFrames: () => {},
        syncRotoKeyFrameLists: (frames) => { if (frames) setCacheFrames([...frames]); },
        applyRotoKeyFrames: (transaction) => {
          publishedTransaction = {
            operationId: `debug-07-compact-${enabled ? 'on' : 'off'}-${displayFrame}`,
            kind: 'replace-roto-key-frames',
            layerId: 'phys-layer-1',
            startFrame: transaction.activeFrame,
            frames: transaction.realKeyFrames,
            rotoInterpolationSettings: { ...liveSettings, segmentSpacingOverrides: transaction.segmentSpacingOverrides },
          };
          const result = applyPhysicPaintPayload(publishedTransaction);
          if (!result.ok) throw new Error(result.error ?? 'Compact Insert transaction failed');
          const refreshedSettings = physicPaintStore.getRotoInterpolationSettings('phys-layer-1');
          const refreshedFrames = physicPaintStore.getRotoCacheFrames('phys-layer-1');
          setLiveSettings(refreshedSettings);
          setCacheFrames(refreshedFrames);
          return refreshedFrames;
        },
        persistRotoKeyFrameTransaction: async () => {}, handleSaveFrameEffect: async () => true,
        restoreFrame: () => {}, clearCanvas: () => {}, showCachedReference: () => {}, navigate: async (frame) => { setCurrentFrame(frame); },
        clearGeneratedFrame: () => {}, clearCachedReferenceFrame: () => {}, clearDeletedFrame: () => {},
        setApplyMessage: () => {}, setApplyStatus: () => {}, setLastError: () => {}, snapshotCurrentRotoFrame: () => {}, setRotoSavingFrame: () => {},
      });
      const availability = probeState.utilities.session.actionAvailability.value;
      return h(PhysicsPaintWorkflowStrip, {
        mode: 'roto', currentFrame, startFrame: 0, frameCount: 1, isPlaying: false, ready: true,
        occupiedRotoFrames: projectedFrames.map((frame) => frame.appFrame), savedRotoFrames: projectedFrames.map((frame) => ({ frame: frame.appFrame, saved: true })),
        cachedRotoFrames: projectedFrames, editableRotoFrames: [], pendingRotoFrames: [], rotoInterpolationSettings: liveSettings,
        onion: { enabled: false, previous: true, next: false, count: 1, opacity: 50 },
        onInsertRotoFrame: probeState.utilities.insertBlankKey,
        rotoKeyState: { actionAvailability: availability, hasCopiedRotoKey: false },
        onSaveRotoFrame: () => {}, onSavePendingRotoFrames: () => {}, onSavePlay: () => {}, onFrameCountChange: () => {}, onPlayPreview: () => {}, onStopPreview: () => {},
        onNavigateToSyncedFrame: setCurrentFrame, onGoToFirstFrame: () => {}, onGoToPreviousFrame: () => {}, onGoToNextFrame: () => {}, onGoToLastFrame: () => {},
        onInspectPlayFrame: () => {}, onOnionChange: () => {},
      });
    }

    const root = createTestRoot();
    render(h(Probe, {}), root as unknown as Element);
    await flushPreact();
    fire(findRotoCell(root, displayFrame)!, 'Click');
    await flushPreact();
    const insertButton = findButton(root, `Insert blank Roto key before frame ${displayFrame}`);
    expect(insertButton?.getAttribute('disabled'), visibleText(root)).toBeNull();
    fire(insertButton!, 'Click');
    await flushPreact();
    await flushPreact();

    const compactPublication = publishedTransaction as Parameters<typeof physicPaintStore.replaceRotoKeyFrames>[0] | null;
    expect(compactPublication?.startFrame).toBe(sourceFrame);
    expect(compactPublication?.frames.map((frame) => frame.sourceFrame ?? frame.appFrame)).toEqual([0, 1, 2, 3]);
    expect(compactPublication?.frames.map((frame) => frame.dataUrl)).toEqual([
      ...(sourceFrame === 0 ? [savedDataUrl] : [initialPaint.get(0)]),
      ...(sourceFrame === 0 ? [initialPaint.get(0)] : sourceFrame === 1 ? [savedDataUrl] : [initialPaint.get(1)]),
      ...(sourceFrame <= 1 ? [initialPaint.get(1)] : [savedDataUrl]),
      initialPaint.get(2),
    ]);
    const expectedDisplayFrames = enabled ? [0, 3, 6, 9] : [0, 1, 2, 3];
    expect(expectedDisplayFrames.every((frame) => findRotoCell(root, frame))).toBe(true);
    expect(probeState.utilities?.session.currentFrame.value).toBe(displayFrame);
    expect(compactPublication?.frames[sourceFrame]).toMatchObject({ sourceFrame, displayFrame: sourceFrame, dataUrl: savedDataUrl });
  });

  it('publishes distant Insert and exact Delete reversal atomically through persistence, hydration, and reopen', async () => {
    installDom('', () => {});
    const originalPaint = new Map([0, 1, 2, 3, 20].map((frame) => [frame, pngDataUrl(`debug-07-distant-${frame}`)]));
    const sourceFrames = [0, 1, 2, 3, 20].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: originalPaint.get(frame)!,
      width: 1000,
      height: 650,
    }));
    for (const frame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.sourceFrame, frame);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }],
    });

    type AtomicPublication = {
      selectedDisplayFrame: number;
      resolvedSourceFrame: number;
      sourceFrames: number[];
      paintBySource: Array<[number, string]>;
      overrides: NonNullable<PhysicPaintRotoInterpolationSettings['segmentSpacingOverrides']>;
      realDisplayFrames: number[];
      generatedFrames: number[];
    };
    const publications: AtomicPublication[] = [];
    const probeState: { utilities: RotoKeyUtilities | null } = { utilities: null };

    function Probe(props: { initialFrames: PhysicPaintRotoCacheFrame[]; initialSettings: PhysicPaintRotoInterpolationSettings; operation: 'insert' | 'delete' }) {
      const [currentFrame, setCurrentFrame] = useState(20);
      const [cacheFrames, setCacheFrames] = useState(props.initialFrames);
      const [liveSettings, setLiveSettings] = useState(props.initialSettings);
      const view = selectRotoTimelineView({ cachedRotoFrames: cacheFrames, currentFrame, interpolationSettings: liveSettings });
      const projectedFrames = selectProjectedRealCachedRotoFrames(cacheFrames, view.projection);
      probeState.utilities = useRotoKeyUtilities({
        currentFrame,
        realKeyFrames: projectedFrames,
        cachedRotoFrames: cacheFrames,
        dirtyFrames: new Set(),
        canvasSize: { width: 1000, height: 650 },
        applyStatus: 'idle',
        flushInFlight: false,
        buildBlankRotoFrame: (frame) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' }),
        resolveSourceFrameForDisplayFrame: (candidate) => view.projection.realKeys.find((key) => key.displayFrame === candidate)?.sourceFrame ?? candidate,
        resolvePasteTargetForDisplayFrame: (candidate) => resolveRotoRealKeySaveTarget(view.model, candidate),
        segmentSpacingOverrides: liveSettings.segmentSpacingOverrides,
        getEditableStates: () => new Map(), setEditableStates: () => {}, getPreviewFrames: () => new Map(), setPreviewFrames: () => {},
        getEditableState: () => null, setDirtyFrames: () => {}, syncPendingRotoFrames: () => {},
        syncRotoKeyFrameLists: (frames) => { if (frames) setCacheFrames([...frames]); },
        applyRotoKeyFrames: (transaction) => {
          const payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }> = {
            operationId: `debug-07-distant-${props.operation}`,
            kind: 'replace-roto-key-frames',
            layerId: 'phys-layer-1',
            startFrame: transaction.activeFrame,
            frames: transaction.realKeyFrames,
            rotoInterpolationSettings: { ...liveSettings, segmentSpacingOverrides: transaction.segmentSpacingOverrides },
          };
          const result = applyPhysicPaintPayload(payload);
          if (!result.ok) throw new Error(result.error ?? `Distant ${props.operation} transaction failed`);
          const refreshedSettings = physicPaintStore.getRotoInterpolationSettings('phys-layer-1');
          const refreshedFrames = physicPaintStore.getRotoCacheFrames('phys-layer-1');
          publications.push({
            selectedDisplayFrame: currentFrame,
            resolvedSourceFrame: view.projection.realKeys.find((key) => key.displayFrame === currentFrame)?.sourceFrame ?? currentFrame,
            sourceFrames: physicPaintStore.getRealRotoKeyFrames('phys-layer-1'),
            paintBySource: transaction.realKeyFrames.map((frame) => [frame.sourceFrame ?? frame.appFrame, frame.dataUrl]),
            overrides: [...(refreshedSettings.segmentSpacingOverrides ?? [])],
            realDisplayFrames: refreshedFrames.filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame ?? frame.appFrame),
            generatedFrames: refreshedFrames.filter((frame) => frame.source === 'generated-interpolation').map((frame) => frame.appFrame),
          });
          setLiveSettings(refreshedSettings);
          setCacheFrames(refreshedFrames);
          return refreshedFrames;
        },
        persistRotoKeyFrameTransaction: async () => {}, handleSaveFrameEffect: async () => true,
        restoreFrame: () => {}, clearCanvas: () => {}, showCachedReference: () => {}, navigate: async (frame) => { setCurrentFrame(frame); },
        clearGeneratedFrame: () => {}, clearCachedReferenceFrame: () => {}, clearDeletedFrame: () => {},
        setApplyMessage: () => {}, setApplyStatus: () => {}, setLastError: () => {}, snapshotCurrentRotoFrame: () => {}, setRotoSavingFrame: () => {},
      });
      const availability = probeState.utilities.session.actionAvailability.value;
      return h(PhysicsPaintWorkflowStrip, {
        mode: 'roto', currentFrame, startFrame: 0, frameCount: 1, isPlaying: false, ready: true,
        occupiedRotoFrames: projectedFrames.map((frame) => frame.appFrame), savedRotoFrames: projectedFrames.map((frame) => ({ frame: frame.appFrame, saved: true })),
        cachedRotoFrames: projectedFrames, editableRotoFrames: [], pendingRotoFrames: [], rotoInterpolationSettings: liveSettings,
        onion: { enabled: false, previous: true, next: false, count: 1, opacity: 50 },
        onInsertRotoFrame: probeState.utilities.insertBlankKey, onDeleteRotoFrame: probeState.utilities.deleteKey,
        onDuplicateRotoKey: probeState.utilities.duplicateKey,
        rotoKeyState: { actionAvailability: availability, hasCopiedRotoKey: false },
        onSaveRotoFrame: () => {}, onSavePendingRotoFrames: () => {}, onSavePlay: () => {}, onFrameCountChange: () => {}, onPlayPreview: () => {}, onStopPreview: () => {},
        onNavigateToSyncedFrame: setCurrentFrame, onGoToFirstFrame: () => {}, onGoToPreviousFrame: () => {}, onGoToNextFrame: () => {}, onGoToLastFrame: () => {},
        onInspectPlayFrame: () => {}, onOnionChange: () => {},
      });
    }

    const root = createTestRoot();
    render(h(Probe, { initialFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'), initialSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'), operation: 'insert' }), root as unknown as Element);
    await flushPreact();
    fire(findRotoCell(root, 20)!, 'Click');
    await flushPreact();
    fire(findButton(root, 'Insert blank Roto key before frame 20')!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(publications[0]).toEqual({
      selectedDisplayFrame: 20,
      resolvedSourceFrame: 20,
      sourceFrames: [0, 1, 2, 3, 20, 21],
      paintBySource: [
        [0, originalPaint.get(0)], [1, originalPaint.get(1)], [2, originalPaint.get(2)], [3, originalPaint.get(3)],
        [20, savedDataUrl], [21, originalPaint.get(20)],
      ],
      overrides: [{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }],
      realDisplayFrames: [0, 3, 6, 9, 20, 23],
      generatedFrames: [1, 2, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22],
    });
    expect(findRotoCell(root, 20)).not.toBeNull();
    expect(findRotoCell(root, 23)).not.toBeNull();
    expect(probeState.utilities?.session.currentFrame.value).toBe(20);

    const insertedPath = '/debug-07-distant-insert';
    const insertedPersisted = await savePhysicPaintData(insertedPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    const insertedHydrated = await loadPhysicPaintData(insertedPath, insertedPersisted);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(insertedHydrated!);
    const insertedReopen = createPhysicPaintLaunchContext(physicLayer(), 20, null, null, 'roto');
    expect(insertedReopen.rotoInterpolationSettings?.segmentSpacingOverrides).toEqual([{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }]);
    expect(insertedReopen.cachedRotoFrames?.filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9, 20, 23]);
    expect(insertedReopen.cachedRotoFrames?.find((frame) => frame.sourceFrame === 20)?.dataUrl).toBe(savedDataUrl);
    expect(insertedReopen.cachedRotoFrames?.find((frame) => frame.sourceFrame === 21)?.dataUrl).toBe(originalPaint.get(20));

    await act(async () => {
      render(null as unknown as VNode, root as unknown as Element);
      await flushPreact();
    });
    probeState.utilities = null;
    render(h(Probe, { initialFrames: insertedReopen.cachedRotoFrames ?? [], initialSettings: insertedReopen.rotoInterpolationSettings!, operation: 'delete' }), root as unknown as Element);
    await flushPreact();
    fire(findRotoCell(root, 20)!, 'Click');
    await flushPreact();
    fire(findButton(root, 'Delete Roto key at frame 20')!, 'Click');
    await flushPreact();
    await flushPreact();

    expect(publications[1]).toEqual({
      selectedDisplayFrame: 20,
      resolvedSourceFrame: 20,
      sourceFrames: [0, 1, 2, 3, 20],
      paintBySource: [
        [0, originalPaint.get(0)], [1, originalPaint.get(1)], [2, originalPaint.get(2)], [3, originalPaint.get(3)], [20, originalPaint.get(20)],
      ],
      overrides: [{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }],
      realDisplayFrames: [0, 3, 6, 9, 20],
      generatedFrames: [1, 2, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    });

    const deletedPath = '/debug-07-distant-delete';
    const deletedPersisted = await savePhysicPaintData(deletedPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    const deletedHydrated = await loadPhysicPaintData(deletedPath, deletedPersisted);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(deletedHydrated!);
    const deletedReopen = createPhysicPaintLaunchContext(physicLayer(), 20, null, null, 'roto');
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, 20]);
    expect(physicPaintStore.getFrame('phys-layer-1', 20)?.dataUrl).toBe(originalPaint.get(20));
    expect(deletedReopen.rotoInterpolationSettings?.segmentSpacingOverrides).toEqual([{ fromSourceFrame: 3, toSourceFrame: 20, inBetweenCount: 10 }]);
    expect(deletedReopen.cachedRotoFrames?.filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9, 20]);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', { enabled: false });
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 1, 2, 3, 20]);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', { enabled: true });
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9, 20]);
  });

  it('refreshes rendered Copy and Delete availability immediately after Paste and Delete without awaiting persistence completion', async () => {
    installDom('', () => {});
    const copiedPaint = pngDataUrl('debug-05-post-paste-copy');
    const initialFrames = [0, 1, 2, 3].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: frame === 3 ? copiedPaint : pngDataUrl(`debug-05-post-paste-${frame}`),
      width: 1000,
      height: 650,
    }));
    const settings: PhysicPaintRotoInterpolationSettings = { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 };
    let resolvePersistence!: () => void;
    const persistencePending = new Promise<void>((resolve) => { resolvePersistence = resolve; });
    const probeState: { utilities: RotoKeyUtilities | null } = { utilities: null };

    function Probe() {
      const [currentFrame, setCurrentFrame] = useState(9);
      const [cacheFrames, setCacheFrames] = useState<PhysicPaintRotoCacheFrame[]>(initialFrames);
      const view = selectRotoTimelineView({ cachedRotoFrames: cacheFrames, currentFrame, interpolationSettings: settings });
      const projectedFrames = selectProjectedRealCachedRotoFrames(cacheFrames, view.projection);
      probeState.utilities = useRotoKeyUtilities({
        currentFrame,
        realKeyFrames: projectedFrames,
        cachedRotoFrames: cacheFrames,
        dirtyFrames: new Set(),
        canvasSize: { width: 1000, height: 650 },
        applyStatus: 'idle',
        flushInFlight: false,
        buildBlankRotoFrame: (frame) => ({ ...buildBlankRotoFrame(1000, 650, frame), source: 'real-key' }),
        resolveSourceFrameForDisplayFrame: (displayFrame) => view.projection.realKeys.find((key) => key.displayFrame === displayFrame)?.sourceFrame ?? displayFrame,
        resolvePasteTargetForDisplayFrame: (displayFrame) => resolveRotoRealKeySaveTarget(view.model, displayFrame),
        segmentSpacingOverrides: settings.segmentSpacingOverrides,
        getEditableStates: () => new Map(), setEditableStates: () => {}, getPreviewFrames: () => new Map(), setPreviewFrames: () => {},
        getEditableState: () => null, setDirtyFrames: () => {}, syncPendingRotoFrames: () => {},
        syncRotoKeyFrameLists: (frames) => { if (frames) setCacheFrames([...frames]); },
        applyRotoKeyFrames: (transaction) => transaction.realKeyFrames,
        persistRotoKeyFrameTransaction: () => persistencePending,
        handleSaveFrameEffect: async () => true, restoreFrame: () => {}, clearCanvas: () => {}, showCachedReference: () => {},
        navigate: async (frame) => { setCurrentFrame(frame); }, clearGeneratedFrame: () => {}, clearCachedReferenceFrame: () => {}, clearDeletedFrame: () => {},
        setApplyMessage: () => {}, setApplyStatus: () => {}, setLastError: () => {}, snapshotCurrentRotoFrame: () => {}, setRotoSavingFrame: () => {},
      });
      const availability = probeState.utilities.session.actionAvailability.value;
      return h(PhysicsPaintWorkflowStrip, {
        mode: 'roto', currentFrame, startFrame: 0, frameCount: 1, isPlaying: false, ready: true,
        occupiedRotoFrames: projectedFrames.map((frame) => frame.appFrame), savedRotoFrames: projectedFrames.map((frame) => ({ frame: frame.appFrame, saved: true })),
        cachedRotoFrames: projectedFrames, editableRotoFrames: [], pendingRotoFrames: [], rotoInterpolationSettings: settings,
        onion: { enabled: false, previous: true, next: false, count: 1, opacity: 50 },
        onCopyRotoFrame: probeState.utilities.copyKey, onPasteRotoFrame: probeState.utilities.pasteKey,
        onDeleteRotoFrame: probeState.utilities.deleteKey, hasCopiedRotoKey: probeState.utilities.session.copiedKey.value !== null,
        rotoKeyState: { actionAvailability: availability, hasCopiedRotoKey: probeState.utilities.session.copiedKey.value !== null },
        onSaveRotoFrame: () => {}, onSavePendingRotoFrames: () => {}, onSavePlay: () => {}, onFrameCountChange: () => {}, onPlayPreview: () => {}, onStopPreview: () => {},
        onNavigateToSyncedFrame: setCurrentFrame, onGoToFirstFrame: () => {}, onGoToPreviousFrame: () => {}, onGoToNextFrame: () => {}, onGoToLastFrame: () => {},
        onInspectPlayFrame: () => {}, onOnionChange: () => {},
      });
    }

    const root = createTestRoot();
    render(h(Probe, {}), root as unknown as Element);
    await flushPreact();
    fire(findButton(root, 'Copy Roto key at frame 9')!, 'Click');
    await flushPreact();
    fire(findRotoCell(root, 12)!, 'Click');
    await flushPreact();
    fire(findButton(root, 'Paste Roto key to frame 12')!, 'Click');
    await flushPreact();

    fire(findRotoCell(root, 9)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 9')?.getAttribute('disabled')).toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 9')?.getAttribute('disabled')).toBeNull();
    fire(findRotoCell(root, 8)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 8')?.getAttribute('disabled')).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 8')?.getAttribute('disabled')).not.toBeNull();
    fire(findRotoCell(root, 15)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Paste Roto key to frame 15')?.getAttribute('disabled')).toBeNull();

    fire(findRotoCell(root, 9)!, 'Click');
    await flushPreact();
    fire(findButton(root, 'Delete Roto key at frame 9')!, 'Click');
    await flushPreact();
    fire(findRotoCell(root, 6)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 6')?.getAttribute('disabled')).toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 6')?.getAttribute('disabled')).toBeNull();
    fire(findRotoCell(root, 5)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 5')?.getAttribute('disabled')).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 5')?.getAttribute('disabled')).not.toBeNull();
    fire(findRotoCell(root, 15)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 15')?.getAttribute('disabled')).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 15')?.getAttribute('disabled')).not.toBeNull();

    resolvePersistence();
    await flushPreact();
  });

  it('registers the launch listener before stored context resolves and preserves the newer event', async () => {
    installDom('', () => {});
    const storedContext: PhysicPaintLaunchContext = {
      operationId: 'debug-05-stored-context',
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: 6,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
    };
    const eventContext: PhysicPaintLaunchContext = {
      ...storedContext,
      operationId: 'debug-05-event-context',
      startFrame: 9,
    };
    let resolveStoredLaunchContext!: (context: PhysicPaintLaunchContext | null) => void;
    paintHarness.storedLaunchContextPromise = new Promise((resolve) => { resolveStoredLaunchContext = resolve; });
    const appliedContexts: PhysicPaintLaunchContext[] = [];
    const { usePhysicsPaintLaunchBridge } = await import('../components/physic-paint/bridge/usePhysicsPaintParentBridge');

    function Probe() {
      usePhysicsPaintLaunchBridge((context) => { appliedContexts.push(context); });
      return h('div', { 'data-testid': 'launch-bridge-probe' });
    }

    const root = createTestRoot();
    await act(async () => {
      render(h(Probe, {}), root as unknown as Element);
      await flushPreact();
    });
    for (let attempt = 0; attempt < 10 && paintHarness.launchListeners.length === 0; attempt += 1) {
      await flushPreact();
    }

    expect(paintHarness.launchListeners).toHaveLength(1);
    paintHarness.launchListeners[0]({ payload: eventContext });
    expect(appliedContexts).toEqual([eventContext]);

    resolveStoredLaunchContext(storedContext);
    await flushPreact();
    expect(appliedContexts).toEqual([eventContext]);

    await act(async () => {
      render(null as unknown as VNode, root as unknown as Element);
      await flushPreact();
    });
    expect(paintHarness.launchListeners).toHaveLength(0);
  });

  it('renders immediate Copy and Delete availability after selecting a real projected key, while generated and empty frames stay disabled', async () => {
    const sourceFrames = [0, 1, 2, 3].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: pngDataUrl(`debug-05-native-navigation-source-${frame}`),
      width: 1000,
      height: 650,
    }));
    for (const frame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.appFrame, frame);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });
    const makeLaunchContext = (startFrame: number): PhysicPaintLaunchContext => ({
      operationId: `debug-05-native-navigation-${startFrame}`,
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
      cachedRotoFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'),
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
    });
    const fullLaunchContext = makeLaunchContext(6);
    paintHarness.storedLaunchContext = fullLaunchContext;
    const { root } = installDom(encodeURIComponent(JSON.stringify(fullLaunchContext)), () => {});
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');

    await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));
    fire(findRotoCell(root, 9)!, 'Click');
    await flushPreact();

    expect(findButton(root, 'Copy Roto key at frame 9'), visibleText(root)).not.toBeNull();
    expect(findButton(root, 'Copy Roto key at frame 9')?.getAttribute('disabled')).toBeNull();
    expect(findButton(root, 'Duplicate Roto key at frame 9')?.getAttribute('disabled')).toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 9')?.getAttribute('disabled')).toBeNull();
    fire(findRotoCell(root, 8)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 8')?.getAttribute('disabled')).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 8')?.getAttribute('disabled')).not.toBeNull();
    fire(findRotoCell(root, 12)!, 'Click');
    await flushPreact();
    expect(findButton(root, 'Copy Roto key at frame 12')?.getAttribute('disabled')).not.toBeNull();
    expect(findButton(root, 'Delete Roto key at frame 12')?.getAttribute('disabled')).not.toBeNull();

    const reopened = selectRotoTimelineView({
      cachedRotoFrames: makeLaunchContext(9).cachedRotoFrames,
      currentFrame: 9,
      interpolationSettings: makeLaunchContext(9).rotoInterpolationSettings,
    });
    expect(reopened.projection.realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9]);
    expect(reopened.currentFrameIsGenerated).toBe(false);
  });

  it.each([
    { targetFrame: 12, expectedOverrides: [] },
    { targetFrame: 14, expectedOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }] },
  ])('publishes rendered Studio Paste target $targetFrame with canonical timing through reopen', async ({ targetFrame, expectedOverrides }) => {
    const sourcePaint = pngDataUrl(`rendered-studio-paste-${targetFrame}`);
    const sourceFrames = [0, 1, 2, 3].map((frame) => ({
      frameIndex: 0,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: frame === 3 ? sourcePaint : pngDataUrl(`rendered-studio-source-${frame}`),
      width: 1000,
      height: 650,
    }));
    for (const frame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.appFrame, frame);
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });
    const launchContext: PhysicPaintLaunchContext = {
      operationId: `debug-04-rendered-studio-${targetFrame}`,
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: 9,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
      cachedRotoFrames: physicPaintStore.getRotoCacheFrames('phys-layer-1'),
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
    };
    const applyPayloads: PhysicPaintApplyPayload[] = [];
    const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
      if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
      applyPayloads.push(message.payload);
      const result = applyPhysicPaintPayload(message.payload);
      window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
    });
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');
    paintHarness.storedLaunchContext = launchContext;

    await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));
    fire(findRotoCell(root, 9)!, 'Click');
    await act(async () => {
      await flushPreact();
    });
    const copyButton = findButton(root, 'Copy Roto key at frame 9');
    expect(copyButton?.getAttribute('disabled')).toBeNull();
    fire(copyButton!, 'Click');
    await flushPreact();
    fire(findRotoCell(root, targetFrame)!, 'Click');
    await flushPreact();
    const pasteButton = findButton(root, `Paste Roto key to frame ${targetFrame}`);
    expect(pasteButton?.getAttribute('disabled')).toBeNull();
    fire(pasteButton!, 'Click');
    await flushPreact();
    await flushPreact();

    const replacement = applyPayloads.find((payload): payload is Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }> => payload.kind === 'replace-roto-key-frames');
    expect(replacement).toBeTruthy();
    expect(replacement?.frames.map((frame) => frame.sourceFrame ?? frame.appFrame)).toEqual([0, 1, 2, 3, targetFrame]);
    expect(replacement?.frames.find((frame) => (frame.sourceFrame ?? frame.appFrame) === targetFrame)?.dataUrl).toBe(sourcePaint);
    expect(replacement?.rotoInterpolationSettings).toMatchObject({
      enabled: true,
      inBetweenCount: 2,
    });
    expect(replacement?.rotoInterpolationSettings?.segmentSpacingOverrides ?? []).toEqual(expectedOverrides);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, targetFrame]);
    expect(physicPaintStore.getFrame('phys-layer-1', targetFrame)?.dataUrl).toBe(sourcePaint);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1').segmentSpacingOverrides ?? []).toEqual(expectedOverrides);
    expect(findRotoCell(root, targetFrame)).not.toBeNull();

    const projectPath = `/debug-04-rendered-studio-${targetFrame}`;
    const persistedOutputs = await savePhysicPaintData(projectPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    const persisted = persistedOutputs[0] as McePhysicPaintOutput;
    expect(persisted.roto_interpolation_settings?.segmentSpacingOverrides ?? []).toEqual(expectedOverrides);
    const hydratedOutputs = await loadPhysicPaintData(projectPath, persistedOutputs);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(hydratedOutputs!);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1').segmentSpacingOverrides ?? []).toEqual(expectedOverrides);
    const reopenContext = createPhysicPaintLaunchContext(physicLayer(), targetFrame, null, null, 'roto');
    const reopenedOn = selectRotoTimelineView({
      cachedRotoFrames: reopenContext.cachedRotoFrames ?? [],
      currentFrame: targetFrame,
      interpolationSettings: { ...reopenContext.rotoInterpolationSettings!, enabled: true },
    });
    expect(reopenedOn.projection.realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, targetFrame]);
    const reopenedOff = selectRotoTimelineView({
      cachedRotoFrames: reopenContext.cachedRotoFrames ?? [],
      currentFrame: targetFrame,
      interpolationSettings: { ...reopenContext.rotoInterpolationSettings!, enabled: false },
    });
    expect(reopenedOff.projection.realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, targetFrame]);
  });

  it.each([
    { label: 'OFF', enabled: false, payloadLabel: 'off-start-unique-saved-paint' },
    { label: 'ON', enabled: true, payloadLabel: 'on-start-unique-saved-paint' },
  ])('preserves far Save paint identity through the $label-start Studio controller and durable reopen path', async ({ label, enabled, payloadLabel }) => {
    const uniqueSavedDataUrl = pngDataUrl(payloadLabel);
    const initialDataUrls = new Map([0, 1, 2, 3, 14].map((frame) => [frame, pngDataUrl(`${label.toLowerCase()}-start-initial-source-${frame}`)]));
    const realKeyFrames = [0, 1, 2, 3, 14].map((frame) => ({
      frameIndex: frame,
      appFrame: frame,
      sourceFrame: frame,
      displayFrame: frame,
      source: 'real-key' as const,
      dataUrl: initialDataUrls.get(frame)!,
      width: 1000,
      height: 650,
    }));
    for (const frame of realKeyFrames) {
      physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', frame.sourceFrame, frame);
    }
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
      enabled,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });

    const launchContext: PhysicPaintLaunchContext = {
      operationId: `phase-36-13-debug-03-${label.toLowerCase()}-start`,
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: enabled ? 9 : 3,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
      cachedRotoFrames: realKeyFrames,
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1'),
    };
    const applyPayloads: PhysicPaintApplyPayload[] = [];
    const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
      if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
      applyPayloads.push(message.payload);
      const result = applyPhysicPaintPayload(message.payload);
      window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
    });
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');

    await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));

    expect(findButton(root, 'Go to next frame')).not.toBeNull();
    const navigationSteps = 14 - launchContext.startFrame;
    for (let step = 0; step < navigationSteps; step += 1) {
      const nextFrameButton = findButton(root, 'Go to next frame');
      expect(nextFrameButton).not.toBeNull();
      fire(nextFrameButton!, 'Click');
      await flushPreact();
    }
    expect(visibleText(root)).toContain('14');
    expect(isStudioEngineReady(root)).toBe(true);
    paintHarness.engine?.__setState(editedState, uniqueSavedDataUrl);

    const canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
    expect(canvasStack).toBeTruthy();
    fire(canvasStack!, 'PointerDown');
    await flushPreact();
    fire(findButton(root, 'Save current')!, 'Click');
    await flushPreact();

    expect(applyPayloads).toHaveLength(1);
    expect(applyPayloads[0]).toMatchObject({
      kind: 'apply-canvas',
      startFrame: 14,
      sourceFrame: 14,
      renderedFrame: {
        appFrame: 14,
        dataUrl: uniqueSavedDataUrl,
      },
      rotoInterpolationSettings: {
        enabled,
        inBetweenCount: 2,
        segmentSpacingOverrides: [
          { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
        ],
      },
    });
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, 14]);
    expect(physicPaintStore.getFrame('phys-layer-1', 14)?.dataUrl).toBe(uniqueSavedDataUrl);
    expect(physicPaintStore.getFrame('phys-layer-1', 5)).toBeNull();
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(initialDataUrls.get(3));
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).not.toBe(uniqueSavedDataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1')).toMatchObject({
      enabled,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });

    const projectPath = `/project-${label.toLowerCase()}`;
    const persistedOutputs = await savePhysicPaintData(projectPath, physicPaintStore.toMceOutputs() as RuntimePhysicPaintOutput[]);
    const persisted = persistedOutputs[0] as McePhysicPaintOutput;
    expect(persisted.roto_interpolation_settings).toMatchObject({
      enabled,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });
    const hydratedOutputs = await loadPhysicPaintData(projectPath, persistedOutputs);
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(hydratedOutputs!);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([0, 1, 2, 3, 14]);
    expect(physicPaintStore.getFrame('phys-layer-1', 14)?.dataUrl).toBe(uniqueSavedDataUrl);
    expect(physicPaintStore.getFrame('phys-layer-1', 5)).toBeNull();
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(initialDataUrls.get(3));
    expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).not.toBe(uniqueSavedDataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1')).toMatchObject({
      enabled,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });

    const reopenContext = createPhysicPaintLaunchContext(physicLayer(), 14, null, null, 'roto');
    expect(reopenContext.rotoInterpolationSettings).toMatchObject({
      enabled,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });
    const reopenedSourceFrame = reopenContext.cachedRotoFrames?.find((frame) => frame.source === 'real-key' && frame.sourceFrame === 14);
    expect(reopenedSourceFrame).toMatchObject({
      appFrame: 14,
      sourceFrame: 14,
      displayFrame: 14,
      dataUrl: uniqueSavedDataUrl,
    });
    expect(reopenContext.cachedRotoFrames?.filter((frame) => frame.source === 'real-key' && frame.dataUrl === uniqueSavedDataUrl)).toEqual([reopenedSourceFrame]);
    expect(reopenContext.cachedRotoFrames?.find((frame) => frame.sourceFrame === 3)?.dataUrl).toBe(initialDataUrls.get(3));

    const reopenedTimeline = selectRotoTimelineView({
      cachedRotoFrames: reopenContext.cachedRotoFrames ?? [],
      currentFrame: 14,
      interpolationSettings: {
        ...reopenContext.rotoInterpolationSettings!,
        enabled: true,
      },
    });
    expect(reopenedTimeline.model.realSourceFrames).toEqual([0, 1, 2, 3, 14]);
    expect(reopenedTimeline.projection.realKeys.map((key) => ({ sourceFrame: key.sourceFrame, displayFrame: key.displayFrame }))).toEqual([
      { sourceFrame: 0, displayFrame: 0 },
      { sourceFrame: 1, displayFrame: 3 },
      { sourceFrame: 2, displayFrame: 6 },
      { sourceFrame: 3, displayFrame: 9 },
      { sourceFrame: 14, displayFrame: 14 },
    ]);
    expect(reopenedTimeline.projection.realKeys.find((key) => key.displayFrame === 14)?.sourceFrame).toBe(14);
    expect(reopenedSourceFrame?.dataUrl).toBe(uniqueSavedDataUrl);
  });

  describe('Debug 08 native onion contract', () => {
    const sourcePaint = new Map<number, string>([
      [0, pngDataUrl('debug-08-onion-A')],
      [1, pngDataUrl('debug-08-onion-B')],
      [2, pngDataUrl('debug-08-onion-C')],
      [3, pngDataUrl('debug-08-onion-D')],
      [14, pngDataUrl('debug-08-onion-E')],
      [26, pngDataUrl('debug-08-onion-F')],
    ]);

    async function mountOnionStudio(startFrame: number, options: { sourceFrames?: readonly number[]; interpolationEnabled?: boolean; previous?: boolean; next?: boolean; opacity?: number } = {}) {
      const sourceFrames = options.sourceFrames ?? Array.from(sourcePaint.keys());
      for (const sourceFrame of sourceFrames) {
        const dataUrl = sourcePaint.get(sourceFrame)!;
        physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', sourceFrame, {
          frameIndex: 0,
          appFrame: sourceFrame,
          dataUrl,
          width: 1000,
          height: 650,
        });
      }
      physicPaintStore.setRotoInterpolationSettings('phys-layer-1', {
        enabled: options.interpolationEnabled ?? true,
        inBetweenCount: 2,
        mode: 'duplicate',
        deform: 0,
        position: 0,
        segmentSpacingOverrides: [
          { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
          { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
        ],
      });
      const launchContext = createPhysicPaintLaunchContext(physicLayer(), startFrame, { width: 1000, height: 650 }, null, 'roto');
      paintHarness.storedLaunchContext = launchContext;
      const applyPayloads: PhysicPaintApplyPayload[] = [];
      const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
        if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
        applyPayloads.push(message.payload);
        const result = applyPhysicPaintPayload(message.payload);
        window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
      });
      const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');
      await mountStudioReady(root, () => h(PhysicsPaintStudio, {}));
      fire(findButton(root, 'ONION')!, 'Click');
      await act(async () => { await flushPreact(); });
      const findOnionToggles = () => {
        const onionPanel = queryAll(root, (element) => hasClass(element, 'physics-paint-onion-tab-panel'))[0];
        return queryAll(onionPanel, (element) => element.localName === 'input' && element.getAttribute('type') === 'checkbox');
      };
      const onionToggle = findOnionToggles()[0];
      (onionToggle as unknown as { checked: boolean }).checked = true;
      fire(onionToggle, 'Change');
      await act(async () => { await flushPreact(); });
      if (options.next !== undefined) {
        const nextToggle = findOnionToggles()[2];
        (nextToggle as unknown as { checked: boolean }).checked = options.next;
        fire(nextToggle, 'Change');
        await act(async () => { await flushPreact(); });
      }
      if (options.previous === false) {
        const previousToggle = findOnionToggles()[1];
        (previousToggle as unknown as { checked: boolean }).checked = false;
        fire(previousToggle, 'Change');
        await act(async () => { await flushPreact(); });
      }
      if (options.opacity !== undefined) fireInput(findInput(root, 'physics-onion-opacity')!, String(options.opacity));
      await act(async () => { await flushPreact(); });
      return { root, launchContext, applyPayloads };
    }

    it.each([
      { label: 'before the first key', display: 0, sourceFrames: [3, 14, 26], expectedOnions: [3] },
      { label: 'between real keys while interpolation is off', display: 10, sourceFrames: [0, 1, 2, 3, 14, 26], expectedOnions: [3, 14] },
      { label: 'after the final key', display: 27, sourceFrames: [0, 1, 2, 3, 14, 26], expectedOnions: [26] },
    ])('shows surrounding real onions at an empty selected display without creating a durable key: $label', async ({ display, sourceFrames, expectedOnions }) => {
      const { root, applyPayloads } = await mountOnionStudio(display, { sourceFrames, interpolationEnabled: false, next: true });

      expect(onionImageSnapshot(root).map((image) => image.src)).toEqual(expectedOnions.map((sourceFrame) => sourcePaint.get(sourceFrame)));
      expect(paintHarness.engine?.setPreviewBaseImageUrl).not.toHaveBeenCalled();
      expect(applyPayloads).toEqual([]);
      expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual(sourceFrames);
      expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').some((frame) => frame.appFrame === display)).toBe(false);
    });

    it.each([
      { label: 'generated', display: 4, interpolationEnabled: true },
      { label: 'empty', display: 10, interpolationEnabled: false },
    ])('keeps a $label selected display non-durable after mounted paint and Save current intent', async ({ label, display, interpolationEnabled }) => {
      const { root, applyPayloads } = await mountOnionStudio(display, { interpolationEnabled, next: true });
      const durableBefore = physicPaintStore.getRealRotoKeyFrames('phys-layer-1');
      paintHarness.engine?.__setState(editedState, pngDataUrl(`debug-08-${label}-mutation-attempt`));
      const canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
      expect(canvasStack).toBeTruthy();

      fire(canvasStack!, 'PointerDown');
      await act(async () => { await flushPreact(); });
      fire(findButton(root, 'Save current')!, 'Click');
      await act(async () => { await flushPreact(); });

      expect(applyPayloads).toEqual([]);
      expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual(durableBefore);
      expect(physicPaintStore.getRotoCacheFrames('phys-layer-1').some((frame) => frame.appFrame === display && frame.source === 'real-key')).toBe(false);
    });

    it('keeps a source-keyed edited real payload from becoming its own mounted previous onion anchor', async () => {
      const { root } = await mountOnionStudio(3);
      const editedB = pngDataUrl('debug-08-onion-B-edited');
      paintHarness.engine?.__setState(editedState, editedB);
      const canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
      expect(canvasStack).toBeTruthy();
      fire(canvasStack!, 'PointerDown');
      await act(async () => { await flushPreact(); });
      fire(findButton(root, 'Save current')!, 'Click');
      await act(async () => { await flushPreact(); });

      expect(onionImageSnapshot(root).map((image) => image.src)).toEqual([sourcePaint.get(0)]);
      expect(onionImageSnapshot(root).map((image) => image.src)).not.toContain(editedB);
    });

    it('keeps a short projected previous real anchor through the mounted Studio path', async () => {
      const { root } = await mountOnionStudio(6);
      expect(onionImageSnapshot(root)).toEqual([
        expect.objectContaining({ src: sourcePaint.get(1) }),
      ]);
    });

    it('keeps the nearest distant previous real anchor across the custom generated span', async () => {
      const { root } = await mountOnionStudio(14);
      expect(onionImageSnapshot(root)).toEqual([
        expect.objectContaining({ src: sourcePaint.get(3) }),
      ]);
    });

    it.each([
      { display: 4, owner: 1, previous: 0, next: 2 },
      { display: 12, owner: 3, previous: 2, next: 14 },
      { display: 20, owner: 14, previous: 3, next: 26 },
    ])('makes generated display $display use owner $owner as the onion traversal pivot', async ({ display, owner, previous, next }) => {
      const { root, launchContext } = await mountOnionStudio(display, { next: true });
      const generated = launchContext.cachedRotoFrames?.find((frame) => frame.appFrame === display && frame.source === 'generated-interpolation');
      expect(generated?.dataUrl).toBe(sourcePaint.get(owner));
      expect(projectRotoOnionPreviewFrames({
        currentFrame: display,
        currentFrameOwnerSourceFrame: generated?.fromSourceFrame,
        isPlaying: false,
        onion: { enabled: true, previous: true, next: true, count: 1, opacity: 30 },
        launchFrames: launchContext.cachedRotoFrames,
        storeFrames: physicPaintStore.getRotoCacheFrames(launchContext.layerId),
      }).map((frame) => frame.dataUrl)).toEqual([
        sourcePaint.get(previous),
        sourcePaint.get(next),
      ]);
      expect(paintHarness.engine?.setPreviewBaseImageUrl).toHaveBeenCalledWith(generated?.dataUrl);
      const onionPanel = queryAll(root, (element) => hasClass(element, 'physics-paint-onion-tab-panel'))[0];
      const onionToggle = queryAll(onionPanel, (element) => element.localName === 'input' && element.getAttribute('type') === 'checkbox')[0];
      expect((onionToggle as unknown as { checked: boolean }).checked).toBe(true);
      expect(onionImageSnapshot(root)).toEqual([
        expect.objectContaining({ src: sourcePaint.get(previous) }),
        expect.objectContaining({ src: sourcePaint.get(next) }),
      ]);
      expect(onionImageSnapshot(root).map((image) => image.src)).not.toContain(sourcePaint.get(owner));
      expect(onionImages(root).every((image) => !image.className.includes('generated-interpolation'))).toBe(true);
    });

    it('respects Previous-only, Next-only, and both at the mounted control boundary', async () => {
      const previousOnly = await mountOnionStudio(14);
      expect(onionImageSnapshot(previousOnly.root).map((image) => image.src)).toEqual([sourcePaint.get(3)]);
      render(null as unknown as VNode, previousOnly.root as unknown as Element);

      const nextOnly = await mountOnionStudio(14, { previous: false, next: true });
      expect(onionImageSnapshot(nextOnly.root).map((image) => image.src)).toEqual([sourcePaint.get(26)]);
      render(null as unknown as VNode, nextOnly.root as unknown as Element);

      const both = await mountOnionStudio(14, { next: true });
      expect(onionImageSnapshot(both.root).map((image) => image.src)).toEqual([sourcePaint.get(3), sourcePaint.get(26)]);
    });

    it.each([
      { opacity: 0, expected: '0' },
      { opacity: 30, expected: '0.15' },
      { opacity: 100, expected: '0.5' },
    ])('applies onion opacity $opacity to overlay alpha only', async ({ opacity, expected }) => {
      const { root, launchContext } = await mountOnionStudio(14, { opacity });
      const beforePayload = launchContext.cachedRotoFrames?.find((frame) => frame.source === 'real-key' && frame.sourceFrame === 3)?.dataUrl;
      expect(onionImageSnapshot(root)[0]).toEqual(expect.objectContaining({ src: beforePayload, style: expect.stringContaining(expected) }));
      expect(physicPaintStore.getFrame('phys-layer-1', 3)?.dataUrl).toBe(beforePayload);
    });

    it('retains parent Onion Value opacity across close and reopen', async () => {
      const first = await mountOnionStudio(14, { opacity: 67 });
      expect(onionImageSnapshot(first.root)[0]?.style).toContain('0.335');
      render(null as unknown as VNode, first.root as unknown as Element);
      await flushPreact();

      const reopened = await mountOnionStudio(14);
      expect(onionImageSnapshot(reopened.root)[0]?.style).toContain('0.335');
    });
  });

  it('preserves adjacent real-key alpha caches when background-only support is computed for a gap', () => {
    installDom('', () => {});
    const realKeyTwo = pngDataUrl('alpha-only-real-key-2');
    const realKeySix = pngDataUrl('alpha-only-real-key-6');

    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 2, { frameIndex: 0, appFrame: 2, dataUrl: realKeyTwo, width: 1000, height: 650 });
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 6, { frameIndex: 0, appFrame: 6, dataUrl: realKeySix, width: 1000, height: 650 });
    physicPaintStore.setRotoBackgroundMetadata('phys-layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });

    const beforeOutputs = structuredClone(physicPaintStore.toMceOutputs());
    const support = physicPaintStore.recomputeBackgroundOnlyRotoSupport('phys-layer-1', [4, 8]);

    expect(support).toEqual([expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true })]);
    expect(physicPaintStore.getFrame('phys-layer-1', 2)?.dataUrl).toBe(realKeyTwo);
    expect(physicPaintStore.getFrame('phys-layer-1', 6)?.dataUrl).toBe(realKeySix);
    expect(physicPaintStore.getRealRotoKeyFrames('phys-layer-1')).toEqual([2, 6]);
    expect(physicPaintStore.getFrame('phys-layer-1', 8)).toBeNull();
    expect(physicPaintStore.toMceOutputs()[0]?.frames.map((frame) => frame.appFrame)).toEqual([2, 4, 6]);
    expect(beforeOutputs[0]?.frames.map((frame) => frame.dataUrl)).toEqual([realKeyTwo, realKeySix]);
  });
});

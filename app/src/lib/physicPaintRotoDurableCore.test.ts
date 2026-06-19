import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore, _setPhysicPaintMarkDirtyCallback } from '../stores/physicPaintStore';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext } from '../types/physicPaint';
import type { McePhysicPaintOutput, RuntimePhysicPaintOutput } from '../types/project';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT, applyPhysicPaintPayload, createPhysicPaintLaunchContext } from './physicPaintBridge';
import { loadPhysicPaintData, savePhysicPaintData } from './physicPaintPersistence';

const fsMock = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  dirs: new Set<string>(),
}));

const paintHarness = vi.hoisted(() => ({
  engine: null as TestPaintEngine | null,
  storedLaunchContext: null as PhysicPaintLaunchContext | null,
  launchListeners: [] as Array<(event: { payload: unknown }) => void>,
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
  invoke: vi.fn(async (command: string) => command === 'get_physics_paint_launch_context' ? paintHarness.storedLaunchContext : null),
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
      hooks.useEffect(() => {
        if (!paintHarness.engine) throw new Error('test paint engine was not installed');
        props.onNativePenInputReady?.(() => {});
        props.onEngineReady?.(paintHarness.engine);
      }, []);
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
  getStrokeCount: () => number;
  setTool: (...args: unknown[]) => void;
  setPhysicsMode: (...args: unknown[]) => void;
  setColorHex: (...args: unknown[]) => void;
  setBrushOpacity: (...args: unknown[]) => void;
  setBrushSize: (...args: unknown[]) => void;
  setBgMode: (mode: string) => void;
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
    setProperty: (_key: string, _value: string) => {},
    removeProperty: (_key: string) => {},
  };
  private listeners = new Map<string, Set<(event: TestEvent) => void>>();

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
      createLinearGradient: vi.fn(() => gradient),
    } as unknown as CanvasRenderingContext2D;
  }

  toDataURL(): string {
    return savedDataUrl;
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
  opener: { postMessage: ReturnType<typeof vi.fn> } | null = null;
  private listeners = new Map<string, Set<(event: TestEvent) => void>>();

  constructor(document: TestDocument) {
    this.document = document;
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

function visibleText(root: TestElement): string {
  return root.textContent.replace(/\s+/g, ' ').trim();
}

function fire(element: TestElement, requestedType: string): void {
  const eventType = Array.from((element as unknown as { listeners?: Map<string, Set<(event: TestEvent) => void>> }).listeners?.keys() ?? [])
    .find((type) => type.toLowerCase() === requestedType.toLowerCase()) ?? requestedType;
  element.dispatchEvent(new TestEvent(eventType));
}

async function flushPreact(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('Phase 36.3 durable Roto cache core', () => {
  beforeEach(() => {
    fsMock.files.clear();
    fsMock.dirs.clear();
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    paintHarness.engine = makeEngine(editableState, savedDataUrl);
    paintHarness.storedLaunchContext = null;
    paintHarness.launchListeners = [];
    mockLayers([physicLayer()]);
  });

  afterEach(() => {
    render(null as unknown as VNode, new TestElement('div') as unknown as Element);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    physicPaintStore.reset();
    paintHarness.engine = null;
    paintHarness.storedLaunchContext = null;
    paintHarness.launchListeners = [];
  });

  it('saves one current Roto frame as durable cache, reopens it as reference, and discards later unsaved edits', async () => {
    const failures: string[] = [];
    const launchContext: PhysicPaintLaunchContext = {
      operationId: 'phase-36-3-test',
      layerId: 'phys-layer-1',
      layerName: 'Physic Paint',
      startFrame: 8,
      workflowMode: 'roto',
      editableSource: 'roto',
      width: 1000,
      height: 650,
    };
    const applyPayloads: PhysicPaintApplyPayload[] = [];
    const { root, window } = installDom(encodeURIComponent(JSON.stringify(launchContext)), (message) => {
      if (message.type !== PHYSIC_PAINT_APPLY_EVENT || !message.payload) return;
      applyPayloads.push(message.payload);
      const result = applyPhysicPaintPayload(message.payload);
      window.dispatchEvent(new TestEvent(PHYSIC_PAINT_APPLY_RESULT_EVENT, { detail: result }));
    });
    const { PhysicsPaintStudio } = await import('../components/physic-paint/PhysicsPaintStudio');

    render(h(PhysicsPaintStudio, {}), root as unknown as Element);
    await flushPreact();

    const canvasStack = queryAll(root, (element) => hasClass(element, 'physics-paint-canvas-stack'))[0];
    if (!canvasStack) failures.push('expected Physics Paint canvas stack to render');
    else fire(canvasStack, 'PointerDown');
    await flushPreact();

    const textBeforeSave = visibleText(root);
    if (!textBeforeSave.includes('Unsaved changes — click Save current to cache')) failures.push(`expected unsaved status copy before save, got: ${textBeforeSave}`);
    if (textBeforeSave.includes('Interpolation')) failures.push('expected interpolation controls to be hidden in the strict Phase 36.3 Roto surface');
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
    paintHarness.engine?.clear.mockClear();
    paintHarness.engine?.load.mockClear();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (paintHarness.launchListeners.length > 0) break;
      await flushPreact();
    }
    for (const listener of [...paintHarness.launchListeners]) listener({ payload: reopenContext });
    let reopenedText = visibleText(root);
    for (let attempt = 0; attempt < 5 && !reopenedText.includes('Cached reference'); attempt += 1) {
      await flushPreact();
      reopenedText = visibleText(root);
    }
    if (!reopenedText.includes('Cached reference')) failures.push(`expected relaunched Physics Paint to label frame 8 as a Cached reference, got: ${reopenedText}`);
    const backgroundCalls = paintHarness.engine?.setBackgroundImageUrl.mock.calls ?? [];
    if (backgroundCalls.some(([dataUrl]) => dataUrl === savedDataUrl)) failures.push(`expected relaunched Roto cached reference to stay out of the engine paper background; got background=${JSON.stringify(backgroundCalls)}`);
    if (!paintHarness.engine?.resetBackground.mock.calls.length) failures.push('expected relaunched Roto cached reference to reset stale engine background');
    if (!paintHarness.engine?.clear.mock.calls.length) failures.push('expected relaunched cached-only Roto reference to clear stale editable strokes before showing the overlay reference');
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
});

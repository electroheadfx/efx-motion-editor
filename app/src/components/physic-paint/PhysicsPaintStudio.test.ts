import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const studio = readFileSync(fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url)), 'utf8');
const studioView = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintStudioView.tsx', import.meta.url)), 'utf8');
const main = readFileSync(fileURLToPath(new URL('../../main.tsx', import.meta.url)), 'utf8');
const scriptsPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintScriptsPanel.tsx', import.meta.url)), 'utf8');
const rightPanel = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintRightPanel.tsx', import.meta.url)), 'utf8');
const toolRail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
const topBar = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintTopBar.tsx', import.meta.url)), 'utf8');
const playScriptDialog = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const memoizedTopBarPath = fileURLToPath(new URL('./view/MemoizedPhysicsPaintTopBar.ts', import.meta.url));
const memoizedTopBar = existsSync(memoizedTopBarPath) ? readFileSync(memoizedTopBarPath, 'utf8') : '';
const memoizedPlayScriptDialogPath = fileURLToPath(new URL('./view/MemoizedPhysicsPaintPlayScriptDialog.ts', import.meta.url));
const memoizedPlayScriptDialog = existsSync(memoizedPlayScriptDialogPath) ? readFileSync(memoizedPlayScriptDialogPath, 'utf8') : '';
const canvasMount = readFileSync(fileURLToPath(new URL('./engine/PhysicsPaintCanvasMount.tsx', import.meta.url)), 'utf8');
const engineLifecycle = readFileSync(fileURLToPath(new URL('./engine/usePhysicsPaintEngineLifecycle.ts', import.meta.url)), 'utf8');
const bridge = readFileSync(fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url)), 'utf8');
const types = readFileSync(fileURLToPath(new URL('../../types/physicPaint.ts', import.meta.url)), 'utf8');
const projectTypes = readFileSync(fileURLToPath(new URL('../../types/project.ts', import.meta.url)), 'utf8');
const store = readFileSync(fileURLToPath(new URL('../../stores/physicPaintStore.ts', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url)), 'utf8');

describe('Physics Paint Play Script integration contract', () => {
  it('wires focused Roto script, Play Script, and cached playback controllers', () => {
    expect(studio).toContain('useRotoScriptLibraryController');
    expect(studio).toContain('useRotoPlayScriptController');
    expect(studio).toContain('rotoCachedPlayback');
    expect(studio).toContain('applyPreparedScript(preparation)');
    expect(studio).toContain('activateAndLoad(selectedId, preparation)');
    expect(studio).not.toContain('renderFromStrokes');
  });

  it('installs the parent Roto authority listener in the app entry point', () => {
    expect(main).toContain('installPhysicPaintRotoAuthorityListener');
    expect(main).toContain('installPhysicPaintRotoAuthorityListener()');
    expect(bridge).toContain('PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT');
    expect(bridge).toContain('PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT');
  });

  it('keeps Save, Load/Paintbrush, Play Script, and cached Roto playback distinct', () => {
    const save = scriptsPanel.indexOf('label="Save Script"');
    const paintbrush = scriptsPanel.indexOf('label="Load and Apply Script"');
    const playScript = scriptsPanel.indexOf('label="Play Script"');
    expect(save).toBeGreaterThan(-1);
    expect(paintbrush).toBeGreaterThan(save);
    expect(playScript).toBeGreaterThan(paintbrush);
    expect(scriptsPanel).not.toContain('toggleRotoPlayback');
  });

  it('contains no obsolete separate Play workflow transport, persistence, launch, conversion, or CSS surface', () => {
    const production = [studio, bridge, types, projectTypes, store, css].join('\n');
    const obsolete = [
      ['apply', 'play', 'canvas'].join('-'), ['convert', 'play', 'to', 'roto'].join('-'), ['convert', 'roto', 'to', 'play'].join('-'), ['update', 'play', 'render', 'options'].join('-'),
      ['usePhysicsPaint', 'PlayCoordinator'].join(''), ['usePlay', 'EditCacheController'].join(''), ['usePlay', 'PreviewController'].join(''), ['useRotoPlay', 'ConversionController'].join(''),
      ['playScript', 'Ranges'].join(''), ['play', 'script', 'ranges'].join('_'), ['playStart', 'Frame'].join(''), ['playFrame', 'Count'].join(''), ['playRender', 'Options'].join(''), ['maxPlayFrame', 'Count'].join(''),
      ['physics', 'paint', 'play', 'range'].join('-'), ['physics', 'paint', 'workflow', 'tab--play'].join('-'), ['play', 'range', 'marker'].join('-'), ['play', 'conversion'].join('-'),
    ];
    for (const symbol of obsolete) expect(production).not.toContain(symbol);
  });

  it('retains authoritative replacement, new Play Script, and cached Roto playback names', () => {
    expect(types).toContain("kind: 'replace-roto-key-frames'");
    expect(studio).toContain('rotoPlayScript');
    expect(studio).toContain('rotoCachedPlayback');
  });
});

describe('Physics Paint Roto delete shortcut wiring', () => {
  it('shares the exact key utility delete reference with keyboard and visible-button paths', () => {
    expect(studio).toContain('deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,');
    expect(studio).toContain('onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame,');
  });

  it('advertises the approved Backspace and Delete shortcut copy', () => {
    expect(studioView).toContain('Backspace / Delete remove selected real key');
  });
});

function countOccurrences(source: string, literal: string): number {
  return source.split(literal).length - 1;
}

describe('Physics Paint navigation render localization', () => {
  it('uses dedicated compat wrappers while keeping TopBar and Play Script dialog plain', () => {
    expect(topBar).toContain('export function PhysicsPaintTopBar(');
    expect(playScriptDialog).toContain('export function PhysicsPaintPlayScriptDialog(');
    expect(memoizedTopBar).toContain("import { memo } from 'preact/compat';");
    expect(memoizedTopBar).toContain("import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';");
    expect(memoizedTopBar).toContain('export const MemoizedPhysicsPaintTopBar = memo(PhysicsPaintTopBar);');
    expect(memoizedPlayScriptDialog).toContain("import { memo } from 'preact/compat';");
    expect(memoizedPlayScriptDialog).toContain("import { PhysicsPaintPlayScriptDialog } from './PhysicsPaintPlayScriptDialog';");
    expect(memoizedPlayScriptDialog).toContain('export const MemoizedPhysicsPaintPlayScriptDialog = memo(PhysicsPaintPlayScriptDialog);');
    expect(studioView).toContain("import { MemoizedPhysicsPaintTopBar } from './MemoizedPhysicsPaintTopBar';");
    expect(studioView).toContain("import { MemoizedPhysicsPaintPlayScriptDialog } from './MemoizedPhysicsPaintPlayScriptDialog';");
    expect(studioView).toContain('<MemoizedPhysicsPaintTopBar {...topBar} />');
    expect(studioView).toContain('<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />');
    expect(studioView).not.toContain('<PhysicsPaintTopBar {...topBar} />');
    expect(studioView).not.toContain('<PhysicsPaintPlayScriptDialog {...playScriptDialog} />');
  });

  it('keeps TopBar and dialog props identity-stable on frame-only Studio renders', () => {
    expect(studio).toContain('const topBarPropsMemo = useRef(createIdentityMemo()).current;');
    expect(studio).toContain('const playScriptDialogPropsMemo = useRef(createIdentityMemo()).current;');
    const topBarStart = studio.indexOf('const topBar = topBarPropsMemo.resolve(');
    const topBarEnd = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(', topBarStart);
    const topBarBlock = studio.slice(topBarStart, topBarEnd);
    expect(topBarStart).toBeGreaterThanOrEqual(0);
    expect(topBarBlock).toContain('settings.size');
    expect(topBarBlock).toContain('readyToApply');
    expect(topBarBlock).toContain('staticControlsLocked');
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(topBarBlock).not.toContain(invalidator);

    const dialogStart = studio.indexOf('const playScriptDialog = playScriptDialogPropsMemo.resolve(');
    const dialogEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel', dialogStart);
    const dialogBlock = studio.slice(dialogStart, dialogEnd);
    expect(dialogStart).toBeGreaterThanOrEqual(0);
    expect(dialogBlock).toContain('[rotoPlayScript, playButtonRef]');
    for (const invalidator of ['currentFrame', 'startFrame', 'rotoNavigationGeneration']) expect(dialogBlock).not.toContain(invalidator);
  });

  it('preserves internal dialog Signal and focus-keyboard subscriptions beneath the memo', () => {
    expect(playScriptDialog).toContain('const confirmationOpen = playScript.confirmationOpen.value;');
    expect(playScriptDialog).toContain('inputRef.current?.focus()');
    expect(playScriptDialog).toContain('returnFocusRef.current?.focus()');
    expect(playScriptDialog).toContain("event.key === 'Escape'");
    expect(playScriptDialog).toContain("event.key === 'Enter'");
    expect(playScriptDialog).toContain("event.key !== 'Tab'");
  });

  it('keeps navigation-only mutation locking out of static Studio region identities', () => {
    expect(studio).toContain('const staticControlsLocked = mutationLocked && !rotoScriptNavigationLocked;');
    const toolRailStart = studio.indexOf('const toolRail = toolRailPropsMemo.resolve(');
    const toolRailEnd = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(', toolRailStart);
    const toolRailBlock = studio.slice(toolRailStart, toolRailEnd);
    expect(toolRailBlock).toContain('staticControlsLocked');
    expect(toolRailBlock).not.toContain('disabled: !engine || mutationLocked');
  });

  it('keeps navigation-only status out of the right-panel identity boundary', () => {
    const memoStart = studio.indexOf('const rightPanel = rightPanelPropsMemo.resolve(');
    const memoEnd = studio.indexOf('const viewModel = usePhysicsPaintStudioViewModel', memoStart);
    const memoBlock = studio.slice(memoStart, memoEnd);
    for (const invalidator of ['applyStatus', 'applyMessage', 'lastError', 'scriptLoadAndApplyDisabledReason']) {
      expect(memoBlock).not.toContain(invalidator);
    }
    const propsStart = rightPanel.indexOf('export interface PhysicsPaintRightPanelProps');
    const propsEnd = rightPanel.indexOf('const DEFAULT_PALETTE', propsStart);
    const propsBlock = rightPanel.slice(propsStart, propsEnd);
    for (const deadProp of ['devExportEnabled', 'devExportBusy', 'applyStatus', 'applyMessage', 'error?:', 'onExportDebugProof', 'onSaveState', 'onLoadState']) {
      expect(propsBlock).not.toContain(deadProp);
    }
  });

  it('derives frame-sensitive Load and Apply availability inside the Scripts subscriber', () => {
    expect(scriptsPanel).not.toContain('loadAndApplyDisabledReason: string | null');
    expect(scriptsPanel).toContain('const loadAndApplyDisabledReason = !library.selected.value');
    expect(studio).not.toContain('const scriptLoadAndApplyDisabledReason =');
  });

  it('subscribes to history availability only in the narrow Undo and Redo child', () => {
    const childStart = toolRail.indexOf('function PhysicsPaintHistoryActionButton');
    const railStart = toolRail.indexOf('function PhysicsPaintToolRailImpl');
    const railEnd = toolRail.indexOf('export const PhysicsPaintToolRail', railStart);
    expect(childStart).toBeGreaterThanOrEqual(0);
    expect(childStart).toBeLessThan(railStart);
    expect(toolRail.slice(childStart, railStart)).toContain('historyAvailability?.value');
    expect(toolRail.slice(railStart, railEnd)).not.toContain('historyAvailability?.value');
  });
});

describe('localized render instrumentation', () => {
  it('assigns each non-Workflow render counter to its app-owned implementation body', () => {
    const owners = [
      [studio.slice(studio.indexOf('export function PhysicsPaintStudio()'), studio.indexOf('async function dispatchAndWaitForAcceptedRotoPhysicalEdit')), 'render.studio'],
      [studioView.slice(studioView.indexOf('export function PhysicsPaintStudioView'), studioView.length), 'render.studioView'],
      [studioView.slice(studioView.indexOf('export function PhysicsPaintStudioView'), studioView.length), 'render.rightPanelRegion'],
      [studioView.slice(studioView.indexOf('function PhysicsPaintCanvasStack'), studioView.indexOf('export interface PhysicsPaintStudioViewProps')), 'render.canvasStack'],
      [topBar.slice(topBar.indexOf('export function PhysicsPaintTopBar'), topBar.length), 'render.topBar'],
      [toolRail.slice(toolRail.indexOf('function PhysicsPaintToolRailImpl'), toolRail.indexOf('export const PhysicsPaintToolRail')), 'render.toolRailImpl'],
      [rightPanel.slice(rightPanel.indexOf('export function PhysicsPaintRightPanel'), rightPanel.length), 'render.rightPanelImpl'],
      [playScriptDialog.slice(playScriptDialog.indexOf('export function PhysicsPaintPlayScriptDialog'), playScriptDialog.length), 'render.playScriptDialog'],
      [canvasMount.slice(canvasMount.indexOf('export function PhysicsPaintCanvasMount'), canvasMount.length), 'render.canvasMount'],
    ] as const;

    for (const [owner, counter] of owners) {
      expect(countOccurrences(owner, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
  });

  it('locks CanvasStack observer setup and cleanup counters to the existing effect', () => {
    const stack = studioView.slice(studioView.indexOf('function PhysicsPaintCanvasStack'), studioView.indexOf('export interface PhysicsPaintStudioViewProps'));
    for (const counter of [
      'observer.canvasStack.resize.install',
      'observer.canvasStack.resize.cleanup',
      'observer.canvasStack.mutation.install',
      'observer.canvasStack.mutation.cleanup',
    ]) {
      expect(countOccurrences(stack, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(stack).toContain('}, []);');
  });

  it('locks CanvasMount request, observer, and transparent lifecycle proxy counters', () => {
    for (const counter of [
      'render.efxChildRequest',
      'observer.canvasMount.resize.install',
      'observer.canvasMount.resize.cleanup',
      'lifecycle.canvasMount.engineReady',
      'lifecycle.canvasMount.beforeDestroy',
    ]) {
      expect(countOccurrences(canvasMount, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(canvasMount).toContain('}, [props.height, props.width]);');
    expect(canvasMount).toContain('return props.onEngineReady(engine);');
    expect(canvasMount).toContain('const beforeEngineDestroy = props.beforeEngineDestroy;');
    expect(canvasMount).toContain('return beforeEngineDestroy(engine);');
  });

  it('locks engine lifecycle counters to the current tablet and external cleanup effects', () => {
    for (const counter of [
      'lifecycle.engine.tabletListener.install',
      'lifecycle.engine.tabletListener.cleanup',
      'lifecycle.engine.externalState.cleanup',
    ]) {
      expect(countOccurrences(engineLifecycle, `recordPhysicsPaintPerformanceCounter('${counter}')`), counter).toBe(1);
    }
    expect(engineLifecycle).toContain('}, []);');
    expect(engineLifecycle).toContain('}, [engine, input.launchContext?.rotoPhysical?.background]);');
  });

  it('limits Task 1 localization to dedicated static wrappers and four Studio identity resolves', () => {
    expect(countOccurrences(toolRail, 'memo(')).toBe(1);
    expect(countOccurrences(rightPanel, 'memo(')).toBe(0);
    expect(countOccurrences(memoizedTopBar, 'memo(')).toBe(1);
    expect(countOccurrences(memoizedPlayScriptDialog, 'memo(')).toBe(1);
    expect(countOccurrences(studioView, 'memo(')).toBe(0);
    expect(countOccurrences(canvasMount, 'memo(')).toBe(0);
    expect(countOccurrences(studio, 'PropsMemo.resolve(')).toBe(4);
    expect(studioView).toContain('}, []);');
    expect(canvasMount).toContain('}, [props.height, props.width]);');
  });
});

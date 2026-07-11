import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./useRotoCloseLifecycle.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');

describe('useRotoCloseLifecycle source contract', () => {
  it('owns the prompt state, exact choices, and browser/Tauri close boundary', () => {
    const text = source();

    expect(text).toContain("export type RotoClosePromptState = 'idle' | 'prompt' | 'saving' | 'error'");
    expect(text).toContain("const [rotoClosePromptState, setRotoClosePromptState] = useState<RotoClosePromptState>('idle')");
    expect(text).toContain('const closePhysicsPaintWindow = useCallback(async () => {');
    expect(text).toContain("await import('@tauri-apps/api/window')");
    expect(text).toContain('await appWindow.close()');
    expect(text).toContain('window.close()');
    expect(text).toContain('const closeWithoutSavingRotoFrame = useCallback');
    expect(text).toContain('const cancelRotoClose = useCallback');
    expect(text).toContain('const saveAndCloseRotoFrame = useCallback');
  });

  it('snapshots before unload only and blocks only a dirty native Roto close', () => {
    const text = source();
    const beforeUnloadBlock = text.slice(text.indexOf('const handleBeforeUnload ='), text.indexOf("window.addEventListener('beforeunload', handleBeforeUnload)"));
    const nativeCloseBlock = text.slice(text.indexOf('appWindow.onCloseRequested'), text.indexOf('return {', text.indexOf('appWindow.onCloseRequested')));

    expect(beforeUnloadBlock).toContain("if (input.workflowMode !== 'roto') return");
    expect(beforeUnloadBlock).toContain('input.snapshotCurrentRotoFrame()');
    expect(beforeUnloadBlock).not.toContain('event.preventDefault()');
    expect(beforeUnloadBlock).not.toContain('saveCurrentRotoFrame');
    expect(nativeCloseBlock).toContain('input.closeGuardBypassRef.current || input.closeAfterRotoSaveRequestedRef.current');
    expect(nativeCloseBlock).toContain('input.snapshotCurrentRotoFrame()');
    expect(nativeCloseBlock).toContain("input.workflowMode === 'roto' && input.dirtyFramesRef.current.has(input.currentFrame)");
    expect(nativeCloseBlock).toContain('event.preventDefault()');
    expect(nativeCloseBlock).toContain("setRotoClosePromptState('prompt')");
  });

  it('continues close only through the matching save/apply lifecycle and recovers locally on send failure', () => {
    const text = source();
    const saveBlock = text.slice(text.indexOf('const saveAndCloseRotoFrame = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const saveAndCloseRotoFrame = useCallback')));

    expect(saveBlock).toContain('if (input.closeAfterRotoSaveRequestedRef.current) return');
    expect(saveBlock).toContain('input.closeAfterRotoSaveRequestedRef.current = true');
    expect(saveBlock).toContain('input.closeAfterApplyOperationIdRef.current = payload.operationId');
    expect(saveBlock).toContain("if (payload.kind === 'apply-canvas') payload.closeWindowAfterApply = true");
    expect(saveBlock).not.toContain('closePhysicsPaintWindow()');
    expect(saveBlock).toContain("setRotoClosePromptState('error')");
    expect(saveBlock).toContain('input.closeAfterRotoSaveRequestedRef.current = false');
    expect(saveBlock).toContain('input.closeGuardBypassRef.current = false');
  });
});

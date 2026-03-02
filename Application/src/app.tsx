import {signal} from '@preact/signals';
import {Preview} from './components/Preview';
import {projectStore} from './stores/projectStore';

const ipcResult = signal<string | null>(null);
const ipcLoading = signal(false);

export function App() {
  const testIpc = async () => {
    ipcLoading.value = true;
    try {
      const {invoke} = await import('@tauri-apps/api/core');
      const result = await invoke('project_get_default');
      ipcResult.value = JSON.stringify(result, null, 2);
    } catch (err) {
      ipcResult.value = `Error: ${String(err)}`;
    } finally {
      ipcLoading.value = false;
    }
  };

  const handleChangeName = () => {
    projectStore.setName(
      projectStore.name.value === 'My Project'
        ? 'Untitled Project'
        : 'My Project',
    );
  };

  const handleToggleFps = () => {
    projectStore.setFps(projectStore.fps.value === 24 ? 15 : 24);
  };

  return (
    <div class="min-h-screen bg-[var(--color-bg-root)] text-[var(--color-text-primary)] flex flex-col items-center justify-center gap-8 p-8">
      <h1 class="text-3xl font-bold text-[var(--color-text-white)]">
        EFX Motion Editor
      </h1>

      {/* Motion Canvas Player Preview */}
      <div class="w-full max-w-3xl">
        <Preview />
      </div>

      {/* Signal Store Reactivity Demo */}
      <div class="flex flex-col items-center gap-3">
        <div class="text-[var(--color-text-secondary)] text-sm">
          Project: <span class="text-[var(--color-text-white)] font-medium">{projectStore.name}</span>
          {' | '}
          FPS: <span class="text-[var(--color-text-white)] font-medium">{projectStore.fps}</span>
          {' | '}
          Resolution: <span class="text-[var(--color-text-white)] font-medium">{projectStore.width}x{projectStore.height}</span>
        </div>
        <div class="flex gap-3">
          <button
            onClick={handleChangeName}
            class="px-4 py-2 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors"
          >
            Change Name
          </button>
          <button
            onClick={handleToggleFps}
            class="px-4 py-2 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-md text-sm font-medium transition-colors"
          >
            Toggle FPS
          </button>
        </div>
      </div>

      {/* IPC test */}
      <div class="flex flex-col items-center gap-4">
        <button
          onClick={testIpc}
          disabled={ipcLoading.value}
          class="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-white)] rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {ipcLoading.value ? 'Calling...' : 'Test IPC: project_get_default'}
        </button>
        {ipcResult.value && (
          <pre class="bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] p-4 rounded-md text-sm max-w-lg overflow-auto">
            {ipcResult}
          </pre>
        )}
      </div>
    </div>
  );
}

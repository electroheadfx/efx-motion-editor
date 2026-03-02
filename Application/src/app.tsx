import { useState } from 'preact/hooks';
import testImageSrc from './assets/test-image.jpg';

let assetUrl: ((path: string) => string) | null = null;
try {
  // convertFileSrc only works inside the Tauri runtime
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  assetUrl = convertFileSrc;
} catch {
  // Running outside Tauri (e.g. plain browser dev) -- fall back to static imports
}

export function App() {
  const [ipcResult, setIpcResult] = useState<string | null>(null);
  const [ipcLoading, setIpcLoading] = useState(false);

  const testIpc = async () => {
    setIpcLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('project_get_default');
      setIpcResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setIpcResult(`Error: ${String(err)}`);
    } finally {
      setIpcLoading(false);
    }
  };

  // Use asset protocol URL if available, otherwise fall back to bundled import
  const imageSrc = assetUrl ? assetUrl(testImageSrc) : testImageSrc;

  return (
    <div class="min-h-screen bg-[var(--color-bg-root)] text-[var(--color-text-primary)] flex flex-col items-center justify-center gap-8 p-8">
      <h1 class="text-3xl font-bold text-[var(--color-text-white)]">
        EFX Motion Editor
      </h1>

      {/* Preview area placeholder */}
      <div class="w-full max-w-3xl bg-black rounded-lg overflow-hidden">
        <div class="aspect-video flex items-center justify-center">
          <img
            src={imageSrc}
            alt="Test image via asset protocol"
            class="max-w-full max-h-full object-contain"
          />
        </div>
      </div>

      {/* IPC test */}
      <div class="flex flex-col items-center gap-4">
        <button
          onClick={testIpc}
          disabled={ipcLoading}
          class="px-6 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-white)] rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {ipcLoading ? 'Calling...' : 'Test IPC: project_get_default'}
        </button>
        {ipcResult && (
          <pre class="bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] p-4 rounded-md text-sm max-w-lg overflow-auto">
            {ipcResult}
          </pre>
        )}
      </div>
    </div>
  );
}

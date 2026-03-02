import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { assetUrl } from '../lib/ipc';

export function AssetProtocolTest() {
  const imgSrc = useSignal<string | null>(null);
  const status = useSignal<'loading' | 'success' | 'error' | 'not-tauri'>('loading');
  const errorMsg = useSignal<string>('');

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) {
      status.value = 'not-tauri';
      return;
    }

    import('@tauri-apps/api/path')
      .then(({ resolveResource }) => resolveResource('resources/test-image.jpg'))
      .then((absolutePath) => {
        const url = assetUrl(absolutePath);
        imgSrc.value = url;
      })
      .catch((err) => {
        status.value = 'error';
        errorMsg.value = String(err);
      });
  }, []);

  const handleLoad = () => { status.value = 'success'; };
  const handleError = () => {
    status.value = 'error';
    errorMsg.value = 'Image failed to load via asset protocol';
  };

  return (
    <div class="flex flex-col items-center gap-2">
      <h3 class="text-sm font-medium text-[var(--color-text-secondary)]">
        Asset Protocol Test
      </h3>

      {status.value === 'not-tauri' && (
        <p class="text-xs text-[var(--color-text-muted)]">
          Asset protocol requires Tauri runtime (run with pnpm tauri dev)
        </p>
      )}

      {status.value === 'error' && (
        <p class="text-xs text-red-400">Error: {errorMsg.value}</p>
      )}

      {imgSrc.value && (
        <div class="relative">
          <img
            src={imgSrc.value}
            alt="Test image via asset protocol"
            class="max-w-xs rounded border border-[var(--color-separator)]"
            onLoad={handleLoad}
            onError={handleError}
          />
          {status.value === 'success' && (
            <span class="absolute top-1 right-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
              Asset Protocol OK
            </span>
          )}
        </div>
      )}

      {status.value === 'loading' && !imgSrc.value && (
        <p class="text-xs text-[var(--color-text-muted)]">Resolving asset path...</p>
      )}

      {imgSrc.value && (
        <p class="text-xs text-[var(--color-text-muted)] font-mono break-all max-w-xs">
          {imgSrc.value}
        </p>
      )}
    </div>
  );
}

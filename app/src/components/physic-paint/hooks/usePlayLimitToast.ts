import { useCallback, useEffect, useState } from 'preact/hooks';

export const PLAY_LIMIT_TOAST_DISMISS_MS = 5000;

export function usePlayLimitToast() {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((nextMessage: string) => setMessage(nextMessage), []);
  const dismiss = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(dismiss, PLAY_LIMIT_TOAST_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [dismiss, message]);

  return { message, show, dismiss };
}

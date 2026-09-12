/**
 * 52.2-11 Task 1 (D-03): RED stub — replaced by the real normalization/dedupe
 * implementation in the GREEN step of the same task.
 */

export function normalizeOpenedUrl(_raw: string): string | null {
  return null;
}

export interface OpenedUrlQueue {
  push(urls: readonly string[]): void;
  drain(): string[];
}

export function createOpenedUrlQueue(): OpenedUrlQueue {
  return {
    push: () => undefined,
    drain: () => [],
  };
}

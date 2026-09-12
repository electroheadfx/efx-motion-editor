/**
 * 52.2-11 Task 1 (D-03, T-52.2-37/38): opened-URL normalization and dedupe.
 *
 * macOS delivers a double-clicked `.mce` package through two channels: the
 * `RunEvent::Opened` event while the app runs, and the buffered `opened_urls`
 * read for a cold start (where the event fires before any frontend listener
 * exists). Both channels can hand over the SAME URL, so the queue is what makes
 * "the project opens exactly once" deterministic rather than a race.
 *
 * This module is deliberately pure — no window, no IPC, no store — which is
 * what lets the cold-start-versus-warm double delivery be replayed in a test
 * without a Tauri harness. The Rust side owns the buffer; this owns the law.
 *
 * Scope: this module decides only whether a URL can NAME a project (the `.mce`
 * suffix and the `file` scheme). Format validity is plan 08's refusal gate, so
 * a plain file ending in `.mce` is accepted here as a legacy-layout candidate
 * and judged there — never silently dropped (T-52.2-37).
 */

/** A `scheme://` URL other than `file://` can never name a local package. */
const NON_FILE_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * Decode an OS-delivered URL (or a plain path) into a filesystem path, or
 * `null` when it cannot name a project package.
 *
 * `file://` URLs are percent-decoded; a plain path is passed through verbatim
 * (a real filename may contain a literal `%`, and re-decoding it would corrupt
 * the path). One trailing slash is stripped so the directory-URL form of a
 * package normalizes to the same string as its path form, which is what makes
 * dedupe reliable.
 */
export function normalizeOpenedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.includes('\0')) {
    return null;
  }

  let path: string;
  if (trimmed.startsWith('file://')) {
    let rest = trimmed.slice('file://'.length);
    // Authority: empty (`file:///path`) and `localhost` both name this
    // machine; anything else points at a host and is not a local package.
    const slash = rest.indexOf('/');
    const authority = slash === -1 ? rest : rest.slice(0, slash);
    if (authority !== '' && authority.toLowerCase() !== 'localhost') {
      return null;
    }
    rest = slash === -1 ? '' : rest.slice(slash);
    try {
      path = decodeURIComponent(rest);
    } catch {
      // A malformed percent-escape is not a path.
      return null;
    }
  } else {
    if (NON_FILE_SCHEME.test(trimmed)) {
      return null;
    }
    path = trimmed;
  }

  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!/\.mce$/i.test(path)) {
    return null;
  }
  return path;
}

export interface OpenedUrlQueue {
  /** Normalize and enqueue; duplicates already pending are dropped. */
  push(urls: readonly string[]): void;
  /** Return the pending paths in arrival order and clear the queue. */
  drain(): string[];
}

/**
 * Create a queue whose dedupe scope is the PENDING set only. A URL delivered
 * while a project is already open therefore still reaches the caller — the
 * module never silently discards a request it cannot prove it already served.
 */
export function createOpenedUrlQueue(): OpenedUrlQueue {
  const pending: string[] = [];
  const pendingSet = new Set<string>();
  return {
    push(urls: readonly string[]): void {
      for (const url of urls) {
        const path = normalizeOpenedUrl(url);
        if (path === null || pendingSet.has(path)) {
          continue;
        }
        pendingSet.add(path);
        pending.push(path);
      }
    },
    drain(): string[] {
      const drained = pending.slice();
      pending.length = 0;
      pendingSet.clear();
      return drained;
    },
  };
}

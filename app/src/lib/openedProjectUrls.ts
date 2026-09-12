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
 *
 * It also owns the one conversion between the two path forms this feature has:
 * the user- and OS-facing PACKAGE (`Name.mce`, a directory) and the manifest
 * file inside it that `projectStore` loads (`toPackageManifestPath`).
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
 * The manifest file name inside a package. Single source is
 * `EFX_PAINT_PACKAGE_MANIFEST_FILE` in `efxPaintPersistence.ts`; it is repeated
 * here as a literal so this module stays import-free (the unit tests, the
 * Studio bundle and the rescue script all load it without the persistence
 * graph). `packageAssociationContract.test.ts` and the persistence tests pin
 * the value on the writing side.
 */
const PACKAGE_MANIFEST_FILE = 'project.mce';

/**
 * Convert the path a user or the OS names — the PACKAGE, a directory called
 * `Name.mce` — into the path every `projectStore` call loads: the manifest
 * inside it.
 *
 * The store's convention is "the path names a file inside the package, and its
 * directory is the package root" (`openProject` reads the file it is handed and
 * takes its dirname as the package directory; `saveProjectAs` writes the
 * package at its dirname), so both the open and save-as legs pass through here.
 *
 * A path that already names the manifest, or that does not end in `.mce` at
 * all, is returned unchanged — the refusal gate, not this function, judges
 * whether a path is a real project.
 */
export function toPackageManifestPath(path: string): string {
  if (path.endsWith(`/${PACKAGE_MANIFEST_FILE}`) || !/\.mce$/i.test(path)) {
    return path;
  }
  return `${path}/${PACKAGE_MANIFEST_FILE}`;
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

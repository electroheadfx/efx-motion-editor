/**
 * 52.2-11 Task 1 (D-03, T-52.2-37/38): the opened-URL normalization and dedupe
 * contract.
 *
 * macOS delivers a double-clicked package twice: once through the buffered
 * `opened_urls` cold-start read and once through the `opened` event when the
 * webview is already listening. The queue is what makes "the same project
 * opens exactly once" a testable claim rather than a runtime hope: the module
 * owns no window, no IPC and no store state, so both deliveries can be
 * replayed here without a Tauri harness.
 *
 * The refusal gate (plan 08) decides FORMAT validity; this module only decides
 * whether a URL can name a project at all (the `.mce` suffix), so a plain file
 * path ending in `.mce` is deliberately accepted and left to the gate.
 */
import { describe, expect, it } from 'vitest';
import { createOpenedUrlQueue, normalizeOpenedUrl, toPackageManifestPath } from './openedProjectUrls';

describe('normalizeOpenedUrl', () => {
  it('decodes a file:// URL to a filesystem path with percent-escapes resolved', () => {
    expect(normalizeOpenedUrl('file:///Users/someone/Dev/My%20Project.mce')).toBe(
      '/Users/someone/Dev/My Project.mce',
    );
  });

  it('accepts the empty-authority and localhost file:// forms', () => {
    expect(normalizeOpenedUrl('file://localhost/Users/someone/Dev/Proj.mce')).toBe(
      '/Users/someone/Dev/Proj.mce',
    );
  });

  it('strips one trailing slash so a package delivered as a directory URL matches its path form', () => {
    expect(normalizeOpenedUrl('file:///Users/someone/Dev/Proj.mce/')).toBe(
      '/Users/someone/Dev/Proj.mce',
    );
  });

  it('passes a plain package path through unchanged', () => {
    expect(normalizeOpenedUrl('/Users/someone/Dev/Proj.mce')).toBe('/Users/someone/Dev/Proj.mce');
  });

  it('accepts a plain file path ending in .mce as a legacy-layout candidate for the refusal gate', () => {
    // This module does not decide format validity — plan 08's gate does.
    expect(normalizeOpenedUrl('/Users/someone/Dev/legacy-loose.mce')).toBe(
      '/Users/someone/Dev/legacy-loose.mce',
    );
  });

  it('rejects a path that does not end in .mce', () => {
    expect(normalizeOpenedUrl('/Users/someone/Dev/notes.txt')).toBeNull();
    expect(normalizeOpenedUrl('file:///Users/someone/Dev/notes.txt')).toBeNull();
  });

  it('rejects empty, whitespace-only, malformed-escape and NUL-bearing input', () => {
    expect(normalizeOpenedUrl('')).toBeNull();
    expect(normalizeOpenedUrl('   ')).toBeNull();
    expect(normalizeOpenedUrl('file:///Users/someone/Dev/%E0%A4%A.mce')).toBeNull();
    expect(normalizeOpenedUrl('/Users/someone/Dev/Pro\0j.mce')).toBeNull();
  });

  it('rejects a non-file scheme', () => {
    expect(normalizeOpenedUrl('https://example.com/Proj.mce')).toBeNull();
  });
});

describe('createOpenedUrlQueue', () => {
  it('yields exactly one open request when both delivery mechanisms hand over the same URL', () => {
    const queue = createOpenedUrlQueue();
    // The cold-start buffer first, then the same URL arriving as an event —
    // in either order, and in both of its raw forms (path vs file:// URL).
    queue.push(['/Users/someone/Dev/Proj.mce']);
    queue.push(['file:///Users/someone/Dev/Proj.mce']);
    expect(queue.drain()).toEqual(['/Users/someone/Dev/Proj.mce']);
  });

  it('delivers two different cold-start URLs in order, once each', () => {
    const queue = createOpenedUrlQueue();
    queue.push(['file:///Users/someone/Dev/First.mce', '/Users/someone/Dev/Second.mce']);
    expect(queue.drain()).toEqual(['/Users/someone/Dev/First.mce', '/Users/someone/Dev/Second.mce']);
  });

  it('does not silently discard a URL delivered while a project is already open', () => {
    const queue = createOpenedUrlQueue();
    queue.push(['/Users/someone/Dev/First.mce']);
    expect(queue.drain()).toEqual(['/Users/someone/Dev/First.mce']);
    // A later delivery of the SAME path must still reach the caller: the
    // dedupe scope is the pending set, never a session-wide seen-set.
    queue.push(['/Users/someone/Dev/First.mce']);
    expect(queue.drain()).toEqual(['/Users/someone/Dev/First.mce']);
  });

  it('drops rejected URLs and drains empty when nothing valid arrived', () => {
    const queue = createOpenedUrlQueue();
    queue.push(['/Users/someone/Dev/notes.txt', '']);
    expect(queue.drain()).toEqual([]);
    expect(queue.drain()).toEqual([]);
  });
});

describe('toPackageManifestPath', () => {
  it('names the manifest inside a package the user or the OS handed us', () => {
    expect(toPackageManifestPath('/Users/someone/Dev/Proj.mce')).toBe(
      '/Users/someone/Dev/Proj.mce/project.mce',
    );
  });

  it('leaves a path that already names the manifest untouched', () => {
    expect(toPackageManifestPath('/Users/someone/Dev/Proj.mce/project.mce')).toBe(
      '/Users/someone/Dev/Proj.mce/project.mce',
    );
  });

  it('leaves a path that does not end in .mce untouched, for the refusal gate to judge', () => {
    expect(toPackageManifestPath('/Users/someone/Dev/untitled')).toBe('/Users/someone/Dev/untitled');
    expect(toPackageManifestPath('/project/clean.mce.json')).toBe('/project/clean.mce.json');
  });
});

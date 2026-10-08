/**
 * 52.5 follow-up: main-window peaks for a document sound clip (261008-ig1:
 * multi-clip aware).
 *
 * The Studio band reads `audioPeaksCache` keyed by `sourceId` from its own
 * webview realm; the main timeline needs the same peaks in the main realm.
 * Two identities, two caches: playback buffers are keyed by the PLACED clip id
 * (`audioEngine` / `sound.id` — every clip needs its own buffer), while peaks
 * are keyed by the IMPORTED file (`sound.sourceId` — an alt+drag duplicate
 * shares the cached decode and never decodes its source twice for peaks).
 */

import type {DocumentSoundClip} from '../efx-paint/document/efxPaintDocument';
import {audioEngine} from './audioEngine';
import {computeWaveformPeaks} from './audioWaveform';
import {audioPeaksCache} from './audioPeaksCache';
import {isSafeAudioRelativePath} from './efxPaintPersistence';
import {readFile} from '@tauri-apps/plugin-fs';

const inFlight = new Set<string>();

/**
 * Ensure the clip's playback buffer (clip-id keyed) and sourceId-keyed peaks
 * exist. Fail-closed warn-and-skip on a bad reference or missing bytes.
 * Concurrent calls for the SAME clip collapse to one decode; a second clip
 * sharing the source reuses the peaks but still decodes its own buffer.
 */
export async function ensureDocumentSoundPeaks(
  sound: DocumentSoundClip,
  projectRoot: string,
  fps: number,
): Promise<void> {
  const peaksReady = audioPeaksCache.get(sound.sourceId) !== undefined;
  const bufferReady = audioEngine.getBuffer(sound.id) !== undefined;
  if (peaksReady && bufferReady) return;
  if (inFlight.has(sound.id)) return;
  inFlight.add(sound.id);
  try {
    if (!isSafeAudioRelativePath(sound.relativePath)) {
      console.error(`Skipping document sound "${sound.relativePath}": not a safe package-relative audio/ path.`);
      return;
    }
    const fileBytes = await readFile(`${projectRoot}/${sound.relativePath}`);
    const buffer = await audioEngine.decode(sound.id, fileBytes.buffer);
    if (!peaksReady) {
      audioPeaksCache.set(
        sound.sourceId,
        computeWaveformPeaks(buffer),
        Math.max(1, Math.ceil(buffer.duration * fps)),
      );
    }
  } catch (err) {
    console.error(`Failed to decode document sound "${sound.relativePath}":`, err);
  } finally {
    inFlight.delete(sound.id);
  }
}

/**
 * 52.5 follow-up: main-window peaks for a document sound clip.
 *
 * The Studio band reads `audioPeaksCache` keyed by `sourceId` from its own
 * webview realm; the main timeline needs the same peaks in the main realm.
 * One decode serves both playback (`audioEngine` keyed by `sound.id`) and the
 * waveform preview (peaks keyed by `sound.sourceId`), so the clip's bytes are
 * never decoded twice per open.
 */

import type {DocumentSoundClip} from '../efx-paint/document/efxPaintDocument';
import {audioEngine} from './audioEngine';
import {computeWaveformPeaks} from './audioWaveform';
import {audioPeaksCache} from './audioPeaksCache';
import {isSafeAudioRelativePath} from './efxPaintPersistence';
import {readFile} from '@tauri-apps/plugin-fs';

const inFlight = new Set<string>();

/**
 * Ensure the clip's playback buffer and sourceId-keyed peaks exist. Fail-closed
 * warn-and-skip on a bad reference or missing bytes. Concurrent calls for the
 * same source collapse to one decode.
 */
export async function ensureDocumentSoundPeaks(
  sound: DocumentSoundClip,
  projectRoot: string,
  fps: number,
): Promise<void> {
  if (audioPeaksCache.get(sound.sourceId) !== undefined) return;
  if (inFlight.has(sound.sourceId)) return;
  inFlight.add(sound.sourceId);
  try {
    if (!isSafeAudioRelativePath(sound.relativePath)) {
      console.error(`Skipping document sound "${sound.relativePath}": not a safe package-relative audio/ path.`);
      return;
    }
    const fileBytes = await readFile(`${projectRoot}/${sound.relativePath}`);
    const buffer = await audioEngine.decode(sound.id, fileBytes.buffer);
    audioPeaksCache.set(
      sound.sourceId,
      computeWaveformPeaks(buffer),
      Math.max(1, Math.ceil(buffer.duration * fps)),
    );
  } catch (err) {
    console.error(`Failed to decode document sound "${sound.relativePath}":`, err);
  } finally {
    inFlight.delete(sound.sourceId);
  }
}

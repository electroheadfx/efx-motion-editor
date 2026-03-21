import {useState} from 'preact/hooks';
import {Music, Loader2} from 'lucide-preact';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readFile} from '@tauri-apps/plugin-fs';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {audioStore} from '../../stores/audioStore';
import {projectStore} from '../../stores/projectStore';

export function AddAudioButton() {
  const [isDecoding, setIsDecoding] = useState(false);

  const handleAddAudio = async () => {
    const projectDir = projectStore.dirPath.peek();
    if (!projectDir) {
      console.error('Cannot add audio: no project directory');
      return;
    }

    const filePath = await open({
      filters: [{name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a']}],
      multiple: false,
    });

    if (!filePath) return;

    setIsDecoding(true);
    try {
      const filename = filePath.split('/').pop() ?? 'audio';

      // Create audio/ directory in project
      await mkdir(projectDir + '/audio', {recursive: true});

      // Copy file to project
      await copyFile(filePath, projectDir + '/audio/' + filename);

      // Read file as bytes
      const fileBytes = await readFile(projectDir + '/audio/' + filename);

      // Convert to ArrayBuffer
      const arrayBuffer = fileBytes.buffer;

      // Generate track ID
      const trackId = crypto.randomUUID();

      // Decode audio
      const audioBuffer = await audioEngine.decode(trackId, arrayBuffer);

      // Compute peaks and store in neutral cache module
      const peaks = computeWaveformPeaks(audioBuffer);
      audioPeaksCache.set(trackId, peaks);

      // Compute outFrame from audio duration
      const outFrame = Math.ceil(audioBuffer.duration * projectStore.fps.peek());

      // Add track to store
      audioStore.addTrack({
        id: trackId,
        name: filename,
        filePath: projectDir + '/audio/' + filename,
        relativePath: 'audio/' + filename,
        originalFilename: filename,
        offsetFrame: 0,
        inFrame: 0,
        outFrame,
        volume: 1,
        muted: false,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        fadeInCurve: 'exponential',
        fadeOutCurve: 'exponential',
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channelCount: audioBuffer.numberOfChannels,
        order: audioStore.tracks.peek().length,
        trackHeight: 44,
        slipOffset: 0,
      });
    } catch (err) {
      console.error('Failed to add audio track:', err);
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <button
      class="rounded bg-[var(--color-bg-input)] px-2 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
      onClick={handleAddAudio}
      title="Add Audio"
      disabled={isDecoding}
    >
      {isDecoding ? <Loader2 size={14} class="animate-spin" /> : <Music size={14} />}
    </button>
  );
}

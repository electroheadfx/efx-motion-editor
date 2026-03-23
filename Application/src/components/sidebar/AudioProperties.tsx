import {useState} from 'preact/hooks';
import {Volume2, VolumeX, Loader2} from 'lucide-preact';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readFile} from '@tauri-apps/plugin-fs';
import {NumericInput} from '../shared/NumericInput';
import {SectionLabel} from '../shared/SectionLabel';
import {audioStore} from '../../stores/audioStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {projectStore} from '../../stores/projectStore';
import {startCoalescing, stopCoalescing, pushAction} from '../../lib/history';
import {autoArrangeHoldFrames, type ArrangeStrategy} from '../../lib/beatMarkerEngine';
import type {AudioTrack, FadeCurve} from '../../types/audio';

interface AudioPropertiesProps {
  track: AudioTrack;
}

const FADE_CURVES: {value: FadeCurve; label: string}[] = [
  {value: 'linear', label: 'Linear'},
  {value: 'exponential', label: 'Exponential'},
  {value: 'logarithmic', label: 'Logarithmic'},
];

export function AudioProperties({track}: AudioPropertiesProps) {
  const [isReplacing, setIsReplacing] = useState(false);

  const handleReplace = async () => {
    const projectDir = projectStore.dirPath.peek();
    if (!projectDir) return;

    const filePath = await open({
      filters: [{name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a']}],
      multiple: false,
    });

    if (!filePath) return;

    setIsReplacing(true);
    try {
      const filename = filePath.split('/').pop() ?? 'audio';

      // Create audio/ directory in project
      await mkdir(projectDir + '/audio', {recursive: true});

      // Copy file to project
      await copyFile(filePath, projectDir + '/audio/' + filename);

      // Read and decode
      const fileBytes = await readFile(projectDir + '/audio/' + filename);
      const arrayBuffer = fileBytes.buffer;
      const audioBuffer = await audioEngine.decode(track.id, arrayBuffer);

      // Recompute peaks
      const peaks = computeWaveformPeaks(audioBuffer);
      audioPeaksCache.set(track.id, peaks);

      // Compute outFrame from new audio duration
      const outFrame = Math.ceil(audioBuffer.duration * projectStore.fps.peek());

      // Update track with new file paths and metadata
      audioStore.updateTrack(track.id, {
        filePath: projectDir + '/audio/' + filename,
        relativePath: 'audio/' + filename,
        originalFilename: filename,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channelCount: audioBuffer.numberOfChannels,
        inFrame: 0,
        outFrame,
      });
    } catch (err) {
      console.error('Failed to replace audio file:', err);
    } finally {
      setIsReplacing(false);
    }
  };

  const volumePercent = Math.round(track.volume * 100);

  return (
    <div class="px-3 py-2 space-y-3">
      {/* Section 1: TRACK NAME */}
      <div>
        <SectionLabel text="TRACK NAME" />
        <div style={{marginTop: '6px'}}>
          <input
            type="text"
            value={track.name}
            class="w-full bg-[var(--color-bg-input)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            onChange={(e) => {
              audioStore.updateTrack(track.id, {name: (e.target as HTMLInputElement).value});
            }}
          />
        </div>
      </div>

      {/* Section 2: FILE */}
      <div>
        <SectionLabel text="FILE" />
        <div class="flex items-center justify-between" style={{marginTop: '6px'}}>
          <span class="text-[10px] text-[var(--color-text-secondary)] truncate flex-1 min-w-0">
            {track.originalFilename}
          </span>
          <button
            class="shrink-0 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors ml-2"
            onClick={handleReplace}
            disabled={isReplacing}
          >
            {isReplacing ? <Loader2 size={12} class="animate-spin" /> : 'Replace...'}
          </button>
        </div>
      </div>

      {/* Section 3: VOLUME */}
      <div>
        <div class="flex items-center justify-between">
          <SectionLabel text="VOLUME" />
          <button
            class="transition-colors p-0.5 cursor-pointer"
            style={{color: track.muted ? 'var(--color-text-muted)' : 'var(--color-accent)'}}
            title={track.muted ? 'Unmute' : 'Mute'}
            onClick={() => audioStore.setMuted(track.id, !track.muted)}
          >
            {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
        <div class="flex items-center gap-1.5" style={{marginTop: '6px'}}>
          <input
            type="range"
            min="0"
            max="100"
            value={volumePercent}
            class="flex-1 h-1 accent-[var(--color-accent)] cursor-pointer"
            onPointerDown={() => startCoalescing()}
            onPointerUp={() => stopCoalescing()}
            onInput={(e) => {
              const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
              audioStore.setVolume(track.id, val);
            }}
          />
          <span class="text-[11px] w-8 text-right shrink-0" style={{color: 'var(--sidebar-text-primary)'}}>
            {volumePercent}%
          </span>
        </div>
      </div>

      {/* Section 4: FADES */}
      <div>
        <SectionLabel text="FADES" />
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px'}}>
          <div class="flex items-center" style={{gap: '16px'}}>
            <NumericInput
              label="In"
              value={track.fadeInFrames}
              step={1}
              min={0}
              onChange={(val) => audioStore.setFades(track.id, val, track.fadeOutFrames)}
            />
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <select
                class="w-full bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] text-[10px] px-1 py-0.5 rounded outline-none cursor-pointer"
                value={track.fadeInCurve}
                onChange={(e) => {
                  audioStore.updateTrack(track.id, {fadeInCurve: (e.target as HTMLSelectElement).value as FadeCurve});
                }}
              >
                {FADE_CURVES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div class="flex items-center" style={{gap: '16px'}}>
            <NumericInput
              label="Out"
              value={track.fadeOutFrames}
              step={1}
              min={0}
              onChange={(val) => audioStore.setFades(track.id, track.fadeInFrames, val)}
            />
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <select
                class="w-full bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] text-[10px] px-1 py-0.5 rounded outline-none cursor-pointer"
                value={track.fadeOutCurve}
                onChange={(e) => {
                  audioStore.updateTrack(track.id, {fadeOutCurve: (e.target as HTMLSelectElement).value as FadeCurve});
                }}
              >
                {FADE_CURVES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: POSITION */}
      <div>
        <SectionLabel text="POSITION" />
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px'}}>
          <div class="flex items-center" style={{gap: '16px'}}>
            <NumericInput
              label="Offset"
              value={track.offsetFrame}
              step={1}
              onChange={(val) => audioStore.setOffset(track.id, val)}
            />
            <div class="flex-1" />
          </div>
          <div class="flex items-center" style={{gap: '16px'}}>
            <NumericInput
              label="In"
              value={track.inFrame}
              step={1}
              min={0}
              onChange={(val) => audioStore.setInOut(track.id, val, track.outFrame)}
            />
            <NumericInput
              label="Out"
              value={track.outFrame}
              step={1}
              min={track.inFrame + 1}
              onChange={(val) => audioStore.setInOut(track.id, track.inFrame, val)}
            />
          </div>
        </div>
      </div>

      {/* Section 6: BPM */}
      <div>
        <SectionLabel text="BPM" />
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px'}}>
          <div class="flex items-center" style={{gap: '8px'}}>
            <NumericInput
              label="BPM"
              value={track.bpm ?? 0}
              step={0.1}
              min={0}
              onChange={(val) => {
                audioStore.updateTrack(track.id, {bpm: val > 0 ? val : null});
                if (val > 0) {
                  audioStore.recalculateBeatMarkers(track.id, projectStore.fps.peek());
                }
              }}
            />
            {/* x2 and /2 quick-fix buttons */}
            <button
              class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => {
                if (track.bpm) {
                  audioStore.updateTrack(track.id, {bpm: track.bpm * 2});
                  audioStore.recalculateBeatMarkers(track.id, projectStore.fps.peek());
                }
              }}
              disabled={!track.bpm}
              title="Double BPM"
            >
              x2
            </button>
            <button
              class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => {
                if (track.bpm) {
                  audioStore.updateTrack(track.id, {bpm: track.bpm / 2});
                  audioStore.recalculateBeatMarkers(track.id, projectStore.fps.peek());
                }
              }}
              disabled={!track.bpm}
              title="Halve BPM"
            >
              /2
            </button>
          </div>
          <NumericInput
            label="Beat Offset"
            value={track.beatOffsetFrames}
            step={1}
            onChange={(val) => {
              audioStore.updateTrack(track.id, {beatOffsetFrames: val});
              audioStore.recalculateBeatMarkers(track.id, projectStore.fps.peek());
            }}
          />
          <button
            class="text-[10px] px-2 py-1 rounded bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
            onClick={() => audioStore.detectAndSetBPM(track.id, projectStore.fps.peek())}
            title="Re-detect BPM from audio"
          >
            Re-detect BPM
          </button>
        </div>
      </div>

      {/* Section 7: AUTO-ARRANGE */}
      {track.bpm != null && track.beatMarkers.length > 0 && (
        <div>
          <SectionLabel text="AUTO-ARRANGE" />
          <div class="flex flex-col" style={{gap: '8px', marginTop: '6px'}}>
            <AutoArrangeSection track={track} />
          </div>
        </div>
      )}
    </div>
  );
}

const STRATEGIES: {value: ArrangeStrategy; label: string}[] = [
  {value: 'every-beat', label: 'Every Beat'},
  {value: 'every-2-beats', label: 'Every 2 Beats'},
  {value: 'every-bar', label: 'Every Bar'},
];

function AutoArrangeSection({track}: {track: AudioTrack}) {
  const [strategy, setStrategy] = useState<ArrangeStrategy>('every-beat');

  // Target the active content sequence
  const activeSeq = sequenceStore.sequences.value.find(
    s => s.id === sequenceStore.activeSequenceId.value && s.kind === 'content',
  );

  const handleApply = () => {
    if (!activeSeq || !track.bpm || track.beatMarkers.length === 0) return;

    const keyPhotos = activeSeq.keyPhotos;
    if (keyPhotos.length === 0) return;

    const holdFramesArr = autoArrangeHoldFrames(
      keyPhotos.length,
      track.beatMarkers,
      strategy,
      projectStore.fps.peek(),
      track.bpm,
    );

    // Atomic undo: snapshot before, apply all, push single action
    const before = sequenceStore.snapshot();
    for (let i = 0; i < keyPhotos.length; i++) {
      sequenceStore.updateKeyPhotoSilent(activeSeq.id, keyPhotos[i].id, {
        holdFrames: holdFramesArr[i],
      });
    }
    const after = sequenceStore.snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Auto-arrange to beats (${strategy})`,
      timestamp: Date.now(),
      undo: () => sequenceStore.restore(before),
      redo: () => sequenceStore.restore(after),
    });
  };

  return (
    <>
      <div class="flex flex-wrap gap-1">
        {STRATEGIES.map(s => (
          <button
            key={s.value}
            class={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${
              strategy === s.value
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)]'
            }`}
            onClick={() => setStrategy(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        class="w-full text-[10px] px-2 py-1.5 rounded bg-[var(--color-accent)] text-white hover:brightness-125 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleApply}
        disabled={!activeSeq || activeSeq.keyPhotos.length === 0}
        title={!activeSeq ? 'Select a content sequence first' : 'Apply auto-arrange'}
      >
        Apply
      </button>
      {!activeSeq && (
        <div class="text-[10px] text-[var(--color-text-muted)]">
          Select a content sequence to arrange
        </div>
      )}
    </>
  );
}

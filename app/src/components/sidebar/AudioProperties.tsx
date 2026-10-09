import {useRef, useState} from 'preact/hooks';
import {signal} from '@preact/signals';
import {Volume2, VolumeX, Loader2} from 'lucide-preact';
import {open} from '@tauri-apps/plugin-dialog';
import {NumericInput} from '../shared/NumericInput';
import {SliderStepper} from '../shared/SliderStepper';
import {SectionLabel} from '../shared/SectionLabel';
import {RuleSectionHeader} from '../shared/RuleSectionHeader';
import {CollapsibleSection} from './CollapsibleSection';
import {audioStore} from '../../stores/audioStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {projectStore} from '../../stores/projectStore';
import {buildAudioReplacePatch, readAudioSourceBytes} from '../../lib/mainAppAudioSources';
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
  // BEAT SYNC accordion — collapsed on open (signal in useRef; project law: no useState).
  const beatSyncCollapsed = useRef(signal(true));

  const handleReplace = async () => {
    const filePath = await open({
      filters: [{name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a']}],
      multiple: false,
    });

    if (!filePath) return;

    setIsReplacing(true);
    try {
      // 261009-rko: disk reference — never copied into the package.
      const arrayBuffer = await readAudioSourceBytes(filePath);
      const audioBuffer = await audioEngine.decode(track.id, arrayBuffer);

      // Recompute peaks
      const peaks = computeWaveformPeaks(audioBuffer);
      audioPeaksCache.set(track.id, peaks);

      audioStore.updateTrack(
        track.id,
        buildAudioReplacePatch(filePath, audioBuffer, projectStore.fps.peek()),
      );
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
        <RuleSectionHeader text="TRACK NAME" />
        <div style={{marginTop: '6px'}}>
          <input
            type="text"
            value={track.name}
            class="w-full bg-(--color-bg-input) text-(--color-text-primary) text-xs px-2 py-1 rounded outline-none focus:ring-1 focus:ring-(--color-accent)"
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
        <RuleSectionHeader text="FILE" />
        <div class="flex items-center justify-between" style={{marginTop: '6px'}}>
          <span class="text-[10px] text-(--color-text-secondary) truncate flex-1 min-w-0">
            {track.originalFilename}
          </span>
          <button
            class="shrink-0 text-[10px] text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer transition-colors ml-2"
            onClick={handleReplace}
            disabled={isReplacing}
          >
            {isReplacing ? <Loader2 size={12} class="animate-spin" /> : 'Replace...'}
          </button>
        </div>
      </div>

      {/* Section 3: VOLUME */}
      <div>
        <div class="flex items-center" style={{gap: '8px'}}>
          <div style={{flex: '1 1 0', minWidth: 0}}>
            <RuleSectionHeader text="VOLUME" />
          </div>
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
            class="flex-1 h-1 accent-(--color-accent) cursor-pointer"
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

      {/* Section 4: FADES — one full-width SliderStepper per fade; curve select under each bar */}
      <div>
        <RuleSectionHeader text="FADES" />
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px'}}>
          <SliderStepper
            label="Fade in (frames)"
            value={track.fadeInFrames}
            step={1}
            min={0}
            sliderMax={Math.max(track.fadeInFrames, track.outFrame - track.inFrame, 1)}
            onChange={(val) => audioStore.setFades(track.id, val, track.fadeOutFrames)}
            ariaLabel="Fade in frames"
            below={
              <select
                class="w-full bg-(--color-bg-input) text-(--color-text-secondary) text-[10px] px-1 py-0.5 rounded outline-none cursor-pointer"
                aria-label="Fade in curve"
                value={track.fadeInCurve}
                onChange={(e) => {
                  audioStore.updateTrack(track.id, {fadeInCurve: (e.target as HTMLSelectElement).value as FadeCurve});
                }}
              >
                {FADE_CURVES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            }
          />
          <SliderStepper
            label="Fade out (frames)"
            value={track.fadeOutFrames}
            step={1}
            min={0}
            sliderMax={Math.max(track.fadeOutFrames, track.outFrame - track.inFrame, 1)}
            onChange={(val) => audioStore.setFades(track.id, track.fadeInFrames, val)}
            ariaLabel="Fade out frames"
            below={
              <select
                class="w-full bg-(--color-bg-input) text-(--color-text-secondary) text-[10px] px-1 py-0.5 rounded outline-none cursor-pointer"
                aria-label="Fade out curve"
                value={track.fadeOutCurve}
                onChange={(e) => {
                  audioStore.updateTrack(track.id, {fadeOutCurve: (e.target as HTMLSelectElement).value as FadeCurve});
                }}
              >
                {FADE_CURVES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            }
          />
        </div>
      </div>

      {/* Section 5: POSITION — offsetFrame can be negative and is commit-unbounded */}
      <div>
        <RuleSectionHeader text="POSITION" />
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px'}}>
          <SliderStepper
            label="Position (frames)"
            value={track.offsetFrame}
            step={1}
            sliderMin={Math.min(track.offsetFrame, -1)}
            sliderMax={Math.max(track.offsetFrame, track.outFrame - track.inFrame, 1)}
            onChange={(val) => audioStore.setOffset(track.id, val)}
            ariaLabel="Position frames"
          />
          <SliderStepper
            label="In (frames)"
            value={track.inFrame}
            step={1}
            min={0}
            sliderMax={Math.max(track.inFrame, track.outFrame, 1)}
            onChange={(val) => audioStore.setInOut(track.id, val, track.outFrame)}
            ariaLabel="In frames"
          />
          <SliderStepper
            label="Out (frames)"
            value={track.outFrame}
            step={1}
            min={track.inFrame + 1}
            sliderMax={Math.max(track.outFrame, track.inFrame + 1)}
            onChange={(val) => audioStore.setInOut(track.id, track.inFrame, val)}
            ariaLabel="Out frames"
          />
        </div>
      </div>

      {/* BEAT SYNC accordion — BPM + AUTO-ARRANGE, collapsed on open */}
      <CollapsibleSection title="BEAT SYNC" collapsed={beatSyncCollapsed.current}>
        <div class="flex flex-col" style={{gap: '10px', marginTop: '6px', paddingBottom: '4px'}}>
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
            {/* x2 and /2 quick-adjust buttons */}
            <button
              class="text-[10px] px-1.5 py-0.5 rounded bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              class="text-[10px] px-1.5 py-0.5 rounded bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            class="text-[10px] px-2 py-1 rounded bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
            onClick={() => audioStore.detectAndSetBPM(track.id, projectStore.fps.peek())}
            title="Re-detect BPM from audio"
          >
            Re-detect BPM
          </button>

          {/* AUTO-ARRANGE — gated on bpm + beat markers so BPM stays reachable */}
          {track.bpm != null && track.beatMarkers.length > 0 && (
            <div>
              <SectionLabel text="AUTO-ARRANGE" />
              <div class="flex flex-col" style={{gap: '8px', marginTop: '6px'}}>
                <AutoArrangeSection track={track} />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
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
                ? 'bg-(--color-accent) text-white'
                : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item)'
            }`}
            onClick={() => setStrategy(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        class="w-full text-[10px] px-2 py-1.5 rounded bg-(--color-accent) text-white hover:brightness-125 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleApply}
        disabled={!activeSeq || activeSeq.keyPhotos.length === 0}
        title={!activeSeq ? 'Select a content sequence first' : 'Apply auto-arrange'}
      >
        Apply
      </button>
      {!activeSeq && (
        <div class="text-[10px] text-(--color-text-muted)">
          Select a content sequence to arrange
        </div>
      )}
    </>
  );
}

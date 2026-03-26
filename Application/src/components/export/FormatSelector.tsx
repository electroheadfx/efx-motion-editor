import {useEffect} from 'preact/hooks';
import {exportStore} from '../../stores/exportStore';
import {projectStore} from '../../stores/projectStore';
import {audioStore} from '../../stores/audioStore';
import {motionBlurStore} from '../../stores/motionBlurStore';
import {sequenceStore} from '../../stores/sequenceStore';
import type {ExportFormat, ExportResolution} from '../../types/export';

const FORMATS: {value: ExportFormat; label: string; ext: string}[] = [
  {value: 'png', label: 'PNG Sequence', ext: '.png'},
  {value: 'prores', label: 'ProRes', ext: '.mov'},
  {value: 'h264', label: 'H.264', ext: '.mp4'},
  {value: 'av1', label: 'AV1', ext: '.mp4'},
];

const RESOLUTIONS: ExportResolution[] = [0.15, 0.25, 0.5, 1, 2];

const PRORES_PROFILES: {value: string; label: string}[] = [
  {value: 'proxy', label: 'Proxy'},
  {value: 'lt', label: 'LT'},
  {value: 'standard', label: 'Standard'},
  {value: 'hq', label: 'HQ'},
];

export function FormatSelector() {
  const currentFormat = exportStore.format.value;
  const currentResolution = exportStore.resolution.value;
  const baseWidth = projectStore.width.value;
  const baseHeight = projectStore.height.value;
  const projectName = projectStore.name.value;
  const quality = exportStore.videoQuality.value;
  const namingPattern = exportStore.namingPattern.value;
  const includeAudio = exportStore.includeAudio.value;
  const hasAudioTracks = audioStore.tracks.value.length > 0;
  const mbEnabled = exportStore.motionBlurEnabled.value;
  const mbShutterAngle = exportStore.motionBlurShutterAngle.value;
  const mbSubFrames = exportStore.motionBlurSubFrames.value;
  const selectedSeqOnly = exportStore.selectedSequenceOnly.value;
  const activeSeq = sequenceStore.sequences.value.find(
    s => s.id === sequenceStore.activeSequenceId.value
  );

  // Default export shutter angle to project preview value (per D-11)
  useEffect(() => {
    exportStore.setMotionBlurShutterAngle(motionBlurStore.shutterAngle.peek());
  }, []);

  // Generate preview filename from naming pattern
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const previewFilename = namingPattern
    .replace('{name}', safeName)
    .replace('{frame}', '0001');

  return (
    <div class="flex flex-col gap-6">
      {/* Format selector */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-(--color-text-muted)">Format</label>
        <div class="flex flex-wrap gap-2">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              class={`px-4 py-2 rounded-[5px] text-sm transition-colors ${
                currentFormat === fmt.value
                  ? 'bg-(--color-accent) text-white'
                  : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input)'
              }`}
              onClick={() => exportStore.setFormat(fmt.value)}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope: selected sequence only */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-(--color-text-muted)">Scope</label>
        <label class="flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer">
          <input
            type="checkbox"
            checked={selectedSeqOnly}
            onChange={(e) => exportStore.setSelectedSequenceOnly((e.target as HTMLInputElement).checked)}
            class="accent-(--color-accent)"
          />
          Selected sequence only
        </label>
        {selectedSeqOnly && activeSeq && (
          <div class="text-xs text-(--color-text-muted)">
            Exporting: <span class="font-semibold">{activeSeq.name || 'Sequence'}</span> ({activeSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0)} frames)
          </div>
        )}
        {selectedSeqOnly && !activeSeq && (
          <div class="text-xs text-(--color-dot-orange)">
            No sequence selected — will export full timeline
          </div>
        )}
      </div>

      {/* Resolution multiplier */}
      <div class="space-y-2">
        <label class="text-xs font-semibold text-(--color-text-muted)">Resolution</label>
        <div class="flex flex-wrap gap-2">
          {RESOLUTIONS.map((res) => (
            <button
              key={res}
              class={`px-4 py-2 rounded-[5px] text-sm transition-colors ${
                currentResolution === res
                  ? 'bg-(--color-accent) text-white'
                  : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input)'
              }`}
              onClick={() => exportStore.setResolution(res)}
            >
              {res}x
            </button>
          ))}
        </div>
        <div class="text-xs text-(--color-text-muted)">
          {Math.round(baseWidth * currentResolution)} x {Math.round(baseHeight * currentResolution)} px
        </div>
      </div>

      {/* Video quality (shown only for video formats) */}
      {currentFormat !== 'png' && (
        <div class="space-y-3">
          <label class="text-xs font-semibold text-(--color-text-muted)">Quality</label>

          {/* H.264 CRF slider */}
          {currentFormat === 'h264' && (
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-sm text-(--color-text-secondary)">CRF</span>
                <span class="text-sm text-(--color-text-secondary) font-mono w-8 text-right">{quality.h264Crf}</span>
              </div>
              <input
                type="range"
                min={0}
                max={51}
                value={quality.h264Crf}
                onInput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  exportStore.setVideoQuality({...quality, h264Crf: val});
                }}
                class="w-full accent-(--color-accent)"
              />
              <div class="flex justify-between text-xs text-(--color-text-muted)">
                <span>Best quality</span>
                <span>Smallest file</span>
              </div>
            </div>
          )}

          {/* AV1 CRF slider */}
          {currentFormat === 'av1' && (
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-sm text-(--color-text-secondary)">CRF</span>
                <span class="text-sm text-(--color-text-secondary) font-mono w-8 text-right">{quality.av1Crf}</span>
              </div>
              <input
                type="range"
                min={0}
                max={63}
                value={quality.av1Crf}
                onInput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  exportStore.setVideoQuality({...quality, av1Crf: val});
                }}
                class="w-full accent-(--color-accent)"
              />
              <div class="flex justify-between text-xs text-(--color-text-muted)">
                <span>Best quality</span>
                <span>Smallest file</span>
              </div>
            </div>
          )}

          {/* ProRes profile selector */}
          {currentFormat === 'prores' && (
            <div class="flex flex-wrap gap-2">
              {PRORES_PROFILES.map((p) => (
                <button
                  key={p.value}
                  class={`px-3 py-1.5 rounded-[5px] text-sm transition-colors ${
                    quality.proresProfile === p.value
                      ? 'bg-(--color-accent) text-white'
                      : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input)'
                  }`}
                  onClick={() => exportStore.setVideoQuality({...quality, proresProfile: p.value as 'proxy' | 'lt' | 'standard' | 'hq'})}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PNG naming pattern */}
      {currentFormat === 'png' && (
        <div class="space-y-2">
          <label class="text-xs font-semibold text-(--color-text-muted)">Naming Pattern</label>
          <input
            type="text"
            value={namingPattern}
            onInput={(e) => exportStore.setNamingPattern((e.target as HTMLInputElement).value)}
            class="w-full text-sm text-(--color-text-secondary) font-mono bg-(--color-bg-settings) px-3 py-2 rounded-[5px] border border-(--color-border-subtle) focus:border-(--color-accent) outline-none"
            placeholder="{name}_{frame}.png"
          />
          <div class="text-xs text-(--color-text-muted)">
            Preview: <span class="font-mono">{previewFilename}</span>
          </div>
        </div>
      )}

      {/* Include Audio toggle (per D-04) */}
      {hasAudioTracks && (
        <div class="space-y-2">
          <label class="text-xs font-semibold text-(--color-text-muted)">Audio</label>
          <label class="flex items-center gap-2 text-sm text-(--color-text-secondary) cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => exportStore.setIncludeAudio((e.target as HTMLInputElement).checked)}
              class="accent-(--color-accent)"
            />
            Include audio in export
          </label>
          {currentFormat === 'png' && includeAudio && (
            <div class="text-xs text-(--color-text-muted)">
              Audio will be exported as a WAV file alongside the PNG sequence
            </div>
          )}
        </div>
      )}

      {/* Motion Blur section (per D-09) */}
      <div class="space-y-3">
        <label class="text-xs font-semibold text-(--color-text-muted)">Motion Blur</label>

        {/* Enable toggle */}
        <div class="flex items-center justify-between">
          <span class="text-sm text-(--color-text-secondary)">Enabled</span>
          <button
            class={`w-10 h-5 rounded-full transition-colors relative ${
              mbEnabled ? 'bg-(--color-accent)' : 'bg-(--color-bg-settings)'
            }`}
            onClick={() => exportStore.setMotionBlurEnabled(!mbEnabled)}
          >
            <div class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
              mbEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {mbEnabled && (
          <>
            {/* Shutter Angle override (per D-11: defaults to project preview value) */}
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-sm text-(--color-text-secondary)">Shutter Angle</span>
                <span class="text-sm text-(--color-text-secondary) font-mono w-12 text-right">{mbShutterAngle}deg</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={mbShutterAngle}
                onInput={(e) => exportStore.setMotionBlurShutterAngle(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-(--color-accent)"
              />
            </div>

            {/* Sample count selector */}
            <div class="space-y-1">
              <span class="text-sm text-(--color-text-secondary)">Samples</span>
              <div class="flex gap-1.5">
                {[8, 16, 32, 64, 128].map((n) => (
                  <button
                    key={n}
                    class={`flex-1 px-2 py-1.5 rounded-[5px] text-sm transition-colors ${
                      mbSubFrames === n
                        ? 'bg-(--color-accent) text-white'
                        : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input)'
                    }`}
                    onClick={() => exportStore.setMotionBlurSubFrames(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div class="text-xs text-(--color-text-muted)">
                Higher = smoother blur, slower export
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

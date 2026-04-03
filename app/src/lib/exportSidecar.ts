import type { Sequence } from '../types/sequence';

interface SidecarInput {
  projectName: string;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  resolution: number;
  format: string;
  namingPattern: string;
  sequences: Sequence[];
}

/**
 * Generate JSON metadata sidecar per D-21.
 * Contains: fps, resolution, frame count, duration, sequence mapping,
 * transition frame ranges, export settings.
 */
export function generateJsonSidecar(input: SidecarInput): string {
  const duration = input.totalFrames / input.fps;

  const sequenceMapping = input.sequences
    .filter(s => s.kind === 'content')
    .map(s => ({
      id: s.id,
      name: s.name,
      keyPhotoCount: s.keyPhotos.length,
      totalFrames: s.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0),
      transitions: {
        fadeIn: s.fadeIn ? { duration: s.fadeIn.duration, curve: s.fadeIn.curve, mode: s.fadeIn.mode } : null,
        fadeOut: s.fadeOut ? { duration: s.fadeOut.duration, curve: s.fadeOut.curve, mode: s.fadeOut.mode } : null,
        crossDissolve: s.crossDissolve ? { duration: s.crossDissolve.duration } : null,
      },
    }));

  const sidecar = {
    version: 1,
    generator: 'EFX Motion Editor',
    exportDate: new Date().toISOString(),
    project: {
      name: input.projectName,
      fps: input.fps,
      width: input.width,
      height: input.height,
      resolutionMultiplier: input.resolution,
    },
    output: {
      format: input.format,
      totalFrames: input.totalFrames,
      duration: Math.round(duration * 1000) / 1000, // 3 decimal places
      namingPattern: input.namingPattern,
    },
    sequences: sequenceMapping,
  };

  return JSON.stringify(sidecar, null, 2);
}

/**
 * Generate FCPXML sidecar for ProRes exports per D-22.
 * Simple single-clip reference at correct FPS/resolution.
 * Uses FCPXML v1.11 DTD.
 */
export function generateFcpxml(
  projectName: string,
  fps: number,
  width: number,
  height: number,
  totalFrames: number,
  videoFilename: string,
): string {
  const duration = `${totalFrames * 100}/${fps * 100}s`; // rational time
  const frameDuration = `${100}/${fps * 100}s`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
  <resources>
    <format id="r1" name="FFVideoFormat${height}p${fps}" frameDuration="${frameDuration}" width="${width}" height="${height}"/>
    <asset id="r2" name="${projectName}" src="file://./${videoFilename}" start="0s" duration="${duration}" hasVideo="1" format="r1"/>
  </resources>
  <library>
    <event name="${projectName} Export">
      <project name="${projectName}">
        <sequence format="r1" duration="${duration}">
          <spine>
            <asset-clip ref="r2" offset="0s" name="${projectName}" duration="${duration}" format="r1"/>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

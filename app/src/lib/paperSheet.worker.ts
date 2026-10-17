/**
 * 261017-mz9: module worker for procedural paper-sheet generation.
 *
 * The main thread must never pay the sheet cost. One request shape in, one
 * response out: GPU three-pass on an OffscreenCanvas when WebGL2 is available
 * (the playground's shape → instant), CPU field fallback otherwise. Both paths
 * report a path label and return RGBA bytes at the CAPPED field size.
 *
 * The GLSL sources are imported verbatim from paperFieldGl.ts (the playground
 * port) — never re-derived here. This file only wires the three-pass pipeline
 * against an OffscreenCanvas, the same way paperFieldGl wires it against a
 * document canvas.
 */
/// <reference lib="webworker" />

import {
  linearRGB,
  PAPER_UNITS,
  presetForPaperId,
  type StudioPaperPreset,
} from '@efxlab/efx-watercolor/papers';
import {
  PAPER_FIELD_FS,
  PAPER_LIGHT_FS,
  PAPER_SHEET_FS,
  QUAD_VS,
} from './paperFieldGl';
import {
  capFieldSize,
  generatePaperSheetCpu,
  normalizeGrainScale,
} from './paperSheetField';

export interface PaperSheetWorkerRequest {
  requestKey: string;
  paperTexture: string;
  width: number;
  height: number;
  grainScale: number;
}

export interface PaperSheetWorkerResponse {
  requestKey: string;
  path: 'worker-gpu' | 'worker-cpu';
  fieldWidth: number;
  fieldHeight: number;
  durationMs: number;
  pixels: ArrayBuffer | null;
}

// ---- Compact OffscreenCanvas WebGL2 host (paperFieldGl shape, worker-safe) ----

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  dispose(): void;
}

function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  preferFloat: boolean,
): RenderTarget | null {
  const floatOk = preferFloat && (
    !!gl.getExtension('EXT_color_buffer_float')
    || !!gl.getExtension('EXT_color_buffer_half_float')
  );
  const attempts: Array<{ internal: number; filter: number }> = floatOk
    ? [{ internal: gl.RGBA16F, filter: gl.NEAREST }, { internal: gl.RGBA8, filter: gl.LINEAR }]
    : [{ internal: gl.RGBA8, filter: gl.LINEAR }];

  for (const attempt of attempts) {
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) {
      if (tex) gl.deleteTexture(tex);
      if (fbo) gl.deleteFramebuffer(fbo);
      continue;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, attempt.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, attempt.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, attempt.internal, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return {
        fbo,
        tex,
        dispose() {
          gl.deleteFramebuffer(fbo);
          gl.deleteTexture(tex);
        },
      };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
  }
  return null;
}

function uniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

/**
 * Three-pass sheet at the capped field size on an OffscreenCanvas:
 *   1. PAPER_FIELD_FS → field
 *   2. PAPER_LIGHT_FS → packed paper texel (uBump = (preset.bump * 1.4) / scale)
 *   3. PAPER_SHEET_FS → opaque sRGB on the default framebuffer
 * then one readPixels (in the worker — never the main thread) flipped to DOM
 * orientation so the CPU and GPU paths return the same row order.
 */
function renderSheetGl(
  fieldWidth: number,
  fieldHeight: number,
  uScale: number,
  seed: number,
  preset: StudioPaperPreset,
): Uint8ClampedArray | null {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(fieldWidth, fieldHeight);
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return null;

    const fieldProgram = createProgram(gl, QUAD_VS, PAPER_FIELD_FS);
    const lightProgram = createProgram(gl, QUAD_VS, PAPER_LIGHT_FS);
    const sheetProgram = createProgram(gl, QUAD_VS, PAPER_SHEET_FS);
    if (!fieldProgram || !lightProgram || !sheetProgram) {
      if (fieldProgram) gl.deleteProgram(fieldProgram);
      if (lightProgram) gl.deleteProgram(lightProgram);
      if (sheetProgram) gl.deleteProgram(sheetProgram);
      return null;
    }

    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    if (!vao || !vbo) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const field = createTarget(gl, fieldWidth, fieldHeight, true);
    const paper = createTarget(gl, fieldWidth, fieldHeight, false);
    if (!field || !paper) {
      field?.dispose();
      paper?.dispose();
      return null;
    }

    try {
      gl.bindVertexArray(vao);
      gl.viewport(0, 0, fieldWidth, fieldHeight);

      gl.bindFramebuffer(gl.FRAMEBUFFER, field.fbo);
      gl.useProgram(fieldProgram);
      gl.uniform2f(uniform(gl, fieldProgram, 'uRes'), fieldWidth, fieldHeight);
      gl.uniform2f(uniform(gl, fieldProgram, 'uOffset'), 0, 0);
      gl.uniform1f(uniform(gl, fieldProgram, 'uScale'), uScale);
      gl.uniform1f(uniform(gl, fieldProgram, 'uSeed'), seed);
      gl.uniform1i(uniform(gl, fieldProgram, 'uKind'), preset.kind);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, paper.fbo);
      gl.useProgram(lightProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, field.tex);
      gl.uniform1i(uniform(gl, lightProgram, 'uField'), 0);
      gl.uniform2f(uniform(gl, lightProgram, 'uTexel'), 1 / fieldWidth, 1 / fieldHeight);
      gl.uniform1f(uniform(gl, lightProgram, 'uBump'), (preset.bump * 1.4) / uScale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(sheetProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paper.tex);
      gl.uniform1i(uniform(gl, sheetProgram, 'uPaper'), 0);
      gl.uniform3fv(uniform(gl, sheetProgram, 'uPaperTint'), linearRGB(preset.tint));
      gl.uniform3fv(uniform(gl, sheetProgram, 'uFleckTint'), linearRGB(preset.fleck));
      gl.uniform1f(uniform(gl, sheetProgram, 'uMottle'), preset.mottle);
      gl.uniform1f(uniform(gl, sheetProgram, 'uTexture'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const raw = new Uint8Array(fieldWidth * fieldHeight * 4);
      gl.readPixels(0, 0, fieldWidth, fieldHeight, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const out = new Uint8ClampedArray(raw.length);
      const rowBytes = fieldWidth * 4;
      for (let y = 0; y < fieldHeight; y++) {
        const src = (fieldHeight - 1 - y) * rowBytes;
        out.set(raw.subarray(src, src + rowBytes), y * rowBytes);
      }
      return out;
    } finally {
      field.dispose();
      paper.dispose();
    }
  } catch {
    return null;
  }
}

function handleRequest(request: PaperSheetWorkerRequest): PaperSheetWorkerResponse {
  const started = Date.now();
  const { requestKey, paperTexture, width, height, grainScale } = request;
  const { fieldWidth, fieldHeight } = capFieldSize(width, height);
  const preset = presetForPaperId(paperTexture);
  const base = {
    requestKey,
    fieldWidth,
    fieldHeight,
    durationMs: 0,
    pixels: null as ArrayBuffer | null,
  };
  if (!preset) {
    return { ...base, path: 'worker-cpu', durationMs: Date.now() - started };
  }
  const uScale = PAPER_UNITS / (fieldHeight * normalizeGrainScale(grainScale));
  const gpuPixels = renderSheetGl(fieldWidth, fieldHeight, uScale, 1, preset);
  if (gpuPixels) {
    return {
      ...base,
      path: 'worker-gpu',
      durationMs: Date.now() - started,
      pixels: gpuPixels.buffer as ArrayBuffer,
    };
  }
  const cpuPixels = generatePaperSheetCpu(paperTexture, fieldWidth, fieldHeight, grainScale);
  return {
    ...base,
    path: 'worker-cpu',
    durationMs: Date.now() - started,
    pixels: cpuPixels ? (cpuPixels.buffer as ArrayBuffer) : null,
  };
}

self.addEventListener('message', (event: MessageEvent<PaperSheetWorkerRequest>) => {
  const request = event.data;
  if (!request || typeof request.requestKey !== 'string') return;
  try {
    const response = handleRequest(request);
    const transfer: Transferable[] = response.pixels ? [response.pixels] : [];
    (self as unknown as Worker).postMessage(response, transfer);
  } catch {
    // Never throw out of the handler — a failure posts a null result with the same key.
    (self as unknown as Worker).postMessage({
      requestKey: request.requestKey,
      path: 'worker-cpu',
      fieldWidth: 1,
      fieldHeight: 1,
      durationMs: 0,
      pixels: null,
    } satisfies PaperSheetWorkerResponse);
  }
});

/**
 * WebGL2 brush FX rendering pipeline with spectral compositing.
 *
 * Renders styled (non-flat) PaintStroke objects to an offscreen WebGL2 canvas
 * using stamp-based stroke rasterization, Kubelka-Munk spectral pigment mixing,
 * and post-effect passes (grain, edge darkening, bleed).
 *
 * Returns the offscreen canvas for the caller to composite via ctx.drawImage().
 * Returns null when WebGL2 is unavailable (caller falls back to flat rendering).
 *
 * Architecture follows the same lazy-init pattern as glBlur.ts.
 */

import {getStroke} from 'perfect-freehand';
import type {PaintStroke, BrushStyle} from '../types/paint';
import {
  BRUSH_FX_VERT_SRC,
  STAMP_VERT_SRC,
  STAMP_FRAG_SRC,
  buildSpectralCompositeSrc,
  buildGrainPostSrc,
  EDGE_DARKEN_POST_FRAG_SRC,
  buildBleedPostSrc,
  buildScatterStampSrc,
} from './brushFxShaders';

// ---------------------------------------------------------------------------
// Module-level state (same pattern as glBlur.ts)
// ---------------------------------------------------------------------------

let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _initFailed = false;
let _currentW = 0;
let _currentH = 0;

// Cached shader programs
let _stampProgram: WebGLProgram | null = null;
let _scatterStampProgram: WebGLProgram | null = null;
let _compositeProgram: WebGLProgram | null = null;
let _grainProgram: WebGLProgram | null = null;
let _edgeDarkenProgram: WebGLProgram | null = null;
let _bleedProgram: WebGLProgram | null = null;
let _passthroughProgram: WebGLProgram | null = null;

// Framebuffer resources
// Stroke FBO: individual stroke rendering target
let _strokeFBO: WebGLFramebuffer | null = null;
let _strokeTex: WebGLTexture | null = null;
// Accumulation FBOs: ping-pong pair for spectral compositing
let _accumFBO_A: WebGLFramebuffer | null = null;
let _accumTex_A: WebGLTexture | null = null;
let _accumFBO_B: WebGLFramebuffer | null = null;
let _accumTex_B: WebGLTexture | null = null;
// Post-effect FBO
let _postFBO: WebGLFramebuffer | null = null;
let _postTex: WebGLTexture | null = null;

// Quad geometry (shared VAOs)
let _quadVAO: WebGLVertexArrayObject | null = null;
let _stampVAO: WebGLVertexArrayObject | null = null;

// Passthrough fragment shader (inline, trivial)
const PASSTHROUGH_FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_input;
out vec4 out_fragColor;
void main() { out_fragColor = texture(u_input, v_texCoord); }
`;

// Style-dependent hardness values: 0 = very soft, 1 = hard edge
const STYLE_HARDNESS: Record<BrushStyle, number> = {
  flat: 1.0,
  watercolor: 0.2,
  ink: 0.7,
  charcoal: 0.3,
  pencil: 0.8,
  marker: 0.9,
};

// ---------------------------------------------------------------------------
// GL helpers
// ---------------------------------------------------------------------------

function getGL(): WebGL2RenderingContext | null {
  if (_initFailed) return null;
  if (_gl) return _gl;

  _glCanvas = document.createElement('canvas');
  const gl = _glCanvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });

  if (!gl) {
    console.warn('brushFxRenderer: WebGL2 not available, falling back to flat rendering');
    _initFailed = true;
    return null;
  }

  // Lazy re-init on context loss
  _glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    _gl = null;
    clearAllResources();
  });

  _gl = gl;
  return _gl;
}

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
    console.warn('brushFxRenderer shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkProgram(
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
    console.warn('brushFxRenderer program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// ---------------------------------------------------------------------------
// Texture & FBO helpers
// ---------------------------------------------------------------------------

function createTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function createFBO(gl: WebGL2RenderingContext, texture: WebGLTexture): WebGLFramebuffer | null {
  const fbo = gl.createFramebuffer();
  if (!fbo) return null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.warn('brushFxRenderer: FBO incomplete:', status);
    gl.deleteFramebuffer(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

// ---------------------------------------------------------------------------
// VAO setup
// ---------------------------------------------------------------------------

function setupQuadVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray();
  if (!vao) return null;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // Fullscreen triangle strip: position [-1,-1] to [1,1]
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

function setupStampVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray();
  if (!vao) return null;
  gl.bindVertexArray(vao);

  // Position buffer (location 0): [-1,-1] to [1,1]
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Texcoord buffer (location 1): [0,0] to [1,1]
  const tcBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tcBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  return vao;
}

// ---------------------------------------------------------------------------
// Resource management
// ---------------------------------------------------------------------------

function clearAllResources(): void {
  _stampProgram = null;
  _scatterStampProgram = null;
  _compositeProgram = null;
  _grainProgram = null;
  _edgeDarkenProgram = null;
  _bleedProgram = null;
  _passthroughProgram = null;
  _strokeFBO = null;
  _strokeTex = null;
  _accumFBO_A = null;
  _accumTex_A = null;
  _accumFBO_B = null;
  _accumTex_B = null;
  _postFBO = null;
  _postTex = null;
  _quadVAO = null;
  _stampVAO = null;
  _currentW = 0;
  _currentH = 0;
}

function deleteTexAndFBO(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture | null,
  fbo: WebGLFramebuffer | null,
): void {
  if (tex) gl.deleteTexture(tex);
  if (fbo) gl.deleteFramebuffer(fbo);
}

function deleteFBOs(gl: WebGL2RenderingContext): void {
  deleteTexAndFBO(gl, _strokeTex, _strokeFBO);
  deleteTexAndFBO(gl, _accumTex_A, _accumFBO_A);
  deleteTexAndFBO(gl, _accumTex_B, _accumFBO_B);
  deleteTexAndFBO(gl, _postTex, _postFBO);
  _strokeFBO = _strokeTex = null;
  _accumFBO_A = _accumTex_A = null;
  _accumFBO_B = _accumTex_B = null;
  _postFBO = _postTex = null;
}

function ensurePrograms(gl: WebGL2RenderingContext): boolean {
  if (_stampProgram) return true; // Already compiled

  _stampProgram = linkProgram(gl, STAMP_VERT_SRC, STAMP_FRAG_SRC);
  _scatterStampProgram = linkProgram(gl, STAMP_VERT_SRC, buildScatterStampSrc());
  _compositeProgram = linkProgram(gl, BRUSH_FX_VERT_SRC, buildSpectralCompositeSrc());
  _grainProgram = linkProgram(gl, BRUSH_FX_VERT_SRC, buildGrainPostSrc());
  _edgeDarkenProgram = linkProgram(gl, BRUSH_FX_VERT_SRC, EDGE_DARKEN_POST_FRAG_SRC);
  _bleedProgram = linkProgram(gl, BRUSH_FX_VERT_SRC, buildBleedPostSrc());
  _passthroughProgram = linkProgram(gl, BRUSH_FX_VERT_SRC, PASSTHROUGH_FRAG_SRC);

  if (!_stampProgram || !_compositeProgram || !_passthroughProgram) {
    console.warn('brushFxRenderer: failed to compile required shader programs');
    return false;
  }
  return true;
}

function ensureFBOs(gl: WebGL2RenderingContext, w: number, h: number): boolean {
  if (_currentW === w && _currentH === h && _strokeFBO) return true;

  // Tear down old FBOs if dimensions changed
  deleteFBOs(gl);

  // Create textures
  _strokeTex = createTexture(gl, w, h);
  _accumTex_A = createTexture(gl, w, h);
  _accumTex_B = createTexture(gl, w, h);
  _postTex = createTexture(gl, w, h);

  if (!_strokeTex || !_accumTex_A || !_accumTex_B || !_postTex) {
    deleteFBOs(gl);
    return false;
  }

  // Create FBOs
  _strokeFBO = createFBO(gl, _strokeTex);
  _accumFBO_A = createFBO(gl, _accumTex_A);
  _accumFBO_B = createFBO(gl, _accumTex_B);
  _postFBO = createFBO(gl, _postTex);

  if (!_strokeFBO || !_accumFBO_A || !_accumFBO_B || !_postFBO) {
    deleteFBOs(gl);
    return false;
  }

  _currentW = w;
  _currentH = h;
  return true;
}

function ensureVAOs(gl: WebGL2RenderingContext): boolean {
  if (_quadVAO && _stampVAO) return true;
  _quadVAO = setupQuadVAO(gl);
  _stampVAO = setupStampVAO(gl);
  return !!_quadVAO && !!_stampVAO;
}

function ensureResources(gl: WebGL2RenderingContext, w: number, h: number): boolean {
  // Resize canvas if needed
  if (_glCanvas!.width !== w || _glCanvas!.height !== h) {
    _glCanvas!.width = w;
    _glCanvas!.height = h;
  }

  if (!ensurePrograms(gl)) return false;
  if (!ensureFBOs(gl, w, h)) return false;
  if (!ensureVAOs(gl)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Convert hex "#RRGGBB" + opacity to [r, g, b, a] in linear RGB.
 * Spectral mixing operates in linear space, so we apply gamma decompression.
 */
function hexToGLColor(hex: string, opacity: number): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // sRGB to linear: linearR = pow(sRGBr, 2.2)
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), opacity];
}

// ---------------------------------------------------------------------------
// Stamp position computation
// ---------------------------------------------------------------------------

interface StampPosition {
  x: number;
  y: number;
  pressure: number;
}

/**
 * Compute stamp positions along the centroid of a perfect-freehand outline.
 * Returns positions spaced at intervals of stroke.size * 0.3 for smooth stamps.
 */
function computeStampPositions(stroke: PaintStroke): StampPosition[] {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: stroke.options.thinning,
    smoothing: stroke.options.smoothing,
    streamline: stroke.options.streamline,
    simulatePressure: stroke.options.simulatePressure,
    last: true,
  });

  if (outline.length < 2) return [];

  // Compute centroid path from outline (midpoints of corresponding edges)
  // The outline is a closed polygon; the first half goes one direction,
  // second half returns. We use the raw input points as centroids instead,
  // as they better represent the intended path.
  const centroids: StampPosition[] = [];
  for (const pt of stroke.points) {
    centroids.push({x: pt[0], y: pt[1], pressure: pt[2]});
  }

  if (centroids.length === 0) return [];
  if (centroids.length === 1) return [centroids[0]];

  // Re-sample at regular intervals
  const spacing = Math.max(stroke.size * 0.3, 1);
  const result: StampPosition[] = [centroids[0]];
  let accumulated = 0;
  let prevX = centroids[0].x;
  let prevY = centroids[0].y;

  for (let i = 1; i < centroids.length; i++) {
    const dx = centroids[i].x - prevX;
    const dy = centroids[i].y - prevY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    accumulated += dist;

    while (accumulated >= spacing) {
      // Interpolate position
      const overshoot = accumulated - spacing;
      const t = 1 - overshoot / dist;
      const ix = prevX + dx * t;
      const iy = prevY + dy * t;
      const ip = centroids[i - 1].pressure + (centroids[i].pressure - centroids[i - 1].pressure) * t;
      result.push({x: ix, y: iy, pressure: ip});
      accumulated -= spacing;
    }

    prevX = centroids[i].x;
    prevY = centroids[i].y;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stroke stamp rendering
// ---------------------------------------------------------------------------

function renderStrokeStamps(
  gl: WebGL2RenderingContext,
  stroke: PaintStroke,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, _strokeFBO);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Choose stamp program based on style
  const style = stroke.brushStyle ?? 'flat';
  const useScatter = style === 'charcoal' && _scatterStampProgram;
  const program = useScatter ? _scatterStampProgram! : _stampProgram!;

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Set common uniforms
  const uCenter = gl.getUniformLocation(program, 'u_center');
  const uSize = gl.getUniformLocation(program, 'u_size');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uColor = gl.getUniformLocation(program, 'u_color');
  const uHardness = gl.getUniformLocation(program, 'u_hardness');

  gl.uniform2f(uResolution, w, h);

  const [r, g, b, a] = hexToGLColor(stroke.color, stroke.opacity);
  gl.uniform4f(uColor, r, g, b, a);

  const hardness = STYLE_HARDNESS[style] ?? 0.5;
  gl.uniform1f(uHardness, hardness);

  // Set scatter uniform if using scatter program
  if (useScatter) {
    const uScatter = gl.getUniformLocation(program, 'u_scatter');
    gl.uniform1f(uScatter, stroke.brushParams?.scatter ?? 0.4);
  }

  gl.bindVertexArray(_stampVAO);

  // Compute stamp positions and render each
  const stamps = computeStampPositions(stroke);
  for (const stamp of stamps) {
    const stampSize = stroke.size * stamp.pressure;
    gl.uniform2f(uCenter, stamp.x, stamp.y);
    gl.uniform2f(uSize, stampSize, stampSize);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

// ---------------------------------------------------------------------------
// Spectral compositing
// ---------------------------------------------------------------------------

function compositeSpectral(
  gl: WebGL2RenderingContext,
  existingTex: WebGLTexture,
  newStrokeTex: WebGLTexture,
  targetFBO: WebGLFramebuffer,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
  gl.viewport(0, 0, w, h);

  gl.useProgram(_compositeProgram!);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, existingTex);
  gl.uniform1i(gl.getUniformLocation(_compositeProgram!, 'u_existing'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, newStrokeTex);
  gl.uniform1i(gl.getUniformLocation(_compositeProgram!, 'u_newStroke'), 1);

  gl.bindVertexArray(_quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

// ---------------------------------------------------------------------------
// Post-effect passes
// ---------------------------------------------------------------------------

function applyPostEffect(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  inputTex: WebGLTexture,
  targetFBO: WebGLFramebuffer,
  w: number,
  h: number,
  uniforms: Record<string, number>,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
  gl.viewport(0, 0, w, h);
  gl.useProgram(program);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, inputTex);
  gl.uniform1i(gl.getUniformLocation(program, 'u_input'), 0);

  // Set resolution uniform if the program uses it
  const uRes = gl.getUniformLocation(program, 'u_resolution');
  if (uRes) gl.uniform2f(uRes, w, h);

  // Set additional uniforms
  for (const [name, value] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) gl.uniform1f(loc, value);
  }

  gl.bindVertexArray(_quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

function applyGrainEffect(
  gl: WebGL2RenderingContext,
  inputTex: WebGLTexture,
  targetFBO: WebGLFramebuffer,
  w: number,
  h: number,
  grain: number,
): void {
  if (!_grainProgram) return;
  applyPostEffect(gl, _grainProgram, inputTex, targetFBO, w, h, {u_grain: grain});
}

function applyBleedEffect(
  gl: WebGL2RenderingContext,
  inputTex: WebGLTexture,
  targetFBO: WebGLFramebuffer,
  w: number,
  h: number,
  bleed: number,
): void {
  if (!_bleedProgram) return;
  applyPostEffect(gl, _bleedProgram, inputTex, targetFBO, w, h, {u_bleed: bleed});
}

// ---------------------------------------------------------------------------
// Aggregate post-effect params
// ---------------------------------------------------------------------------

interface AggregatedParams {
  grain: number;
  bleed: number;
  edgeDarken: number;
}

/**
 * Aggregate post-effect parameters across all strokes.
 * Takes the max of each FX param (post-effects apply to the entire frame).
 */
function aggregatePostEffectParams(strokes: PaintStroke[]): AggregatedParams {
  let grain = 0;
  let bleed = 0;
  let edgeDarken = 0;

  for (const stroke of strokes) {
    if (stroke.tool === 'eraser') continue;
    const params = stroke.brushParams;
    if (!params) continue;
    if (params.grain !== undefined && params.grain > grain) grain = params.grain;
    if (params.bleed !== undefined && params.bleed > bleed) bleed = params.bleed;
    if (params.edgeDarken !== undefined && params.edgeDarken > edgeDarken) edgeDarken = params.edgeDarken;
  }

  return {grain, bleed, edgeDarken};
}

// ---------------------------------------------------------------------------
// Final blit
// ---------------------------------------------------------------------------

function blitToScreen(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number,
  h: number,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(_passthroughProgram!);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(_passthroughProgram!, 'u_input'), 0);

  gl.bindVertexArray(_quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an array of styled (non-flat) PaintStroke objects to the offscreen
 * WebGL2 canvas using stamp-based stroke rendering, spectral compositing,
 * and post-effect passes.
 *
 * @param strokes - Array of PaintStroke objects to render
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns The offscreen HTMLCanvasElement, or null if WebGL2 unavailable
 */
export function renderStyledStrokes(
  strokes: PaintStroke[],
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const gl = getGL();
  if (!gl || !_glCanvas) return null;
  if (!ensureResources(gl, width, height)) return null;
  if (!_stampProgram || !_compositeProgram) return null;

  // Filter to non-eraser strokes (erasers handled by Canvas 2D path)
  const renderStrokes = strokes.filter((s) => s.tool !== 'eraser');
  if (renderStrokes.length === 0) return null;

  // Clear accumulation buffer A
  gl.bindFramebuffer(gl.FRAMEBUFFER, _accumFBO_A);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Also clear B
  gl.bindFramebuffer(gl.FRAMEBUFFER, _accumFBO_B);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  let readAccumTex = _accumTex_A!;
  let writeAccumFBO = _accumFBO_B!;
  let writeAccumTex = _accumTex_B!;

  for (const stroke of renderStrokes) {
    // 1. Render stroke stamps to _strokeFBO
    renderStrokeStamps(gl, stroke, width, height);

    // 2. Composite _strokeTex onto accumulation buffer using spectral mix
    compositeSpectral(gl, readAccumTex, _strokeTex!, writeAccumFBO, width, height);

    // 3. Swap ping-pong buffers
    const tmpTex = readAccumTex;
    const tmpFBO = writeAccumFBO === _accumFBO_B ? _accumFBO_A! : _accumFBO_B!;
    readAccumTex = writeAccumTex;
    writeAccumTex = tmpTex;
    writeAccumFBO = tmpFBO;
  }

  // 4. Apply post-effects
  const postParams = aggregatePostEffectParams(renderStrokes);
  let currentTex = readAccumTex;

  if (postParams.edgeDarken > 0.01 && _edgeDarkenProgram) {
    applyPostEffect(gl, _edgeDarkenProgram, currentTex, _postFBO!, width, height, {
      u_edgeDarken: postParams.edgeDarken,
    });
    currentTex = _postTex!;
  }

  if (postParams.bleed > 0.01 && _bleedProgram) {
    // Use the write accumulation buffer as temp target
    applyBleedEffect(gl, currentTex, writeAccumFBO, width, height, postParams.bleed);
    currentTex = writeAccumTex;
  }

  if (postParams.grain > 0.01 && _grainProgram) {
    // If we already used _postFBO for edge darken, use a different target
    const grainTarget = currentTex === _postTex ? writeAccumFBO : _postFBO!;
    const grainTargetTex = currentTex === _postTex ? writeAccumTex : _postTex!;
    applyGrainEffect(gl, currentTex, grainTarget, width, height, postParams.grain);
    currentTex = grainTargetTex;
  }

  // 5. Final blit to screen (gl canvas)
  blitToScreen(gl, currentTex, width, height);

  return _glCanvas;
}

/**
 * Dispose all WebGL resources. Call when the paint layer is destroyed
 * or the application is shutting down.
 */
export function disposeBrushFx(): void {
  if (!_gl) {
    clearAllResources();
    if (_glCanvas) {
      _glCanvas.remove();
      _glCanvas = null;
    }
    return;
  }

  const gl = _gl;

  // Delete programs
  if (_stampProgram) gl.deleteProgram(_stampProgram);
  if (_scatterStampProgram) gl.deleteProgram(_scatterStampProgram);
  if (_compositeProgram) gl.deleteProgram(_compositeProgram);
  if (_grainProgram) gl.deleteProgram(_grainProgram);
  if (_edgeDarkenProgram) gl.deleteProgram(_edgeDarkenProgram);
  if (_bleedProgram) gl.deleteProgram(_bleedProgram);
  if (_passthroughProgram) gl.deleteProgram(_passthroughProgram);

  // Delete FBOs and textures
  deleteFBOs(gl);

  // Delete VAOs
  if (_quadVAO) gl.deleteVertexArray(_quadVAO);
  if (_stampVAO) gl.deleteVertexArray(_stampVAO);

  clearAllResources();

  // Remove canvas from DOM
  if (_glCanvas) {
    _glCanvas.remove();
    _glCanvas = null;
  }

  _gl = null;
  _initFailed = false;
}

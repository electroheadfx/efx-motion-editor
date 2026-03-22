/**
 * WebGL2 GLSL shader runtime for Shadertoy-ported shaders.
 *
 * Manages a shared offscreen WebGL2 context, compiles and caches shader programs,
 * and provides render methods for generator shaders (no input) and FX image shaders
 * (with input texture from the main canvas).
 *
 * Follows the same lazy-init pattern as glBlur.ts.
 */

import type { ShaderDefinition, ShaderParamDef } from './shaderLibrary';

// ---- Vertex shader (fullscreen quad, same as glBlur.ts) ----

const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ---- Fragment shader wrapper ----

function buildFragmentSource(shader: ShaderDefinition): string {
  // Build uniform declarations for custom params
  const paramUniforms = shader.params
    .map(p => `uniform float u_${p.key};`)
    .join('\n');

  // Determine which iChannels to declare based on category
  const channelUniforms = shader.category === 'fx-image'
    ? 'uniform sampler2D iChannel0;\nuniform sampler2D iChannel1;'
    : '';

  return `#version 300 es
precision highp float;

// Shadertoy-compatible uniforms
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
${channelUniforms}

// Custom shader parameters
${paramUniforms}

out vec4 out_fragColor;

// --- Shader code ---
${shader.fragmentSource}

void main() {
  mainImage(out_fragColor, gl_FragCoord.xy);
  out_fragColor.a = 1.0; // force opaque output
}
`;
}

// ---- Cached program state ----

interface CachedProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  paramDefs: ShaderParamDef[];
}

// ---- Runtime state ----

let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _vao: WebGLVertexArrayObject | null = null;
let _inputTexture: WebGLTexture | null = null;
let _initFailed = false;
const _programs: Map<string, CachedProgram> = new Map();

// ---- GL helpers ----

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
    console.warn('glslRuntime: WebGL2 not available');
    _initFailed = true;
    return null;
  }

  _glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    _gl = null;
    _vao = null;
    _inputTexture = null;
    _programs.clear();
  });

  _gl = gl;

  // Create fullscreen quad VAO
  _vao = gl.createVertexArray();
  if (_vao) {
    gl.bindVertexArray(_vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  return _gl;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('glslRuntime shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function getOrCreateProgram(gl: WebGL2RenderingContext, shader: ShaderDefinition): CachedProgram | null {
  const existing = _programs.get(shader.id);
  if (existing) return existing;

  const fragSource = buildFragmentSource(shader);
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('glslRuntime link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Detach and delete shader objects
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  // Collect uniform locations
  const uniforms = new Map<string, WebGLUniformLocation>();
  const stdNames = ['iResolution', 'iTime', 'iFrame', 'iMouse', 'iChannel0', 'iChannel1'];
  for (const name of stdNames) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) uniforms.set(name, loc);
  }
  for (const p of shader.params) {
    const loc = gl.getUniformLocation(program, `u_${p.key}`);
    if (loc) uniforms.set(`u_${p.key}`, loc);
  }

  const cached: CachedProgram = { program, uniforms, paramDefs: shader.params };
  _programs.set(shader.id, cached);
  return cached;
}

function ensureCanvasSize(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, w: number, h: number) {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
}

function bindUniforms(
  gl: WebGL2RenderingContext,
  cached: CachedProgram,
  width: number,
  height: number,
  time: number,
  frame: number,
  params: Record<string, number>,
) {
  const u = cached.uniforms;

  const iRes = u.get('iResolution');
  if (iRes) gl.uniform3f(iRes, width, height, 1.0);

  const iTime = u.get('iTime');
  if (iTime) gl.uniform1f(iTime, time);

  const iFrame = u.get('iFrame');
  if (iFrame) gl.uniform1i(iFrame, frame);

  const iMouse = u.get('iMouse');
  if (iMouse) gl.uniform4f(iMouse, 0, 0, 0, 0);

  // Bind custom params
  for (const p of cached.paramDefs) {
    const loc = u.get(`u_${p.key}`);
    if (loc) {
      gl.uniform1f(loc, params[p.key] ?? p.default);
    }
  }
}

// ---- Public API ----

/**
 * Render a generator shader (no input texture) to the internal offscreen canvas.
 * Returns the canvas for compositing via drawImage, or null on failure.
 */
export function renderGlslGenerator(
  shader: ShaderDefinition,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
  frame: number,
): HTMLCanvasElement | null {
  const gl = getGL();
  if (!gl || !_glCanvas || !_vao) return null;

  const cached = getOrCreateProgram(gl, shader);
  if (!cached) return null;

  ensureCanvasSize(gl, _glCanvas, width, height);
  gl.useProgram(cached.program);
  bindUniforms(gl, cached, width, height, time, frame, params);

  gl.bindVertexArray(_vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);

  return _glCanvas;
}

/**
 * Render an FX image shader with the source canvas as iChannel0 input.
 * Returns the GL canvas for compositing, or null on failure.
 */
export function renderGlslFxImage(
  shader: ShaderDefinition,
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
  frame: number,
): HTMLCanvasElement | null {
  const gl = getGL();
  if (!gl || !_glCanvas || !_vao) return null;

  const cached = getOrCreateProgram(gl, shader);
  if (!cached) return null;

  ensureCanvasSize(gl, _glCanvas, width, height);
  gl.useProgram(cached.program);
  bindUniforms(gl, cached, width, height, time, frame, params);

  // Upload source canvas as iChannel0 (flip Y to match WebGL bottom-left origin)
  if (!_inputTexture) {
    _inputTexture = gl.createTexture();
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, _inputTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // restore default

  const iCh0 = cached.uniforms.get('iChannel0');
  if (iCh0) gl.uniform1i(iCh0, 0);

  gl.bindVertexArray(_vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);

  return _glCanvas;
}

/**
 * Render a shader at small resolution for preview thumbnails.
 * Copies the result to a target 2D canvas.
 */
export function renderShaderPreview(
  shader: ShaderDefinition,
  targetCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  params: Record<string, number>,
  time: number,
): boolean {
  const result = renderGlslGenerator(shader, width, height, params, time, Math.floor(time * 30));
  if (!result) return false;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return false;

  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(result, 0, 0, width, height);
  return true;
}

/** Dispose all cached resources */
export function disposeGlslRuntime() {
  if (_gl) {
    for (const cached of _programs.values()) {
      _gl.deleteProgram(cached.program);
    }
    if (_inputTexture) _gl.deleteTexture(_inputTexture);
  }
  _programs.clear();
  _gl = null;
  _glCanvas = null;
  _vao = null;
  _inputTexture = null;
  _initFailed = false;
}

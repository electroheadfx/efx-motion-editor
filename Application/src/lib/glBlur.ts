/**
 * WebGL2 GPU-accelerated two-pass separable Gaussian blur.
 *
 * Lazy-initializes a shared offscreen WebGL2 context and pre-compiled shaders.
 * Uploads source via texSubImage2D(canvas), ping-pong renders through an FBO,
 * and reads back via drawImage(glCanvas) -- no getImageData/readPixels roundtrip.
 *
 * Returns false when GPU is unavailable so the caller can fall back to CPU blur.
 */

// Inline the same formula as fxBlur.normalizedToPixelRadius to avoid circular import
// (fxBlur imports applyGPUBlur from this module)
function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number {
  if (normalized <= 0) return 0;
  return Math.max(0, Math.round(normalized * normalized * canvasMaxDim * 0.05));
}

// ---- Shader sources ----

const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_direction;
uniform float u_radius;
uniform bool u_preserveAlpha;

float gaussian(float i, float sigma) {
  return exp(-0.5 * (i * i) / (sigma * sigma));
}

void main() {
  float sigma = max(u_radius / 3.0, 1.0);
  int samples = int(ceil(u_radius));
  samples = min(samples, 64);

  float centerAlpha = texture(u_texture, v_texCoord).a;
  vec4 color = texture(u_texture, v_texCoord) * gaussian(0.0, sigma);
  float totalWeight = gaussian(0.0, sigma);

  for (int i = 1; i <= 64; i++) {
    if (i > samples) break;
    float w = gaussian(float(i), sigma);
    vec2 offset = u_direction * float(i);
    color += texture(u_texture, v_texCoord + offset) * w;
    color += texture(u_texture, v_texCoord - offset) * w;
    totalWeight += 2.0 * w;
  }

  color /= totalWeight;

  if (u_preserveAlpha) {
    fragColor = vec4(color.rgb, centerAlpha);
  } else {
    fragColor = color;
  }
}
`;

// ---- Cached GL state ----

interface BlurResources {
  program: WebGLProgram;
  texSource: WebGLTexture;
  texIntermediate: WebGLTexture;
  fbo: WebGLFramebuffer;
  vao: WebGLVertexArrayObject;
  uTexture: WebGLUniformLocation;
  uDirection: WebGLUniformLocation;
  uRadius: WebGLUniformLocation;
  uPreserveAlpha: WebGLUniformLocation;
  width: number;
  height: number;
}

let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _resources: BlurResources | null = null;
let _initFailed: boolean = false;

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
    console.warn('glBlur: WebGL2 not available, falling back to CPU blur');
    _initFailed = true;
    return null;
  }

  // Lazy re-init on context loss
  _glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    _gl = null;
    _resources = null;
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
    console.warn('glBlur shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): BlurResources | null {
  // Compile shaders
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }

  // Link program
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Shaders can be freed after linking
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('glBlur program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Uniform locations
  const uTexture = gl.getUniformLocation(program, 'u_texture');
  const uDirection = gl.getUniformLocation(program, 'u_direction');
  const uRadius = gl.getUniformLocation(program, 'u_radius');
  const uPreserveAlpha = gl.getUniformLocation(program, 'u_preserveAlpha');
  if (!uTexture || !uDirection || !uRadius || !uPreserveAlpha) {
    console.warn('glBlur: failed to get uniform locations');
    gl.deleteProgram(program);
    return null;
  }

  // Fullscreen quad VAO
  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Textures via texStorage2D (immutable allocation)
  const texSource = gl.createTexture();
  const texIntermediate = gl.createTexture();
  if (!texSource || !texIntermediate) {
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    if (texSource) gl.deleteTexture(texSource);
    if (texIntermediate) gl.deleteTexture(texIntermediate);
    return null;
  }

  for (const tex of [texSource, texIntermediate]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // Framebuffer with texIntermediate as color attachment
  const fbo = gl.createFramebuffer();
  if (!fbo) {
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texSource);
    gl.deleteTexture(texIntermediate);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texIntermediate,
    0,
  );

  const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
    console.warn('glBlur: framebuffer incomplete:', fbStatus);
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texSource);
    gl.deleteTexture(texIntermediate);
    gl.deleteFramebuffer(fbo);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    program,
    texSource,
    texIntermediate,
    fbo,
    vao,
    uTexture,
    uDirection,
    uRadius,
    uPreserveAlpha,
    width,
    height,
  };
}

function ensureResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): BlurResources | null {
  if (_resources && _resources.width === width && _resources.height === height) {
    return _resources;
  }

  // Dimensions changed -- tear down old resources
  if (_resources) {
    gl.deleteTexture(_resources.texSource);
    gl.deleteTexture(_resources.texIntermediate);
    gl.deleteFramebuffer(_resources.fbo);
    gl.deleteProgram(_resources.program);
    gl.deleteVertexArray(_resources.vao);
    _resources = null;
  }

  _resources = createResources(gl, width, height);
  return _resources;
}

// ---- Public API ----

/**
 * Apply GPU-accelerated two-pass separable Gaussian blur.
 *
 * @param source - Source canvas to read pixels from
 * @param targetCtx - Target Canvas 2D context to draw the blurred result onto
 * @param radiusNorm - Normalized blur radius (0-1)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param preserveAlpha - If true, blur RGB only (keeps original alpha intact)
 * @returns true if GPU blur succeeded, false if caller should use CPU fallback
 */
export function applyGPUBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radiusNorm: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): boolean {
  const gl = getGL();
  if (!gl) return false;

  // Resize GL canvas to match target dimensions
  if (_glCanvas!.width !== width || _glCanvas!.height !== height) {
    _glCanvas!.width = width;
    _glCanvas!.height = height;
  }

  const res = ensureResources(gl, width, height);
  if (!res) return false;

  // Convert normalized radius to pixel radius
  const pixelRadius = normalizedToPixelRadius(radiusNorm, Math.max(width, height));
  if (pixelRadius < 1) return false;

  // Upload source canvas as texture (flip Y: canvas is top-down, GL is bottom-up)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, res.texSource);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  gl.useProgram(res.program);
  gl.uniform1i(res.uTexture, 0);
  gl.uniform1f(res.uRadius, pixelRadius);
  gl.uniform1i(res.uPreserveAlpha, preserveAlpha ? 1 : 0);
  gl.bindVertexArray(res.vao);

  // Pass 1: horizontal blur (source -> FBO intermediate)
  gl.bindFramebuffer(gl.FRAMEBUFFER, res.fbo);
  gl.viewport(0, 0, width, height);
  gl.uniform2f(res.uDirection, 1.0 / width, 0.0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, res.texSource);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Pass 2: vertical blur (intermediate -> screen)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.uniform2f(res.uDirection, 0.0, 1.0 / height);
  gl.bindTexture(gl.TEXTURE_2D, res.texIntermediate);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);

  // Read back to target 2D context — replace pixels, don't composite on top
  // (StackBlur modifies ImageData in-place; GPU must match that behavior)
  const prevOp = targetCtx.globalCompositeOperation;
  targetCtx.globalCompositeOperation = 'copy';
  targetCtx.drawImage(_glCanvas!, 0, 0, width, height);
  targetCtx.globalCompositeOperation = prevOp;
  return true;
}

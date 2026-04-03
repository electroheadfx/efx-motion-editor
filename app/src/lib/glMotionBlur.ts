/**
 * WebGL2 GPU-accelerated directional motion blur.
 *
 * Lazy-initializes a shared offscreen WebGL2 context and pre-compiled shaders.
 * Applies per-layer directional blur based on velocity (dx, dy) and shutter
 * angle strength. Uploads source via texSubImage2D(canvas), renders through
 * an FBO, and reads back via drawImage(glCanvas).
 *
 * Returns false when GPU is unavailable so the caller can skip the blur pass.
 */

// ---- Shader sources ----

const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 vUV;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  vUV = a_position * 0.5 + 0.5;
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform vec2 uVelocity;    // velocity in pixels (dx, dy)
uniform float uStrength;   // blur strength (0.0 - 1.0) = shutterAngle / 360
uniform int uSamples;      // sample count (preview: 16/32, export: 8-128)

in vec2 vUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = 1.0 / iResolution;
    vec2 velocity = uVelocity * texelSize * uStrength;

    vec4 color = vec4(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < uSamples; i++) {
        float t = float(i) / float(uSamples - 1) - 0.5;
        vec2 offset = velocity * t;
        vec2 sampleUV = clamp(vUV + offset, vec2(0.0), vec2(1.0));
        float weight = 1.0 - abs(t * 2.0); // triangle filter
        color += texture(iChannel0, sampleUV) * weight;
        totalWeight += weight;
    }

    fragColor = color / totalWeight;
}
`;

// ---- Cached GL state ----

interface MotionBlurResources {
  program: WebGLProgram;
  texSource: WebGLTexture;
  texFBO: WebGLTexture;
  fbo: WebGLFramebuffer;
  vao: WebGLVertexArrayObject;
  uIChannel0: WebGLUniformLocation;
  uIResolution: WebGLUniformLocation;
  uVelocity: WebGLUniformLocation;
  uStrength: WebGLUniformLocation;
  uSamples: WebGLUniformLocation;
  width: number;
  height: number;
}

let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _resources: MotionBlurResources | null = null;
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
    console.warn('glMotionBlur: WebGL2 not available');
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
    console.warn('glMotionBlur shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): MotionBlurResources | null {
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
    console.warn('glMotionBlur program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Uniform locations
  const uIChannel0 = gl.getUniformLocation(program, 'iChannel0');
  const uIResolution = gl.getUniformLocation(program, 'iResolution');
  const uVelocity = gl.getUniformLocation(program, 'uVelocity');
  const uStrength = gl.getUniformLocation(program, 'uStrength');
  const uSamples = gl.getUniformLocation(program, 'uSamples');
  if (!uIChannel0 || !uIResolution || !uVelocity || !uStrength || !uSamples) {
    console.warn('glMotionBlur: failed to get uniform locations');
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
  const texFBO = gl.createTexture();
  if (!texSource || !texFBO) {
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    if (texSource) gl.deleteTexture(texSource);
    if (texFBO) gl.deleteTexture(texFBO);
    return null;
  }

  for (const tex of [texSource, texFBO]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // Framebuffer with texFBO as color attachment
  const fbo = gl.createFramebuffer();
  if (!fbo) {
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texSource);
    gl.deleteTexture(texFBO);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texFBO,
    0,
  );

  const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
    console.warn('glMotionBlur: framebuffer incomplete:', fbStatus);
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texSource);
    gl.deleteTexture(texFBO);
    gl.deleteFramebuffer(fbo);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    program,
    texSource,
    texFBO,
    fbo,
    vao,
    uIChannel0,
    uIResolution,
    uVelocity,
    uStrength,
    uSamples,
    width,
    height,
  };
}

function ensureResources(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): MotionBlurResources | null {
  if (_resources && _resources.width === width && _resources.height === height) {
    return _resources;
  }

  // Dimensions changed -- tear down old resources
  if (_resources) {
    gl.deleteTexture(_resources.texSource);
    gl.deleteTexture(_resources.texFBO);
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
 * Apply GPU-accelerated directional motion blur.
 *
 * @param source - Source canvas to read pixels from
 * @param targetCtx - Target Canvas 2D context to draw the blurred result onto
 * @param velocity - Layer velocity in pixels/frame (dx, dy)
 * @param strength - Blur strength (0.0 - 1.0), typically shutterAngle / 360
 * @param samples - Number of blur samples (preview: 16/32, export: 8-128)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns true if GPU blur succeeded, false if caller should skip blur
 */
export function applyMotionBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  velocity: { dx: number; dy: number },
  strength: number,
  samples: number,
  width: number,
  height: number,
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

  // Clamp samples to at least 2 (need at least 2 for the t formula to avoid division by zero)
  const clampedSamples = Math.max(2, samples);

  // Upload source canvas as texture (flip Y: canvas is top-down, GL is bottom-up)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, res.texSource);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  // Render motion blur: source -> FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, res.fbo);
  gl.viewport(0, 0, width, height);
  gl.useProgram(res.program);

  // Set uniforms
  gl.uniform1i(res.uIChannel0, 0);
  gl.uniform2f(res.uIResolution, width, height);
  gl.uniform2f(res.uVelocity, velocity.dx, velocity.dy);
  gl.uniform1f(res.uStrength, strength);
  gl.uniform1i(res.uSamples, clampedSamples);

  // Bind source texture and draw
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, res.texSource);
  gl.bindVertexArray(res.vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Read back from FBO: render FBO texture to screen (passthrough — no blur)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.uniform1f(res.uStrength, 0.0); // passthrough: disable blur for readback pass
  gl.bindTexture(gl.TEXTURE_2D, res.texFBO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindVertexArray(null);

  // Read back to target 2D context -- replace pixels, don't composite on top
  const prevOp = targetCtx.globalCompositeOperation;
  targetCtx.globalCompositeOperation = 'copy';
  targetCtx.drawImage(_glCanvas!, 0, 0, width, height);
  targetCtx.globalCompositeOperation = prevOp;
  return true;
}

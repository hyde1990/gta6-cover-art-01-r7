// Vice Cover Studio — WebGL2 + GLSL neon grade pass.
//
// The cover is first painted in 2D (see cover.js) onto an offscreen canvas;
// this pass draws that canvas through a fragment shader — neon grade,
// bloom, halftone, grain, vignette — into the visible or export canvas.
// When WebGL2 is unavailable the caller falls back to the plain 2D canvas,
// so the app still works everywhere.

const VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_time;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 px = 1.0 / u_res;
  vec3 c = texture(u_tex, v_uv).rgb;

  // Cheap bloom: average of four neighbours, kept where the image is bright.
  vec3 blur = (
    texture(u_tex, v_uv + vec2(px.x, 0.0)).rgb +
    texture(u_tex, v_uv - vec2(px.x, 0.0)).rgb +
    texture(u_tex, v_uv + vec2(0.0, px.y)).rgb +
    texture(u_tex, v_uv - vec2(0.0, px.y)).rgb
  ) * 0.25;
  float bright = smoothstep(0.55, 0.95, dot(blur, vec3(0.299, 0.587, 0.114)));
  c += blur * bright * 0.35 * u_intensity;

  // Neon grade: shadows lean magenta, highlights lean green, more punch.
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 graded = c * 1.08;
  graded += vec3(0.10, -0.02, 0.08) * (1.0 - luma) * u_intensity;
  graded += vec3(-0.02, 0.10, -0.02) * luma * u_intensity;
  graded = mix(c, graded, u_intensity);

  // Halftone dots in the darks.
  vec2 grid = v_uv * u_res / 7.0;
  vec2 cell = fract(grid) - 0.5;
  float dotMask = smoothstep(0.5, 0.1, length(cell)) * smoothstep(0.45, 0.05, luma);
  graded *= 1.0 - dotMask * 0.22 * u_intensity;

  // Grain, seeded by uv and time (time is frozen for exports).
  float g = hash(v_uv * u_res + fract(u_time) * 61.7) - 0.5;
  graded += g * 0.05 * u_intensity;

  // Vignette.
  float d = distance(v_uv, vec2(0.5));
  graded *= 1.0 - smoothstep(0.55, 0.95, d) * 0.28 * u_intensity;

  outColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
}`;

const cache = new WeakMap();

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader failed');
  }
  return sh;
}

function setup(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = gl.createTexture();
  const state = { gl, prog, tex, buf };
  state.uTex = gl.getUniformLocation(prog, 'u_tex');
  state.uRes = gl.getUniformLocation(prog, 'u_res');
  state.uIntensity = gl.getUniformLocation(prog, 'u_intensity');
  state.uTime = gl.getUniformLocation(prog, 'u_time');
  cache.set(canvas, state);
  return state;
}

/**
 * Run the neon grade from `source` (a canvas) into `dest` (a canvas of the
 * same size). Returns true when the WebGL2 pass ran, false when the caller
 * should use the 2D source as-is.
 */
export function applyGrade(source, dest, options = {}) {
  try {
    let state = cache.get(dest);
    if (!state) state = setup(dest);
    if (!state) return false;
    const { gl, prog, tex } = state;
    if (dest.width !== source.width || dest.height !== source.height) {
      dest.width = source.width;
      dest.height = source.height;
    }
    gl.viewport(0, 0, dest.width, dest.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(state.uTex, 0);
    gl.uniform2f(state.uRes, dest.width, dest.height);
    gl.uniform1f(state.uIntensity, options.intensity ?? 0.8);
    gl.uniform1f(state.uTime, options.time ?? 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.flush();
    return true;
  } catch {
    return false;
  }
}

/** True when this browser can run the WebGL2 grade at all. */
export function gradeAvailable(canvas) {
  try {
    if (cache.has(canvas)) return true;
    const probe = document.createElement('canvas');
    return !!probe.getContext('webgl2');
  } catch {
    return false;
  }
}

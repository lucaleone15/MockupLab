import type { PatternId } from '@/store/project';

/*
 * Procedural patterns rendered by fragment shaders in a small dedicated WebGL2
 * context. Resolution independent: features are expressed in units of the
 * output height, so a 4K export shows the same pattern as the preview, only
 * sharper. Used for graphic 2D backgrounds (real materials use photographed
 * PBR textures, see scene/realMaterials.ts).
 */

export const PATTERN_IDS: PatternId[] = ['grain', 'aurora', 'topo', 'dots', 'grid', 'blueprint'];

const INDEX: Record<PatternId, number> = Object.fromEntries(PATTERN_IDS.map((id, i) => [id, i])) as Record<PatternId, number>;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uOff;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uScale;
uniform float uSeed;
uniform float uGrain;
uniform int uPattern;
out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
// x: distance to the nearest feature point, y: random id of its cell
vec2 voronoi(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float md = 8.0; vec2 id = vec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j);
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; id = n + g; }
  }
  return vec2(sqrt(md), hash12(id * 1.37));
}
// Anti-aliased line mask for a coordinate grid with the given period.
float gridLine(vec2 g, float width) {
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-5));
  return 1.0 - min(min(d.x, d.y) / width, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy + uOff;
  vec2 uv = frag / uRes;                      // 0..1, y up
  vec2 p = frag / uRes.y * uScale + uSeed * 17.31;  // pattern space
  float aspect = uRes.x / uRes.y;
  vec3 col = uC1;

  if (uPattern == 0) {            // grain gradient
    float t = clamp(uv.x * 0.55 + (1.0 - uv.y) * 0.45, 0.0, 1.0);
    col = mix(uC1, uC2, smoothstep(0.0, 1.0, t));
    vec2 c = vec2(0.78 * aspect, 0.78);
    float g = exp(-dot(uv * vec2(aspect, 1.0) - c, uv * vec2(aspect, 1.0) - c) * 3.0);
    col = mix(col, uC3, g * 0.85);
  } else if (uPattern == 1) {     // aurora (domain-warped blobs)
    vec2 q = p * 0.45;
    vec2 w = vec2(fbm(q), fbm(q + vec2(5.2, 1.3)));
    float f = fbm(q + 2.2 * w);
    col = mix(uC1, uC2, smoothstep(0.25, 0.75, f));
    col = mix(col, uC3, smoothstep(0.45, 0.95, w.x * f * 1.7));
  } else if (uPattern == 2) {     // topographic contour lines
    float n = fbm(p * 0.9);
    col = mix(uC1, uC3, smoothstep(0.2, 0.8, n) * 0.35);
    float l = n * 16.0;
    float d = abs(fract(l) - 0.5) / max(fwidth(l), 1e-5);
    col = mix(col, uC2, (1.0 - min(d / 1.1, 1.0)) * 0.85);
  } else if (uPattern == 3) {     // halftone dots
    vec2 g = p * 14.0;
    vec2 cell = fract(g) - 0.5;
    float r = mix(0.06, 0.42, clamp(1.0 - uv.y * 0.9 - uv.x * 0.25, 0.0, 1.0));
    float d = length(cell);
    float aa = fwidth(d);
    col = mix(uC1, uC2, 1.0 - smoothstep(r - aa, r + aa, d));
  } else if (uPattern == 4) {     // grid
    col = mix(uC1, uC2, gridLine(p * 12.0, 1.0) * 0.5);
    col = mix(col, uC3, gridLine(p * 12.0 / 5.0, 1.3) * 0.7);
  } else {                        // blueprint
    float vig = smoothstep(1.3, 0.2, length((uv - 0.5) * vec2(aspect, 1.0)));
    col = uC1 * (0.75 + 0.25 * vig) * (0.95 + 0.08 * fbm(p * 4.0));
    col = mix(col, uC2, gridLine(p * 16.0, 0.8) * 0.28);
    col = mix(col, uC3, gridLine(p * 16.0 / 4.0, 1.2) * 0.55);
  }

  // film grain (triangular, mean 0)
  float n = hash12(frag + uSeed * 91.7) - hash12(frag.yx * 1.31 + uSeed * 13.1);
  col += n * uGrain * 0.09;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const VERT = /* glsl */ `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

interface Engine {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
  maxTile: number;
}

let engine: Engine | null | undefined;

function getEngine(): Engine | null {
  if (engine !== undefined) return engine;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return (engine = null);
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const names = ['uRes', 'uOff', 'uC1', 'uC2', 'uC3', 'uScale', 'uSeed', 'uGrain', 'uPattern'];
  const uniforms = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  return (engine = { canvas, gl, uniforms, maxTile: Math.min(4096, vp[0], vp[1]) });
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export interface PatternSpec {
  pattern: PatternId;
  colors: [string, string, string];
  scale: number;
  grain: number;
  seed: number;
}

/** Paints a pattern covering (0, 0, w, h) of a 2D context. Tiles when larger than the GPU limit. */
export function drawPattern(ctx: CanvasRenderingContext2D, spec: PatternSpec, w: number, h: number) {
  const e = getEngine();
  if (!e) {
    ctx.fillStyle = spec.colors[0];
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const { gl, uniforms: u, canvas } = e;
  gl.uniform2f(u.uRes, w, h);
  gl.uniform3f(u.uC1, ...rgb(spec.colors[0]));
  gl.uniform3f(u.uC2, ...rgb(spec.colors[1]));
  gl.uniform3f(u.uC3, ...rgb(spec.colors[2]));
  gl.uniform1f(u.uScale, spec.scale);
  gl.uniform1f(u.uSeed, spec.seed);
  gl.uniform1f(u.uGrain, spec.grain);
  gl.uniform1i(u.uPattern, INDEX[spec.pattern] ?? 0);
  const T = e.maxTile;
  for (let top = 0; top < h; top += T) {
    for (let x = 0; x < w; x += T) {
      const tw = Math.min(T, w - x);
      const th = Math.min(T, h - top);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      gl.viewport(0, 0, tw, th);
      // gl_FragCoord is bottom-up: offset of this tile's bottom edge in the full image.
      gl.uniform2f(u.uOff, x, h - top - th);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ctx.drawImage(canvas, 0, 0, tw, th, x, top, tw, th);
    }
  }
}

/** Renders a pattern into a new canvas (used for 3D surface textures and thumbnails). */
export function patternCanvas(spec: PatternSpec, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawPattern(c.getContext('2d')!, spec, w, h);
  return c;
}

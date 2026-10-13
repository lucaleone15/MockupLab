import { invert, squareToQuad, type Quad } from './homography';
import { blankness, type ZoneStats } from './stats';
import type { PhotoZone } from '@/store/project';

/*
 * WebGL2 compositor of the photo mode. The photo is drawn as is, then each
 * zone is drawn over it: every output pixel is sent back through the inverse
 * homography into the zone's unit square, where the design is sampled
 * (cover / contain), its edges anti-aliased with a rounded-rectangle distance
 * field, and blended with what the photo shows there — its shading
 * (multiply) and its reflections (screen) — in linear light.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPhoto;
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

const PHOTO_FRAG = `${COMMON}
void main() {
  outColor = vec4(toSrgb(texture(uPhoto, vUv).rgb), 1.0);
}`;

const ZONE_FRAG = `${COMMON}
uniform sampler2D uDesign;
uniform vec2 uPhotoSize;
uniform mat3 uHinv;
uniform float uAspect;
uniform vec2 uDesignSize;
uniform int uFit;
uniform float uAlign;
uniform float uHasDesign;
uniform vec3 uBg;
uniform float uRadius, uFeather, uShading, uReflection, uBrightness, uSharp, uNoise, uMatch;
uniform vec3 uLow;
uniform vec3 uMid;
uniform float uOcclusion;
uniform vec3 uLightA;
uniform vec3 uLightB;
uniform float uLightRef;
uniform float uDetail;
uniform float uReflWeight;
uniform float uBleed;
uniform vec3 uTint;
uniform float uPreview;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 p = vUv * uPhotoSize;
  vec3 h = uHinv * vec3(p, 1.0);
  if (h.z <= 0.0) discard;
  vec2 uv = h.xy / h.z;

  // Rounded rectangle in zone units (height 1), anti-aliased in output pixels.
  vec2 half_ = vec2(uAspect, 1.0) * 0.5;
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
  float r = uRadius * min(uAspect, 1.0);
  vec2 d2 = abs(q) - half_ + r;
  float d = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0) - r;
  float aa = max(fwidth(d), 1e-6);
  // bleed: the design reaches a little past the corners, over the surface's own edge
  d -= aa * uBleed;
  float alpha = 1.0 - smoothstep(-aa * (0.5 + uFeather), aa * 0.5, d);
  if (alpha <= 0.0) discard;

  // Design coordinates (cover: crop; contain: letterbox).
  float da = uDesignSize.x / uDesignSize.y;
  vec2 t = uv;
  bool inside = true;
  if (uFit == 0) {
    if (da > uAspect) t.x = 0.5 + (uv.x - 0.5) * uAspect / da;
    else { float k = da / uAspect; t.y = uv.y * k + (1.0 - k) * uAlign; }
  } else {
    if (da > uAspect) { float k = uAspect / da; t.y = (uv.y - 0.5) / k + 0.5; }
    else t.x = 0.5 + (uv.x - 0.5) * uAspect / da;
    inside = t.x >= 0.0 && t.x <= 1.0 && t.y >= 0.0 && t.y <= 1.0;
  }

  vec3 col;
  if (uHasDesign < 0.5) {
    // Empty zone (preview only): a soft accent checker.
    vec2 c = floor(q * 14.0);
    col = mix(vec3(0.0, 0.44, 0.89), vec3(0.35, 0.62, 0.95), mod(c.x + c.y, 2.0)) * 0.6;
    alpha *= 0.55;
  } else if (!inside) {
    col = uBg;
  } else {
    float bias = uSharp < 0.0 ? -uSharp * 4.0 : 0.0;
    col = texture(uDesign, t, bias).rgb;
    if (uSharp > 0.0) {
      vec3 soft = texture(uDesign, t, 1.6).rgb;
      col = max(col + (col - soft) * uSharp * 1.5, 0.0);
    }
  }

  vec3 photo = texture(uPhoto, vUv).rgb;
  // Foreground kept from the photo: what differs clearly from the surface's own colour.
  if (uOcclusion > 0.0) {
    // half sharp, half softened: a crisp outline without salt-and-pepper where the object nears the surface's colour
    float dist = 0.5 * (length(sqrt(photo) - sqrt(uMid)) + length(sqrt(texture(uPhoto, vUv, 1.5).rgb) - sqrt(uMid)));
    float thr = mix(0.9, 0.16, uOcclusion);
    alpha *= 1.0 - smoothstep(thr - 0.04, thr + 0.1, dist);
    if (alpha <= 0.0) discard;
  }
  if (uHasDesign > 0.5) {
    col *= uBrightness;
    col *= mix(vec3(1.0), uTint, uMatch);
    // Light on the surface: a smooth fit of the photo, which never holds its content;
    // its fine detail only when the surface is blank (uDetail).
    vec2 st = clamp(uv, 0.0, 1.0);
    float fit = dot(uLightA, vec3(1.0, st.x, st.y)) + dot(uLightB, vec3(st.x * st.x, st.x * st.y, st.y * st.y));
    float lit = clamp(exp(fit - uLightRef), 0.55, 1.0);
    float fine = dot(texture(uPhoto, vUv, 1.0).rgb, vec3(0.2126, 0.7152, 0.0722));
    float detail = clamp((fine + 0.02) / exp(fit), 0.0, 1.0);
    col *= mix(1.0, lit * mix(1.0, detail, uDetail), uShading);
    vec3 refl = clamp(photo - uLow, 0.0, 1.0) * uReflection * uReflWeight;
    col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - refl);
  }
  vec3 outc = toSrgb(col);
  if (uHasDesign > 0.5) outc += (hash(p) - 0.5) * uNoise * 0.07;
  outColor = vec4(outc * alpha, alpha);
}`;

export interface ZoneDraw {
  zone: PhotoZone;
  stats: ZoneStats | null;
  design: { source: TexImageSource; key: string; width: number; height: number } | null;
}

function compile(gl: WebGL2RenderingContext, frag: string) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (name: string) => (uniforms.has(name) ? uniforms.get(name)! : (uniforms.set(name, gl.getUniformLocation(p, name)), uniforms.get(name)!)) };
}

export class PhotoRenderer {
  readonly gl: WebGL2RenderingContext;
  private photoProg;
  private zoneProg;
  private textures = new Map<string, WebGLTexture>();
  private photoKey = '';
  private aniso: EXT_texture_filter_anisotropic | null;

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas, opts: { preserve?: boolean } = {}) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: false, antialias: false, preserveDrawingBuffer: !!opts.preserve }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.photoProg = compile(gl, PHOTO_FRAG);
    this.zoneProg = compile(gl, ZONE_FRAG);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  /** sRGB texture with mipmaps (sampling returns linear values), cached by key. */
  private texture(key: string, source: TexImageSource) {
    const gl = this.gl;
    let tex = this.textures.get(key);
    if (tex) return tex;
    tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.textures.set(key, tex);
    return tex;
  }

  /** Frees design textures that are no longer used. */
  prune(keep: Set<string>) {
    for (const [k, t] of this.textures)
      if (!keep.has(k) && k !== this.photoKey) {
        this.gl.deleteTexture(t);
        this.textures.delete(k);
      }
  }

  render(photo: { source: TexImageSource; key: string; width: number; height: number }, zones: ZoneDraw[], opts: { width: number; height: number; preview: boolean }) {
    const gl = this.gl;
    if (this.canvas.width !== opts.width) this.canvas.width = opts.width;
    if (this.canvas.height !== opts.height) this.canvas.height = opts.height;
    gl.viewport(0, 0, opts.width, opts.height);
    this.photoKey = photo.key;

    gl.disable(gl.BLEND);
    gl.useProgram(this.photoProg.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture(photo.key, photo.source));
    gl.uniform1i(this.photoProg.u('uPhoto'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const P = this.zoneProg;
    gl.useProgram(P.p);
    gl.uniform1i(P.u('uPhoto'), 0);
    gl.uniform1i(P.u('uDesign'), 1);
    gl.uniform2f(P.u('uPhotoSize'), photo.width, photo.height);
    gl.uniform1f(P.u('uPreview'), opts.preview ? 1 : 0);
    for (const { zone: z, stats, design } of zones) {
      if (!z.visible) continue;
      if (!design && !opts.preview) continue;
      const quad = z.corners.map(([x, y]) => [x * photo.width, y * photo.height]) as Quad;
      const hi = invert(squareToQuad(quad));
      // mat3 uniforms are column-major
      gl.uniformMatrix3fv(P.u('uHinv'), false, [hi[0], hi[3], hi[6], hi[1], hi[4], hi[7], hi[2], hi[5], hi[8]]);
      gl.uniform1f(P.u('uAspect'), z.aspect);
      gl.activeTexture(gl.TEXTURE1);
      if (design) {
        gl.bindTexture(gl.TEXTURE_2D, this.texture(design.key, design.source));
        gl.uniform2f(P.u('uDesignSize'), design.width, design.height);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture(photo.key, photo.source));
        gl.uniform2f(P.u('uDesignSize'), z.aspect, 1);
      }
      gl.uniform1f(P.u('uHasDesign'), design ? 1 : 0);
      gl.uniform1i(P.u('uFit'), z.surface.fit === 'contain' ? 1 : 0);
      gl.uniform1f(P.u('uAlign'), z.surface.align);
      gl.uniform3fv(P.u('uBg'), z.kind === 'print' ? [0.9, 0.9, 0.88] : [0.0, 0.0, 0.0]);
      gl.uniform1f(P.u('uRadius'), z.radius);
      // feather is in photo pixels; the shader works in output pixels
      gl.uniform1f(P.u('uFeather'), (z.feather * opts.width) / photo.width);
      gl.uniform1f(P.u('uShading'), z.shading);
      gl.uniform1f(P.u('uReflection'), z.reflection);
      gl.uniform1f(P.u('uBrightness'), z.brightness);
      gl.uniform1f(P.u('uSharp'), z.sharpness);
      gl.uniform1f(P.u('uNoise'), z.noise);
      gl.uniform1f(P.u('uMatch'), z.match);
      gl.uniform3fv(P.u('uLow'), stats?.low ?? [0, 0, 0]);
      gl.uniform3fv(P.u('uMid'), stats?.mid ?? [0, 0, 0]);
      gl.uniform1f(P.u('uOcclusion'), z.occlusion);
      const blank = stats ? blankness(stats, z.kind) : 1;
      // auto: a surface with content lends nothing of it (a clear cut, not a fade)
      const t = Math.min(1, Math.max(0, (blank - 0.45) / 0.4));
      const lend = z.original === 'keep' ? 1 : z.original === 'hide' ? 0 : t * t * (3 - 2 * t);
      gl.uniform3fv(P.u('uLightA'), stats ? stats.light.slice(0, 3) : [0, 0, 0]);
      gl.uniform3fv(P.u('uLightB'), stats ? stats.light.slice(3, 6) : [0, 0, 0]);
      gl.uniform1f(P.u('uLightRef'), stats?.lightRef ?? 0);
      gl.uniform1f(P.u('uDetail'), lend);
      gl.uniform1f(P.u('uReflWeight'), lend);
      gl.uniform1f(P.u('uBleed'), (z.bleed * opts.width) / photo.width);
      gl.uniform3fv(P.u('uTint'), stats?.tint ?? [1, 1, 1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose() {
    for (const t of this.textures.values()) this.gl.deleteTexture(t);
    this.textures.clear();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

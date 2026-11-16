// CRT main pass: screen finish (highlight shoulder, vignette, glass reflection, noise, flicker, hum bar),
// display encoding and dither. Every effect is an exact no-op at 0; animated terms use uTime / uFrame only.
// Needs (declared in main.frag): uFrame. Needs color.glsl, noise.glsl, sampling.glsl (PI), geometry.glsl.

uniform float uTime;          // media time, seconds
uniform float p_vignette;
uniform float p_reflection;
uniform float p_noise;
uniform float p_flicker;
uniform float p_humBar;
uniform float p_displayGamma; // 0 sRGB, 1 gamma 2.2, 2 gamma 2.4

const float SHOULDER_KNEE = 0.8;       // values below this are never touched by the highlight shoulder
const float VIGNETTE_DEPTH = 0.9;      // darkening in the extreme corner at p_vignette = 1
const float REFLECTION_LEVEL = 0.1;    // peak linear light added at p_reflection = 1
const vec3 REFLECTION_TINT = vec3(0.92, 0.96, 1.0);
const float HUM_SPEED = 0.06;          // tube heights per second (60 Hz mains against 59.94 Hz fields)
const float HUM_DEPTH = 1.5;           // darkening at the band centre per unit of p_humBar
const float NOISE_FLOOR = 0.15;        // static noise amplitude on black, relative to on white

/**
 * Highlight shoulder: identity up to the knee, then y = K + o / (1 + o*s) with o = x - K (slope 1 at the knee),
 * where s is chosen so `peak` (the brightest value the beam/mask/exposure chain can produce) lands exactly on 1.
 * When peak <= 1 there is nothing to compress and s = 0 (identity), so neutral settings are untouched.
 */
vec3 softClip(vec3 x, float peak) {
  float m = max(peak, 1.0);
  float s = (m - 1.0) / ((1.0 - SHOULDER_KNEE) * max(m - SHOULDER_KNEE, 1e-4));
  vec3 over = max(x - SHOULDER_KNEE, 0.0);
  return min(x, SHOULDER_KNEE) + over / (1.0 + over * s);
}

/** Smooth whole-frame wobble in [-1, 1]; frequencies are whole cycles per 100 s so the wrap is seamless. */
float flickerWave(float t) {
  float tw = mod(t, 100.0);
  float tau = 2.0 * PI;
  return 0.6 * sin(tau * 8.7 * tw) + 0.4 * sin(tau * 14.3 * tw + 1.7);
}

/** Glass and signal finish in linear light. Coverage is applied last so additive light stays on the glass. */
vec3 screenFinish(vec3 col, TubeGeometry g, vec2 fragCoord) {
  // Vignette toward the picture corners (r2 = 1 in the corner, 0.5 at the edge midpoints).
  float r2 = clamp(0.5 * dot(g.centred, g.centred), 0.0, 1.0);
  col *= 1.0 - p_vignette * VIGNETTE_DEPTH * r2 * r2;

  // Glass reflection: a soft highlight up and to the left plus a faint sheen gradient toward that corner.
  vec2 aspect = vec2(tubeAspect(), 1.0);
  vec2 toLight = (g.face - vec2(-0.55, -0.65)) * aspect;
  float spot = exp(-dot(toLight, toLight) / (2.0 * 0.45 * 0.45));
  float sheen = 1.0 - smoothstep(-1.0, 0.6, 0.5 * (g.face.x + g.face.y)); // edge0 < edge1 is required
  col += REFLECTION_TINT * (p_reflection * REFLECTION_LEVEL * (0.7 * spot + 0.3 * sheen));

  // Static: luminance-only, new every frame, stronger on lit areas.
  float n = (hash12(fragCoord + vec2(37.0, 17.0) * float(uFrame % 1024)) - 0.5) * 2.0 * p_noise;
  col = max(col + vec3(n * (NOISE_FLOOR + luma(max(col, 0.0)))), 0.0);

  col *= 1.0 + p_flicker * flickerWave(uTime);

  // Hum bar: a broad dark band (raised cosine, sharpened) rolling slowly down the picture.
  float d = fract(g.uv.y - fract(uTime * HUM_SPEED) + 0.5) - 0.5;
  float band = pow(0.5 + 0.5 * cos(2.0 * PI * d), 3.0);
  col *= 1.0 - p_humBar * HUM_DEPTH * band;

  return col * g.coverage;
}

/** Linear light -> display encoding chosen by p_displayGamma. */
vec3 encodeDisplay(vec3 linearRgb) {
  vec3 c = clamp(linearRgb, 0.0, 1.0);
  if (p_displayGamma > 1.5) return fromLinear(c, 2.4);
  if (p_displayGamma > 0.5) return fromLinear(c, 2.2);
  return srgbEncode(c);
}

/**
 * +-0.5/255 dither from interleaved gradient noise (Jorge Jimenez, "Next Generation Post Processing in
 * Call of Duty: Advanced Warfare", SIGGRAPH 2014; formula published for free use). Same value on all channels.
 */
float ditherOffset(vec2 fragCoord) {
  float ign = fract(52.9829189 * fract(dot(floor(fragCoord), vec2(0.06711056, 0.00583715))));
  return (ign - 0.5) / 255.0;
}

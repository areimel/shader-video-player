// VHS tape noise helpers: unit-variance Gaussian-like noise, low-frequency value noise and FM-threshold "snow".
// Pure: no uniforms, no p_/d_ names. Needs noise.glsl (hash12, hash32). Int division: the including pass needs
// `precision highp int` (the render counter outgrows 16 bits).
// Written from the signal maths; no code adapted from other implementations.

const vec2 NOISE_OFFSET = vec2(57.3, 91.1); // decorrelates the two hashes whose sum is triangular
const float TRI_UNIT = 2.449489743;         // sqrt(6): a sum of two U(0,1) minus 1 has variance 1/6

// Per-render seeds. The render counter `n` is hashed, so no pattern recurs on a short loop (a `n % 1024` offset repeats
// every 17 s at 60 Hz). n is split into two small floats (exact in float for any int) and the result stays below
// SEED_RANGE, so the float hashes that add it to pixel coordinates stay well conditioned.
const float SEED_RANGE = 1024.0;
vec3 renderSeed3(int n) {
  return hash32(vec2(float(n % 4096) + 0.5, float(n / 4096) + 0.5)) * SEED_RANGE;
}
vec2 renderSeed(int n) { return renderSeed3(n).xy; }
float renderSeed1(int n) { return renderSeed3(n).z; }

// Zero mean, unit variance (triangular). The same generator as CRT's noise3 (crt/passes/signal-encode.frag), which
// keeps its own copy: it uses the constant 2.449 where TRI_UNIT is exact (a 0.02% difference CRT must not take).
float gaussNoise(vec2 p) {
  return (hash12(p) + hash12(p + NOISE_OFFSET) - 1.0) * TRI_UNIT;
}

vec2 gaussNoise2(vec2 p) {
  return (hash32(p).xy + hash32(p + NOISE_OFFSET).xy - 1.0) * TRI_UNIT;
}

vec3 gaussNoise3(vec2 p) {
  return (hash32(p) + hash32(p + NOISE_OFFSET) - 1.0) * TRI_UNIT;
}

// Smooth noise with knots at integer t, each unit variance ((2u - 1) * sqrt(3)), smoothstep-interpolated.
// Interpolation lowers the rms to about 0.83, so x 1.2 brings it back to about 1 (approx.).
float valueNoise1(float t, float seed) {
  float i = floor(t);
  float f = t - i;
  float a = (hash12(vec2(i, seed)) * 2.0 - 1.0) * 1.7320508;
  float b = (hash12(vec2(i + 1.0, seed)) * 2.0 - 1.0) * 1.7320508;
  return mix(a, b, f * f * (3.0 - 2.0 * f)) * 1.2;
}

// FM-threshold sparkles (phys. cause, approx. shape): below the FM threshold the demodulator emits clicks, seen as
// short comet-shaped streaks, mostly white. Cells of 8 samples per line; density 0 returns exactly 0.
float snow(float x, float row, float seed, float density) {
  float cell = floor(x / 8.0);
  vec3 h = hash32(vec2(cell + 0.5, row + seed * 3.1));
  if (h.x >= density) return 0.0;
  float start = cell * 8.0 + h.y * 4.0;
  float len = 2.0 + h.z * 6.0;
  float u = (x - start) / len;
  if (u < 0.0 || u > 1.0) return 0.0;
  float sgn = hash12(h.yz * 53.1) < 0.8 ? 1.0 : -0.6;
  return sgn * (1.0 - u);
}

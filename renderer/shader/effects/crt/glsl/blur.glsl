// Separable Gaussian along one axis using linear-sampling tap pairs.
// Needs `#include "gaussian"` (pulled in here). Output is normalised by the tap-weight sum,
// and sample coordinates are clamped to the texel centres of the border, so edges neither
// darken nor brighten regardless of the sampler's wrap mode.
#include "gaussian"

// Pair k covers texel offsets (2k-1, 2k); 96 pairs reach +-192 texels = 3.5 sigma for sigma <= 54.
const int BLUR_MAX_PAIRS = 96;

// One tap. With `box` set it is the mean of four taps spread over `perp`
// (a box footprint one output texel wide, perpendicular to the blur axis).
vec3 blurTap(sampler2D tex, vec2 p, vec2 perp, vec2 lo, vec2 hi, bool box) {
  if (!box) return texture(tex, clamp(p, lo, hi)).rgb;
  vec3 s = texture(tex, clamp(p - 0.375 * perp, lo, hi)).rgb;
  s += texture(tex, clamp(p - 0.125 * perp, lo, hi)).rgb;
  s += texture(tex, clamp(p + 0.125 * perp, lo, hi)).rgb;
  s += texture(tex, clamp(p + 0.375 * perp, lo, hi)).rgb;
  return 0.25 * s;
}

// stepUv: uv distance of one texel along the blur axis. sigma: in those texels.
// perpUv: perpendicular footprint in uv (vec2(0.0) = none).
vec3 blurSeparable(sampler2D tex, vec2 uv, vec2 stepUv, float sigma, vec2 perpUv) {
  vec2 lo = 0.5 / vec2(textureSize(tex, 0));
  vec2 hi = vec2(1.0) - lo;
  bool box = dot(perpUv, perpUv) > 0.0;
  float s = max(sigma, 0.3);
  vec3 sum = blurTap(tex, uv, perpUv, lo, hi, box);
  float wsum = 1.0;
  for (int k = 1; k <= BLUR_MAX_PAIRS; k++) {
    float a = float(2 * k - 1);
    if (a > 3.5 * s) break;
    float w1 = gaussian(a, s);
    float w2 = gaussian(a + 1.0, s);
    float w = w1 + w2;
    // Bilinear sampling between texels a and a+1 at this offset yields w1*t(a) + w2*t(a+1).
    vec2 d = stepUv * ((w1 * a + w2 * (a + 1.0)) / w);
    sum += w * (blurTap(tex, uv + d, perpUv, lo, hi, box) + blurTap(tex, uv - d, perpUv, lo, hi, box));
    wsum += 2.0 * w;
  }
  return sum / wsum;
}

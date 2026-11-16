// Composite encoder helpers. Gamma-encoded signal throughout. Pure: no p_/d_ names.
// Output texel layout of a composite encode (read by composite-decode.glsl):
//   r = S = Y + C + noise   g = Y   b = C   a = 1
// The decoder is linear, so it decodes Y, C and noise separately (noise = r - g - b).
// Written from the NTSC signal maths; no code adapted.
#include "gaussian"
#include "yiq"

const int COMPOSITE_ENCODE_RADIUS = 16; // 33 taps

// Sample at fractional x on one texture row `v` (uv). x is clamped to the first/last texel centre so taps
// past the edge repeat the edge (no edge darkening). Relies on linear filtering for fractional x.
vec3 lineSample(sampler2D tex, vec4 texSize, float v, float x) {
  float xc = clamp(x, 0.0, texSize.x - 1.0);
  return texture(tex, vec2((xc + 0.5) * texSize.z, v)).rgb;
}

// Encoder chroma band-limit: Gaussian low-pass of I/Q centred at xs - delay, so the colour lags the luma.
// The fractional delay is handled by evaluating the kernel at k + delay on integer taps. I/Q are baseband
// here, so this is accurate; delaying the modulated signal would not be. Normalised by the tap sum, so a
// flat field keeps its exact I/Q. `rgbIn`: true = the texture holds RGB (converted per tap),
// false = it already holds YIQ.
vec2 encodeChromaIQ(sampler2D tex, vec4 texSize, float v, float xs, float delay, float sigma, bool rgbIn) {
  vec2 iq = vec2(0.0);
  float wsum = 0.0;
  for (int i = -COMPOSITE_ENCODE_RADIUS; i <= COMPOSITE_ENCODE_RADIUS; i++) {
    float k = float(i);
    float w = gaussian(k + delay, sigma);
    vec3 s = lineSample(tex, texSize, v, xs + k);
    iq += w * (rgbIn ? rgb2yiq(s) : s).yz;
    wsum += w;
  }
  return iq / wsum;
}

// Quadrature-modulate I/Q onto the subcarrier at phase `phi` and pack the composite texel.
vec4 compositeEncode(float y, vec2 iq, float phi, float noise) {
  float c = iq.x * cos(phi) + iq.y * sin(phi);
  return vec4(y + c + noise, y, c, 1.0);
}

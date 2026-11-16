// The tube as a display: geometry -> convergence + horizontal reconstruction -> per-channel beam over 3 lines
// -> halation -> phosphor mask -> exposure -> + glow + diffusion -> highlight shoulder -> screen finish
// -> display encoding + dither. Inputs are in tube space (uv 0..1 = the whole tube face), linear light.
// Texture fetches per pixel: 18 raster (3 lines x 6 taps; 12 when convergence is 0) + 1 glow + 1 diffuse = 20 max.
//
// Needs (declared in the including main.frag, once): uViewportSize, uFrame, uVideoFrame.
// Declares the rest of the tube's inputs: uSource (beam.glsl), uGlow, uDiffuse, p_glow, p_diffusion, p_halation,
// p_brightness, d_exposure. Call `tubeDisplay` from uniform control flow (it takes screen derivatives).

uniform sampler2D uGlow;    // tight blur of the raster (bloom)
uniform sampler2D uDiffuse; // wide blur of the raster, 1/8 viewport resolution
uniform float p_glow;
uniform float p_diffusion;
uniform float p_halation;
uniform float p_brightness;
uniform float d_exposure;   // 1 / (mask transmittance x beam duty), scaled by autoExposure (shared/tube/derive.ts)

#include "color"
#include "noise"
#include "sampling"
#include "geometry"
#include "beam"
#include "mask"
#include "post"

// `viewUv`: position in the viewport (0..1, origin top-left, the pass's vUv); `fragCoord`: gl_FragCoord.xy.
// Returns the display-encoded, dithered, opaque colour.
vec4 tubeDisplay(vec2 viewUv, vec2 fragCoord) {
  TubeGeometry g = tubeGeometry(viewUv);

  // Derivatives must be taken in uniform control flow, before any early exit.
  float lineY = beamLineCoord(g.uv);
  float lineFw = length(vec2(dFdx(lineY), dFdy(lineY)));

  if (g.coverage <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);

  vec3 col = crtBeam(g, lineY, lineFw);

  // Light scattered under the mask.
  vec3 diffuse = vec3(0.0);
  if (p_halation > 0.0 || p_diffusion > 0.0) diffuse = textureLod(uDiffuse, g.uv, 0.0).rgb;
  col += diffuse * p_halation;

  col *= phosphorMask(fragCoord);

  float gain = d_exposure * p_brightness;
  col *= gain;

  // Light scattered in and through the glass, over the mask.
  if (p_glow > 0.0) col += textureLod(uGlow, g.uv, 0.0).rgb * p_glow;
  col += diffuse * p_diffusion;

  // Highlight shoulder over the whole sum, so glow and diffusion cannot hard-clip at 1. The peak adds the most
  // glow and diffusion can contribute (a flat white field blurs to white) to the masked beam's peak.
  col = softClip(col, gain * beamWhitePeak() * (1.0 + p_halation) + p_glow + p_diffusion);

  col = screenFinish(col, g, fragCoord);
  return vec4(clamp(encodeDisplay(col) + ditherOffset(fragCoord), 0.0, 1.0), 1.0);
}

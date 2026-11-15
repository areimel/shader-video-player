#version 300 es
precision highp float;
precision highp int;

// CRT main pass (screen resolution): geometry -> convergence + horizontal reconstruction -> per-channel beam
// over 3 lines -> halation -> phosphor mask -> exposure + highlight shoulder -> glow + diffusion -> screen finish
// -> display encoding + dither. Inputs are in tube space (uv 0..1 = the whole tube face), linear light.
// Texture fetches per pixel: 18 raster (3 lines x 6 taps; 12 when convergence is 0) + 1 glow + 1 diffuse = 20 max.

in vec2 vUv;
out vec4 fragColor;

// Uniforms shared by several chunks are declared here, once.
uniform vec4 uViewportSize; // canvas size in device pixels
uniform int uFrame;

uniform sampler2D uGlow;    // tight blur of the raster (bloom)
uniform sampler2D uDiffuse; // wide blur of the raster, 1/8 viewport resolution
uniform float p_glow;
uniform float p_diffusion;
uniform float p_halation;
uniform float p_brightness;
uniform float d_exposure;   // 1 / (mask transmittance x beam duty), scaled by autoExposure (derive.ts)

#include "color"
#include "noise"
#include "sampling"
#include "geometry"
#include "beam"
#include "mask"
#include "post"

void main() {
  TubeGeometry g = tubeGeometry(vUv);

  // Derivatives must be taken in uniform control flow, before any early exit.
  float lineY = beamLineCoord(g.uv);
  float lineFw = length(vec2(dFdx(lineY), dFdy(lineY)));

  if (g.coverage <= 0.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 col = crtBeam(g, lineY, lineFw);

  // Light scattered under the mask.
  vec3 diffuse = vec3(0.0);
  if (p_halation > 0.0 || p_diffusion > 0.0) diffuse = textureLod(uDiffuse, g.uv, 0.0).rgb;
  col += diffuse * p_halation;

  col *= phosphorMask(gl_FragCoord.xy);

  float gain = d_exposure * p_brightness;
  col = softClip(col * gain, gain * beamWhitePeak() * (1.0 + p_halation));

  // Light scattered in and through the glass, over the mask.
  if (p_glow > 0.0) col += textureLod(uGlow, g.uv, 0.0).rgb * p_glow;
  col += diffuse * p_diffusion;

  col = screenFinish(col, g, gl_FragCoord.xy);
  fragColor = vec4(clamp(encodeDisplay(col) + ditherOffset(gl_FragCoord.xy), 0.0, 1.0), 1.0);
}
